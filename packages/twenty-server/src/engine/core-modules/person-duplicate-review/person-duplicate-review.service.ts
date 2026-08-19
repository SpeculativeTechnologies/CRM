import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import {
  type PersonDuplicateGroupDTO,
  type PersonDuplicateGroupsDTO,
  type PersonDuplicatePairInput,
  type PersonDuplicatePersonDTO,
} from 'src/engine/core-modules/person-duplicate-review/dtos/person-duplicate-review.dto';
import { PersonDuplicatePairDecisionEntity } from 'src/engine/core-modules/person-duplicate-review/entities/person-duplicate-pair-decision.entity';
import {
  buildPersonDuplicateGroups,
  getPersonDuplicateIdentity,
  getSortedPersonPair,
} from 'src/engine/core-modules/person-duplicate-review/utils/person-duplicate-review.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { getWorkspaceContext } from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';
import { getObjectsPermissionsFromRolePermissionConfig } from 'src/engine/twenty-orm/utils/get-objects-permissions-from-role-permission-config.util';
import { resolveRolePermissionConfig } from 'src/engine/twenty-orm/utils/resolve-role-permission-config.util';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

// The computation reads the whole person table, so its result is cached and
// reused until a person changes (see the invalidation listener) or the TTL
// backstop expires.
const DUPLICATE_GROUPS_CACHE_TTL_MS = 15 * 60 * 1000;
const DUPLICATE_GROUPS_CACHE_VERSION_TTL_MS = 24 * 60 * 60 * 1000;

type CachedPersonDuplicateGroups = {
  groups: PersonDuplicateGroupDTO[];
  totalCount: number;
};

@Injectable()
export class PersonDuplicateReviewService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectWorkspaceScopedRepository(PersonDuplicatePairDecisionEntity)
    private readonly personDuplicatePairDecisionRepository: WorkspaceScopedRepository<PersonDuplicatePairDecisionEntity>,
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    private readonly cacheStorageService: CacheStorageService,
  ) {}

  async getDuplicateGroups({
    authContext,
  }: {
    authContext: WorkspaceAuthContext;
  }): Promise<PersonDuplicateGroupsDTO> {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const { personRepository, canResolve, rolePermissionConfig } =
          await this.getPersonRepositoryAndPermissions(authContext);

        // canResolve is per-role and cheap; the cached payload is keyed by
        // role scope because the person repository is role-filtered.
        const cacheKey = await this.getDuplicateGroupsCacheKey({
          workspaceId: authContext.workspace.id,
          rolePermissionConfig,
        });
        const cachedGroups =
          await this.cacheStorageService.get<CachedPersonDuplicateGroups>(
            cacheKey,
          );

        if (isDefined(cachedGroups)) {
          return {
            ...this.reviveCachedGroupDates(cachedGroups),
            canResolve,
          };
        }

        const people = await personRepository.find({
          relations: {
            company: true,
          },
        });
        const decisions = await this.personDuplicatePairDecisionRepository.find(
          authContext.workspace.id,
        );
        const groups = buildPersonDuplicateGroups({
          people,
          decisions,
        }).map(
          (group): PersonDuplicateGroupDTO => ({
            id: group.id,
            reasons: group.reasons,
            detectedAt: group.detectedAt,
            people: group.people.map(this.toPersonDTO),
          }),
        );

        await this.cacheStorageService.set<CachedPersonDuplicateGroups>(
          cacheKey,
          { groups, totalCount: groups.length },
          DUPLICATE_GROUPS_CACHE_TTL_MS,
        );

        return {
          groups,
          totalCount: groups.length,
          canResolve,
        };
      },
      authContext,
    );
  }

  async getDuplicateGroupsTotalCount({
    authContext,
  }: {
    authContext: WorkspaceAuthContext;
  }): Promise<number> {
    const { totalCount } = await this.getDuplicateGroups({ authContext });

    return totalCount;
  }

  async invalidateDuplicateGroupsCache(workspaceId: string): Promise<void> {
    // Bumping the version orphans every role-scoped payload at once; the
    // orphans expire through their own TTL.
    await this.cacheStorageService.set(
      this.getDuplicateGroupsCacheVersionKey(workspaceId),
      randomUUID(),
      DUPLICATE_GROUPS_CACHE_VERSION_TTL_MS,
    );
  }

  private getDuplicateGroupsCacheVersionKey(workspaceId: string): string {
    return `person-duplicate-groups-version:${workspaceId}`;
  }

  private async getDuplicateGroupsCacheKey({
    workspaceId,
    rolePermissionConfig,
  }: {
    workspaceId: string;
    rolePermissionConfig: unknown;
  }): Promise<string> {
    const version =
      (await this.cacheStorageService.get<string>(
        this.getDuplicateGroupsCacheVersionKey(workspaceId),
      )) ?? 'initial';
    const roleScopeHash = createHash('sha256')
      .update(JSON.stringify(rolePermissionConfig))
      .digest('hex')
      .slice(0, 16);

    return `person-duplicate-groups:${workspaceId}:${version}:${roleScopeHash}`;
  }

  // Dates round-trip through Redis as ISO strings; GraphQL DateTime fields
  // need Date instances back.
  private reviveCachedGroupDates(
    cachedGroups: CachedPersonDuplicateGroups,
  ): CachedPersonDuplicateGroups {
    return {
      totalCount: cachedGroups.totalCount,
      groups: cachedGroups.groups.map((group) => ({
        ...group,
        detectedAt: new Date(group.detectedAt),
        people: group.people.map((person) => ({
          ...person,
          createdAt: new Date(person.createdAt),
          updatedAt: new Date(person.updatedAt),
        })),
      })),
    };
  }

  async keepSeparate({
    authContext,
    workspaceMemberId,
    pairs,
  }: {
    authContext: WorkspaceAuthContext;
    workspaceMemberId: string;
    pairs: PersonDuplicatePairInput[];
  }): Promise<boolean> {
    if (pairs.length === 0 || pairs.length > 100) {
      throw new BadRequestException(
        'Between 1 and 100 duplicate pairs are required.',
      );
    }

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const { personRepository, canResolve } =
          await this.getPersonRepositoryAndPermissions(authContext);

        if (!canResolve) {
          throw new ForbiddenException(
            'People edit and delete permissions are required to resolve duplicates.',
          );
        }

        const personIds = [
          ...new Set(
            pairs.flatMap(({ leftPersonId, rightPersonId }) => [
              leftPersonId,
              rightPersonId,
            ]),
          ),
        ];
        const people = await personRepository.find({
          where: {
            id: In(personIds),
          },
        });

        if (people.length !== personIds.length) {
          throw new BadRequestException(
            'One or more people no longer exist or are not visible.',
          );
        }

        const peopleById = new Map(people.map((person) => [person.id, person]));
        const decisionRows = pairs.map(({ leftPersonId, rightPersonId }) => {
          if (leftPersonId === rightPersonId) {
            throw new BadRequestException(
              'A person cannot be kept separate from itself.',
            );
          }

          const [sortedLeftPersonId, sortedRightPersonId] = getSortedPersonPair(
            leftPersonId,
            rightPersonId,
          );

          const leftPerson = peopleById.get(sortedLeftPersonId);
          const rightPerson = peopleById.get(sortedRightPersonId);

          if (!leftPerson || !rightPerson) {
            throw new BadRequestException('Duplicate pair could not be found.');
          }

          return {
            workspaceId: authContext.workspace.id,
            leftPersonId: sortedLeftPersonId,
            rightPersonId: sortedRightPersonId,
            leftFingerprint: getPersonDuplicateIdentity(leftPerson).fingerprint,
            rightFingerprint:
              getPersonDuplicateIdentity(rightPerson).fingerprint,
            resolvedByWorkspaceMemberId: workspaceMemberId,
          };
        });

        await this.personDuplicatePairDecisionRepository.upsert(
          authContext.workspace.id,
          decisionRows,
          {
            conflictPaths: ['workspaceId', 'leftPersonId', 'rightPersonId'],
            skipUpdateIfNoValuesChanged: false,
          },
        );

        await this.invalidateDuplicateGroupsCache(authContext.workspace.id);

        return true;
      },
      authContext,
    );
  }

  private async getPersonRepositoryAndPermissions(
    authContext: WorkspaceAuthContext,
  ) {
    const context = getWorkspaceContext();
    const rolePermissionConfig = resolveRolePermissionConfig({
      authContext,
      userWorkspaceRoleMap: context.userWorkspaceRoleMap,
      apiKeyRoleMap: context.apiKeyRoleMap,
    });

    if (!isDefined(rolePermissionConfig)) {
      throw new ForbiddenException('No role is assigned to this workspace.');
    }

    const objectsPermissions = getObjectsPermissionsFromRolePermissionConfig({
      rolesPermissions: context.permissionsPerRoleId,
      rolePermissionConfig,
    });
    const personObjectMetadataId = context.objectIdByNameSingular.person;
    const personPermissions = objectsPermissions[personObjectMetadataId];
    const personRepository =
      await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
        authContext.workspace.id,
        'person',
        rolePermissionConfig,
      );

    return {
      personRepository,
      rolePermissionConfig,
      canResolve:
        personPermissions?.canUpdateObjectRecords === true &&
        personPermissions?.canSoftDeleteObjectRecords === true,
    };
  }

  private readonly toPersonDTO = (
    person: PersonWorkspaceEntity,
  ): PersonDuplicatePersonDTO => ({
    id: person.id,
    firstName: person.name?.firstName ?? '',
    lastName: person.name?.lastName ?? '',
    emails: [
      person.emails?.primaryEmail,
      ...(person.emails?.additionalEmails ?? []),
    ].filter((email): email is string => Boolean(email)),
    phones: [
      ...(person.phones?.primaryPhoneNumber
        ? [
            {
              number: person.phones.primaryPhoneNumber,
              countryCode: person.phones.primaryPhoneCountryCode ?? '',
              callingCode: person.phones.primaryPhoneCallingCode ?? '',
            },
          ]
        : []),
      ...(person.phones?.additionalPhones ?? []),
    ],
    linkedinLinks: [
      ...(person.linkedinLink?.primaryLinkUrl
        ? [
            {
              label: person.linkedinLink.primaryLinkLabel ?? '',
              url: person.linkedinLink.primaryLinkUrl,
            },
          ]
        : []),
      ...(person.linkedinLink?.secondaryLinks ?? []),
    ],
    jobTitle: person.jobTitle ?? '',
    company: person.company
      ? {
          id: person.company.id,
          name: person.company.name ?? '',
        }
      : null,
    avatarUrl: person.avatarUrl ?? '',
    createdByName: person.createdBy?.name ?? '',
    createdAt: new Date(person.createdAt),
    updatedAt: new Date(person.updatedAt),
  });
}

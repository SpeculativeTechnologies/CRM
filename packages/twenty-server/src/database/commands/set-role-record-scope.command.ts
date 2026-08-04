import { InjectRepository } from '@nestjs/typeorm';

import chalk from 'chalk';
import { Command, CommandRunner, Option } from 'nest-commander';
import { type RecordGqlOperationFilter } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IsNull, Repository } from 'typeorm';

import { CommandLogger } from 'src/database/commands/logger';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { RoleRecordScopeEntity } from 'src/engine/metadata-modules/role-record-scope/role-record-scope.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

type SetRoleRecordScopeCommandOptions = {
  workspaceId: string;
  role: string;
  object: string;
  filter?: string;
  clear?: boolean;
};

@Command({
  name: 'role:set-record-scope',
  description:
    'Restrict a role to the records of an object matching a filter. Pass --clear to remove the restriction.',
})
export class SetRoleRecordScopeCommand extends CommandRunner {
  protected logger: CommandLogger;

  constructor(
    @InjectWorkspaceScopedRepository(RoleEntity)
    private readonly roleRepository: WorkspaceScopedRepository<RoleEntity>,
    @InjectRepository(ObjectMetadataEntity)
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
    @InjectWorkspaceScopedRepository(RoleRecordScopeEntity)
    private readonly roleRecordScopeRepository: WorkspaceScopedRepository<RoleRecordScopeEntity>,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super();
    this.logger = new CommandLogger({
      verbose: false,
      constructorName: this.constructor.name,
    });
  }

  @Option({
    flags: '-w, --workspace-id <workspace_id>',
    description: 'workspace id',
    required: true,
  })
  parseWorkspaceId(val: string): string {
    return val;
  }

  @Option({
    flags: '-r, --role <role>',
    description: 'role id or role label',
    required: true,
  })
  parseRole(val: string): string {
    return val;
  }

  @Option({
    flags: '-o, --object <object>',
    description: 'object nameSingular, for example "opportunity"',
    required: true,
  })
  parseObject(val: string): string {
    return val;
  }

  @Option({
    flags: '-f, --filter <filter>',
    description:
      'record filter as JSON, for example \'{"pipeline":{"in":["VN_LAB"]}}\'',
    required: false,
  })
  parseFilter(val: string): string {
    return val;
  }

  @Option({
    flags: '-c, --clear',
    description: 'remove the record scope for this role and object',
    required: false,
  })
  parseClear(): boolean {
    return true;
  }

  override async run(
    _passedParams: string[],
    options: SetRoleRecordScopeCommandOptions,
  ): Promise<void> {
    const { workspaceId, role: roleIdentifier, object: objectName } = options;

    const role = await this.findRoleOrThrow(roleIdentifier, workspaceId);
    const objectMetadata = await this.findObjectMetadataOrThrow(
      objectName,
      workspaceId,
    );

    const existingScope = await this.roleRecordScopeRepository.findOne(
      workspaceId,
      {
        where: {
          roleId: role.id,
          objectMetadataId: objectMetadata.id,
          deletedAt: IsNull(),
        },
      },
    );

    if (options.clear === true) {
      if (!isDefined(existingScope)) {
        this.logger.log(
          chalk.yellow(
            `No record scope set for role "${role.label}" on "${objectName}", nothing to clear`,
          ),
        );

        return;
      }

      await this.roleRecordScopeRepository.softDelete(workspaceId, {
        id: existingScope.id,
      });
      await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
        'rolesPermissions',
      ]);

      this.logger.log(
        chalk.green(
          `Cleared record scope for role "${role.label}" on "${objectName}"`,
        ),
      );

      return;
    }

    if (!isDefined(options.filter)) {
      throw new Error('Either --filter or --clear must be provided');
    }

    const filter = this.parseFilterOrThrow(options.filter);

    if (isDefined(existingScope)) {
      await this.roleRecordScopeRepository.update(
        workspaceId,
        { id: existingScope.id },
        { filter },
      );
    } else {
      await this.roleRecordScopeRepository.insert(workspaceId, {
        roleId: role.id,
        objectMetadataId: objectMetadata.id,
        filter,
      });
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'rolesPermissions',
    ]);

    this.logger.log(
      chalk.green(
        `Role "${role.label}" is now scoped to "${objectName}" records matching ${JSON.stringify(filter)}`,
      ),
    );
  }

  private parseFilterOrThrow(rawFilter: string): RecordGqlOperationFilter {
    let filter: unknown;

    try {
      filter = JSON.parse(rawFilter);
    } catch {
      throw new Error(`--filter is not valid JSON: ${rawFilter}`);
    }

    if (
      typeof filter !== 'object' ||
      filter === null ||
      Array.isArray(filter) ||
      Object.keys(filter).length === 0
    ) {
      throw new Error(
        '--filter must be a non-empty JSON object, for example \'{"pipeline":{"in":["VN_LAB"]}}\'',
      );
    }

    return filter as RecordGqlOperationFilter;
  }

  private async findRoleOrThrow(
    roleIdentifier: string,
    workspaceId: string,
  ): Promise<RoleEntity> {
    const roles = await this.roleRepository.find(workspaceId);

    const role = roles.find(
      (candidate) =>
        candidate.id === roleIdentifier || candidate.label === roleIdentifier,
    );

    if (!isDefined(role)) {
      throw new Error(
        `Role "${roleIdentifier}" not found in workspace ${workspaceId}. Available: ${roles
          .map((candidate) => candidate.label)
          .join(', ')}`,
      );
    }

    return role;
  }

  private async findObjectMetadataOrThrow(
    objectName: string,
    workspaceId: string,
  ): Promise<ObjectMetadataEntity> {
    const objectMetadata = await this.objectMetadataRepository.findOne({
      where: { workspaceId, nameSingular: objectName },
    });

    if (!isDefined(objectMetadata)) {
      throw new Error(
        `Object "${objectName}" not found in workspace ${workspaceId}`,
      );
    }

    return objectMetadata;
  }
}

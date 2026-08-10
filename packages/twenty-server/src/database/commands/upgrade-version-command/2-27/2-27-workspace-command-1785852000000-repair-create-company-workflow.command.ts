import isEqual from 'lodash.isequal';
import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { isKnownPersonCompanyInferenceFilter } from 'src/database/commands/upgrade-version-command/2-27/utils/is-known-person-company-inference-filter.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkflowVersionCoreSyncService } from 'src/engine/core-modules/workflow/services/workflow-version-core-sync.service';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import {
  buildPersonCompanyInferenceFilter,
  buildPersonSyncSourceFilter,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/build-person-sync-source-filter.util';
import { getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';
import { getWorkflowPrefillIds } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflows.util';
import {
  AutomatedTriggerType,
  type WorkflowAutomatedTriggerWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-automated-trigger.workspace-entity';
import { type WorkflowVersionWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import {
  type DatabaseEventTriggerFilterSettings,
  type DatabaseEventTriggerSettings,
} from 'src/modules/workflow/workflow-trigger/automated-trigger/constants/automated-trigger-settings';
import { WorkflowTriggerType } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

const LEGACY_CREATE_COMPANY_WORKFLOW_ID =
  '887c6c06-fbc5-4b45-8d6b-f7b6b0f40b12';
const LEGACY_CREATE_COMPANY_WORKFLOW_VERSION_ID =
  '0f276d7e-a950-41ab-ad98-35e80753dc58';

type DatabaseEventSettingsWithFilter = DatabaseEventTriggerSettings & {
  filter?: DatabaseEventTriggerFilterSettings;
};

@RegisteredWorkspaceCommand('2.27.0', 1785852000000)
@Command({
  name: 'upgrade:2-27:repair-create-company-workflow',
  description:
    'Repair seeded company-inference sources and prevent overwriting an existing person-company relationship',
})
export class RepairCreateCompanyWorkflowCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly prefillLogicFunctionService: PrefillLogicFunctionService,
    private readonly workflowVersionCoreSyncService: WorkflowVersionCoreSyncService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    if (isDryRun) {
      this.logger.log(
        '[DRY RUN] Would restore any missing seeded company-inference source files',
      );
    } else {
      await this.prefillLogicFunctionService.ensureSeeded({
        workspaceId,
        definitions:
          getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions(
            workspaceId,
          ),
      });
    }

    const { flatFieldMetadataMaps, flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatFieldMetadataMaps',
        'flatObjectMetadataMaps',
      ]);

    const workflowVersionObject =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier:
          STANDARD_OBJECTS.workflowVersion.universalIdentifier,
      });
    const automatedTriggerObject =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier:
          STANDARD_OBJECTS.workflowAutomatedTrigger.universalIdentifier,
      });

    if (!isDefined(workflowVersionObject) || !isDefined(automatedTriggerObject)) {
      this.logger.log(
        `Workflow objects not found for workspace ${workspaceId}, skipping workflow filter repair`,
      );

      return;
    }

    const createdByFieldMetadata =
      flatFieldMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.person.fields.createdBy.universalIdentifier
      ];
    const companyFieldMetadata =
      flatFieldMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.person.fields.company.universalIdentifier
      ];

    if (
      !isDefined(createdByFieldMetadata) ||
      !isDefined(companyFieldMetadata)
    ) {
      this.logger.log(
        `Person createdBy or company field metadata not found for workspace ${workspaceId}, skipping workflow filter repair`,
      );

      return;
    }

    const sourceOnlyFilter = buildPersonSyncSourceFilter({
      createdByFieldMetadataId: createdByFieldMetadata.id,
    });
    const safeFilter = buildPersonCompanyInferenceFilter({
      createdByFieldMetadataId: createdByFieldMetadata.id,
      companyFieldMetadataId: companyFieldMetadata.id,
    });

    const workflowVersionRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowVersionWorkspaceEntity>(
        workspaceId,
        'workflowVersion',
        { shouldBypassPermissionChecks: true },
      );
    const automatedTriggerRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowAutomatedTriggerWorkspaceEntity>(
        workspaceId,
        'workflowAutomatedTrigger',
        { shouldBypassPermissionChecks: true },
      );

    const { createCompanyWorkflowId, createCompanyWorkflowVersionId } =
      getWorkflowPrefillIds(workspaceId);
    const candidateVersions = await workflowVersionRepository.find({
      where: {
        id: In([
          createCompanyWorkflowVersionId,
          LEGACY_CREATE_COMPANY_WORKFLOW_VERSION_ID,
        ]),
      },
    });
    const workflowVersion = candidateVersions.find(
      (version) =>
        (version.id === createCompanyWorkflowVersionId &&
          version.workflowId === createCompanyWorkflowId) ||
        (version.id === LEGACY_CREATE_COMPANY_WORKFLOW_VERSION_ID &&
          version.workflowId === LEGACY_CREATE_COMPANY_WORKFLOW_ID),
    );

    if (!isDefined(workflowVersion)) {
      this.logger.log(
        `Seeded create-company workflow not found for workspace ${workspaceId}, skipping workflow filter repair`,
      );

      return;
    }

    if (
      !isDefined(workflowVersion.trigger) ||
      workflowVersion.trigger.type !== WorkflowTriggerType.DATABASE_EVENT
    ) {
      this.logger.log(
        `Seeded create-company workflow trigger was customized for workspace ${workspaceId}, leaving it unchanged`,
      );

      return;
    }

    const versionSettings =
      workflowVersion.trigger.settings as DatabaseEventSettingsWithFilter;

    if (versionSettings.eventName !== 'person.upserted') {
      this.logger.log(
        `Seeded create-company workflow event was customized for workspace ${workspaceId}, leaving it unchanged`,
      );

      return;
    }

    const automatedTrigger = await automatedTriggerRepository.findOne({
      where: { workflowId: workflowVersion.workflowId },
    });
    const automatedTriggerSettings = automatedTrigger?.settings as
      | DatabaseEventSettingsWithFilter
      | undefined;

    const versionFilterIsKnown = isKnownPersonCompanyInferenceFilter({
      filter: versionSettings.filter,
      sourceOnlyFilter,
      safeFilter,
    });
    const automatedFilterIsKnown =
      !isDefined(automatedTrigger) ||
      (automatedTrigger.type === AutomatedTriggerType.DATABASE_EVENT &&
        automatedTriggerSettings?.eventName === 'person.upserted' &&
        isKnownPersonCompanyInferenceFilter({
          filter: automatedTriggerSettings.filter,
          sourceOnlyFilter,
          safeFilter,
        }));

    if (!versionFilterIsKnown || !automatedFilterIsKnown) {
      this.logger.log(
        `Seeded create-company workflow filter was customized for workspace ${workspaceId}, leaving it unchanged`,
      );

      return;
    }

    const versionAlreadySafe = this.filtersAreEqual(
      versionSettings.filter,
      safeFilter,
    );
    const automatedTriggerAlreadySafe =
      !isDefined(automatedTrigger) ||
      this.filtersAreEqual(automatedTriggerSettings?.filter, safeFilter);

    if (versionAlreadySafe && automatedTriggerAlreadySafe) {
      this.logger.log(
        `Seeded create-company workflow already protects existing company relationships for workspace ${workspaceId}`,
      );

      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would add the existing-company guard to the seeded create-company workflow for workspace ${workspaceId}`,
      );

      return;
    }

    const repairedTrigger = {
      ...workflowVersion.trigger,
      settings: {
        ...versionSettings,
        filter: safeFilter,
      },
    } as unknown as WorkflowVersionWorkspaceEntity['trigger'];

    await this.workflowVersionCoreSyncService.writeWorkflowVersionAndMirror(
      workspaceId,
      async (transactionalVersionRepository, entityManager) => {
        await transactionalVersionRepository.update(
          workflowVersion.id,
          {
            trigger: repairedTrigger,
          },
          undefined,
          entityManager,
        );

        if (isDefined(automatedTrigger)) {
          await automatedTriggerRepository.update(
            automatedTrigger.id,
            {
              settings: {
                ...automatedTriggerSettings,
                filter: safeFilter,
              },
            },
            undefined,
            entityManager,
          );
        }

        return workflowVersion.id;
      },
    );

    this.logger.log(
      `Repaired seeded create-company workflow for workspace ${workspaceId}`,
    );
  }

  // Structural, not serialized: jsonb returns object keys ordered by length,
  // never in the order the filter was built, so comparing stringified forms
  // would report every already-repaired workflow as still needing the guard.
  private filtersAreEqual(
    left: DatabaseEventTriggerFilterSettings | undefined,
    right: DatabaseEventTriggerFilterSettings,
  ): boolean {
    return isEqual(left, right);
  }
}

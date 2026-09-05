import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { EngineComponentKey } from 'src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';
import { type FlatCommandMenuItem } from 'src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { STANDARD_COMMAND_MENU_ITEMS } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-command-menu-item.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

type DisplayFields = Pick<FlatCommandMenuItem, 'label' | 'shortLabel' | 'icon'>;

export type StandardDisplayFieldsByEngineComponentKey = Partial<
  Record<EngineComponentKey, DisplayFields>
>;

export type TemplateLabelRewritePlan = {
  flatCommandMenuItemsToUpdate: FlatCommandMenuItem[];
  skippedUniversalIdentifiers: string[];
};

const TEMPLATE_MARKER = '${';

const hasTemplateExpression = (value: string | null | undefined): boolean =>
  isDefined(value) && value.includes(TEMPLATE_MARKER);

// Standard items whose engine component key appears exactly once in the
// standard definition can be matched by that key alone; the others (settings
// navigation, compose email, compose campaign) cannot and are left alone.
export const buildStandardDisplayFieldsByEngineComponentKey =
  (): StandardDisplayFieldsByEngineComponentKey => {
    const countByKey = new Map<EngineComponentKey, number>();

    for (const item of Object.values(STANDARD_COMMAND_MENU_ITEMS)) {
      countByKey.set(
        item.engineComponentKey,
        (countByKey.get(item.engineComponentKey) ?? 0) + 1,
      );
    }

    const result: StandardDisplayFieldsByEngineComponentKey = {};

    for (const item of Object.values(STANDARD_COMMAND_MENU_ITEMS)) {
      if (countByKey.get(item.engineComponentKey) !== 1) {
        continue;
      }

      result[item.engineComponentKey] = {
        label: item.label,
        shortLabel: item.shortLabel,
        icon: item.icon,
      };
    }

    return result;
  };

// Upstream stored command menu item labels as template expressions until 2.33
// ("New ${capitalize(objectMetadataItem.labelSingular)}"), migrated them by
// universal identifier in 2.33, and removed the rendering shim in 2.38. The
// boxes hold these items under pre-deterministic identifiers, so the 2.33
// migration would not have matched them even if it had run. Match by engine
// component key instead, only for items that still carry a template and only
// where the key names exactly one standard item. Idempotent.
export const planTemplateCommandMenuItemLabelRewrite = ({
  flatCommandMenuItemMaps,
  standardDisplayFieldsByEngineComponentKey,
  now,
}: {
  flatCommandMenuItemMaps: FlatEntityMaps<FlatCommandMenuItem>;
  standardDisplayFieldsByEngineComponentKey: StandardDisplayFieldsByEngineComponentKey;
  now: string;
}): TemplateLabelRewritePlan => {
  const plan: TemplateLabelRewritePlan = {
    flatCommandMenuItemsToUpdate: [],
    skippedUniversalIdentifiers: [],
  };

  for (const item of Object.values(
    flatCommandMenuItemMaps.byUniversalIdentifier,
  ).filter(isDefined)) {
    if (
      !hasTemplateExpression(item.label) &&
      !hasTemplateExpression(item.shortLabel) &&
      !hasTemplateExpression(item.icon)
    ) {
      continue;
    }

    const standardDisplayFields =
      item.engineComponentKey === EngineComponentKey.NAVIGATION
        ? undefined
        : standardDisplayFieldsByEngineComponentKey[item.engineComponentKey];

    if (!isDefined(standardDisplayFields)) {
      plan.skippedUniversalIdentifiers.push(item.universalIdentifier);
      continue;
    }

    plan.flatCommandMenuItemsToUpdate.push({
      ...item,
      ...standardDisplayFields,
      updatedAt: now,
    });
  }

  return plan;
};

@RegisteredWorkspaceCommand('2.38.0', 1788200701003)
@Command({
  name: 'upgrade:2-38:rewrite-template-command-menu-item-labels',
  description:
    'Replace pre-2.33 template expressions in command menu item labels, short labels and icons with the current standard definition, matched by engine component key',
})
export class RewriteTemplateCommandMenuItemLabelsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const { flatCommandMenuItemMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatCommandMenuItemMaps',
      ]);

    const { flatCommandMenuItemsToUpdate, skippedUniversalIdentifiers } =
      planTemplateCommandMenuItemLabelRewrite({
        flatCommandMenuItemMaps,
        standardDisplayFieldsByEngineComponentKey:
          buildStandardDisplayFieldsByEngineComponentKey(),
        now: new Date().toISOString(),
      });

    if (skippedUniversalIdentifiers.length > 0) {
      this.logger.warn(
        `${skippedUniversalIdentifiers.length} command menu item(s) keep a template label because their engine component key does not name exactly one standard item, workspace ${workspaceId}: ${skippedUniversalIdentifiers.join(', ')}`,
      );
    }

    if (flatCommandMenuItemsToUpdate.length === 0) {
      this.logger.log(
        `No command menu item label carries a template expression for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] Would rewrite' : 'Rewriting'} ${flatCommandMenuItemsToUpdate.length} command menu item label(s) for workspace ${workspaceId}: ${flatCommandMenuItemsToUpdate.map((item) => item.engineComponentKey).join(', ')}`,
    );

    if (isDryRun) {
      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            commandMenuItem: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: flatCommandMenuItemsToUpdate,
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to rewrite template command menu item labels for workspace ${workspaceId}:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
    }

    this.logger.log(
      `Rewrote ${flatCommandMenuItemsToUpdate.length} command menu item label(s) for workspace ${workspaceId}`,
    );
  }
}

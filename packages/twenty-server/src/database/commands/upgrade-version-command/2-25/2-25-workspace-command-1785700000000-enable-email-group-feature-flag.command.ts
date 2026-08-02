import { Command } from 'nest-commander';
import { FeatureFlagKey } from 'twenty-shared/types';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

@RegisteredWorkspaceCommand('2.25.0', 1785700000000)
@Command({
  name: 'upgrade:2-25:enable-email-group-feature-flag',
  description:
    'Enable IS_EMAIL_GROUP_ENABLED on existing workspaces so the Emails tab and campaign resolvers provisioned in 2.25 are reachable',
})
export class EnableEmailGroupFeatureFlagCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly featureFlagService: FeatureFlagService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const isAlreadyEnabled = await this.featureFlagService.isFeatureEnabled(
      FeatureFlagKey.IS_EMAIL_GROUP_ENABLED,
      workspaceId,
    );

    if (isAlreadyEnabled) {
      this.logger.log(
        `IS_EMAIL_GROUP_ENABLED already enabled for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would enable IS_EMAIL_GROUP_ENABLED for workspace ${workspaceId}`,
      );

      return;
    }

    await this.featureFlagService.enableFeatureFlags(
      [FeatureFlagKey.IS_EMAIL_GROUP_ENABLED],
      workspaceId,
    );

    this.logger.log(
      `Enabled IS_EMAIL_GROUP_ENABLED for workspace ${workspaceId}`,
    );
  }
}

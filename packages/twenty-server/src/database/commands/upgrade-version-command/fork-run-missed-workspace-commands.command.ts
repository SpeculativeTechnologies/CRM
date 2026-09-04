import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { ForkMissedWorkspaceCommandsService } from 'src/engine/core-modules/upgrade/services/fork-missed-workspace-commands.service';
import { UpgradeSequenceReaderService } from 'src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service';
import { WorkspaceVersionService } from 'src/engine/workspace-manager/workspace-version/services/workspace-version.service';

type ParsedOptions = {
  dryRun?: boolean;
};

// `upgrade` runs this same catch-up before resuming, so a deploy no longer
// needs a separate step. The command stays for operators who want to see or
// apply the catch-up on its own, for example after a by-name repair.
@Command({
  name: 'upgrade:run-missed-commands',
  description:
    'Run workspace upgrade commands the sequencer skipped because they were added behind a workspace cursor',
})
export class ForkRunMissedWorkspaceCommandsCommand extends CommandRunner {
  private readonly logger = new Logger(
    ForkRunMissedWorkspaceCommandsCommand.name,
  );

  constructor(
    private readonly upgradeSequenceReaderService: UpgradeSequenceReaderService,
    private readonly workspaceVersionService: WorkspaceVersionService,
    private readonly forkMissedWorkspaceCommandsService: ForkMissedWorkspaceCommandsService,
  ) {
    super();
  }

  @Option({
    flags: '-d, --dry-run',
    description: 'List the missed commands without running them',
  })
  parseDryRun(): boolean {
    return true;
  }

  override async run(
    _passedParams: string[],
    options: ParsedOptions,
  ): Promise<void> {
    const sequence = this.upgradeSequenceReaderService.getUpgradeSequence();
    const workspaceIds =
      await this.workspaceVersionService.getProvisionedWorkspaceIds();

    if (workspaceIds.length === 0) {
      this.logger.log('No provisioned workspaces — nothing to catch up.');

      return;
    }

    const report =
      await this.forkMissedWorkspaceCommandsService.runForWorkspaces({
        sequence,
        workspaceIds,
        options: { dryRun: options.dryRun },
      });

    if (report.fail.length > 0) {
      throw new Error(
        `Missed command catch-up failed for ${report.fail.length} workspace(s): ` +
          report.fail
            .map(({ workspaceId, error }) => `${workspaceId} (${error.message})`)
            .join(', '),
      );
    }

    this.logger.log(
      `Missed command catch-up ${options.dryRun ? 'planned' : 'completed'} for ${report.success.length} workspace(s).`,
    );
  }
}

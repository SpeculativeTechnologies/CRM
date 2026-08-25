import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { UpgradeMigrationService } from 'src/engine/core-modules/upgrade/services/upgrade-migration.service';
import {
  type UpgradeStep,
  UpgradeSequenceReaderService,
  type WorkspaceUpgradeStep,
} from 'src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service';
import { WorkspaceVersionService } from 'src/engine/workspace-manager/workspace-version/services/workspace-version.service';

type ParsedOptions = {
  dryRun?: boolean;
};

type MissedWorkspaceStep = {
  step: WorkspaceUpgradeStep;
  workspaceIds: string[];
};

// This fork deploys upstream main weekly, so upstream keeps adding upgrade
// commands to version segments this instance has already passed — the
// sequencer positions itself after the last attempted command and silently
// skips them (2026-08-25: four backdated 2.33 workspace commands broke the
// staging deploy because a 2.34 command depended on one of them).
//
// This command closes that gap. It walks the part of the upgrade sequence the
// instance has already passed and runs every registered workspace command
// that has no completion record, in sequence order. The deploy script calls
// it right before `upgrade`, so a caught-up command still runs before any
// newer segment that depends on it.
//
// It deliberately does NOT record completions: both cursor queries order by
// createdAt, so writing a record for an old command now would regress the
// instance or workspace cursor and break the next `upgrade`. Missed commands
// therefore re-run on every deploy until their version leaves
// TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS — safe because upgrade commands
// must be idempotent (they already re-run at every version bump).
//
// Missed INSTANCE commands are only reported, never run: replaying them would
// record a fresh attempt and regress the global cursor, making the next
// `upgrade` re-execute every later instance step. Run those by hand
// (see the twenty-gated-upgrade-command runbook) if this ever fires.
@Command({
  name: 'upgrade:run-missed-commands',
  description:
    'Run workspace upgrade commands the sequencer skipped because they were added to an already-passed version segment',
})
export class ForkRunMissedWorkspaceCommandsCommand extends CommandRunner {
  private readonly logger = new Logger(
    ForkRunMissedWorkspaceCommandsCommand.name,
  );

  constructor(
    private readonly upgradeSequenceReaderService: UpgradeSequenceReaderService,
    private readonly upgradeMigrationService: UpgradeMigrationService,
    private readonly workspaceVersionService: WorkspaceVersionService,
    private readonly workspaceIteratorService: WorkspaceIteratorService,
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

    const passedSteps = await this.getPassedSteps(sequence, workspaceIds);
    const { missedWorkspaceSteps, missedInstanceSteps } =
      await this.findMissedSteps(passedSteps, workspaceIds);

    if (missedInstanceSteps.length > 0) {
      // Failing here fails the deploy before `upgrade` runs into whatever
      // depended on the missing instance command — same contract as a
      // migration failure, and the box rolls back cleanly.
      throw new Error(
        `${missedInstanceSteps.length} instance command(s) were added to an ` +
          'already-passed version segment and never ran: ' +
          missedInstanceSteps.map((step) => step.name).join(', ') +
          '. Run them by hand on this box (see the ' +
          'twenty-gated-upgrade-command runbook), then rerun the deploy.',
      );
    }

    if (missedWorkspaceSteps.length === 0) {
      this.logger.log('No missed workspace commands — nothing to catch up.');

      return;
    }

    for (const missed of missedWorkspaceSteps) {
      this.logger.log(
        `${options.dryRun ? '[DRY RUN] Would run' : 'Running'} missed command ` +
          `"${missed.step.name}" for ${missed.workspaceIds.length} workspace(s)`,
      );
    }

    if (options.dryRun === true) {
      return;
    }

    for (const missed of missedWorkspaceSteps) {
      const report = await this.workspaceIteratorService.iterate({
        workspaceIds: missed.workspaceIds,
        callback: async (context) =>
          missed.step.command.runOnWorkspace({
            options: {},
            workspaceId: context.workspaceId,
            dataSource: context.dataSource,
            index: context.index,
            total: context.total,
          }),
      });

      if (report.fail.length > 0) {
        throw new Error(
          `Missed command "${missed.step.name}" failed for ` +
            `${report.fail.length} workspace(s): ` +
            report.fail
              .map(({ workspaceId, error }) => `${workspaceId} (${error.message})`)
              .join(', '),
        );
      }
    }

    this.logger.log(
      `Caught up ${missedWorkspaceSteps.length} missed workspace command(s).`,
    );
  }

  // Steps strictly before the instance's global cursor: the sequencer treats
  // them as done and will never run them again.
  private async getPassedSteps(
    sequence: UpgradeStep[],
    workspaceIds: string[],
  ): Promise<UpgradeStep[]> {
    const lastAttempted =
      await this.upgradeMigrationService.getLastAttemptedCommandNameOrThrow(
        workspaceIds,
      );
    const globalCursor =
      this.upgradeSequenceReaderService.locateStepInSequenceOrThrow({
        sequence,
        stepName: lastAttempted.name,
      });

    return sequence.slice(0, globalCursor);
  }

  private async findMissedSteps(
    passedSteps: UpgradeStep[],
    workspaceIds: string[],
  ): Promise<{
    missedWorkspaceSteps: MissedWorkspaceStep[];
    missedInstanceSteps: UpgradeStep[];
  }> {
    const missedWorkspaceSteps: MissedWorkspaceStep[] = [];
    const missedInstanceSteps: UpgradeStep[] = [];

    for (const step of passedSteps) {
      if (step.kind !== 'workspace') {
        const completed =
          await this.upgradeMigrationService.isLastAttemptCompleted({
            name: step.name,
            workspaceId: null,
          });

        if (!completed) {
          missedInstanceSteps.push(step);
        }

        continue;
      }

      const missingWorkspaceIds: string[] = [];

      for (const workspaceId of workspaceIds) {
        const completed =
          await this.upgradeMigrationService.isLastAttemptCompleted({
            name: step.name,
            workspaceId,
          });

        if (!completed) {
          missingWorkspaceIds.push(workspaceId);
        }
      }

      if (missingWorkspaceIds.length > 0) {
        missedWorkspaceSteps.push({
          step,
          workspaceIds: missingWorkspaceIds,
        });
      }
    }

    return { missedWorkspaceSteps, missedInstanceSteps };
  }
}

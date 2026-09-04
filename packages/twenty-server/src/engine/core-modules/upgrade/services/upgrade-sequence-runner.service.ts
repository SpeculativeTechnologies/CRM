import { Injectable, Logger } from '@nestjs/common';

import { CommandShutdownService } from 'src/database/commands/command-runners/command-shutdown.service';
import {
  type WorkspaceIteratorReport,
  WorkspaceIteratorService,
} from 'src/database/commands/command-runners/workspace-iterator.service';
import { type ParsedUpgradeCommandOptions } from 'src/database/commands/upgrade-version-command/upgrade.command';
import { ForkMissedWorkspaceCommandsService } from 'src/engine/core-modules/upgrade/services/fork-missed-workspace-commands.service';
import { InstanceCommandRunnerService } from 'src/engine/core-modules/upgrade/services/instance-command-runner.service';
import {
  UpgradeMigrationService,
  WorkspaceLastAttemptedCommand,
} from 'src/engine/core-modules/upgrade/services/upgrade-migration.service';
import {
  type InstanceUpgradeStep,
  type UpgradeStep,
  type WorkspaceUpgradeStep,
  UpgradeSequenceReaderService,
} from 'src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service';
import { WorkspaceCommandRunnerService } from 'src/engine/core-modules/upgrade/services/workspace-command-runner.service';
import { formatUpgradeLog } from 'src/engine/core-modules/upgrade/utils/format-upgrade-log.util';
import { UpgradeAwareEntityMetadataAdapter } from 'src/engine/twenty-orm/upgrade-aware/upgrade-aware-entity-metadata.adapter';
import { WorkspaceVersionService } from 'src/engine/workspace-manager/workspace-version/services/workspace-version.service';
import { assertUnreachable, isDefined } from 'twenty-shared/utils';

export type UpgradeSequenceRunnerReport = {
  totalSuccesses: number;
  totalFailures: number;
};

@Injectable()
export class UpgradeSequenceRunnerService {
  private readonly logger = new Logger(UpgradeSequenceRunnerService.name);

  constructor(
    private readonly upgradeMigrationService: UpgradeMigrationService,
    private readonly instanceCommandRunnerService: InstanceCommandRunnerService,
    private readonly workspaceCommandRunnerService: WorkspaceCommandRunnerService,
    private readonly upgradeSequenceReaderService: UpgradeSequenceReaderService,
    private readonly upgradeAwareEntityMetadataAdapter: UpgradeAwareEntityMetadataAdapter,
    private readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceVersionService: WorkspaceVersionService,
    private readonly commandShutdownService: CommandShutdownService,
    private readonly forkMissedWorkspaceCommandsService: ForkMissedWorkspaceCommandsService,
  ) {}

  async run({
    sequence,
    options,
  }: {
    sequence: UpgradeStep[];
    options: ParsedUpgradeCommandOptions;
  }): Promise<UpgradeSequenceRunnerReport> {
    if (sequence.length === 0) {
      return { totalSuccesses: 0, totalFailures: 0 };
    }

    await this.upgradeAwareEntityMetadataAdapter.refresh();

    try {
      return await this.runInner({ sequence, options });
    } finally {
      try {
        await this.upgradeAwareEntityMetadataAdapter.refresh();
      } catch (refreshError) {
        this.logger.error(
          `Failed to refresh upgrade-aware entity metadata after run`,
          refreshError instanceof Error
            ? refreshError.stack
            : String(refreshError),
        );
      }
    }
  }

  private async runInner({
    sequence,
    options,
  }: {
    sequence: UpgradeStep[];
    options: ParsedUpgradeCommandOptions;
  }): Promise<UpgradeSequenceRunnerReport> {
    const allProvisionedWorkspaceIds =
      await this.workspaceVersionService.getProvisionedWorkspaceIds();

    const startCursor = await this.resolveStartCursor({
      sequence,
      allProvisionedWorkspaceIds,
    });

    await this.runInstanceStepsSkippedBehindCursor({
      sequence,
      startCursor,
      skipDataMigration: allProvisionedWorkspaceIds.length === 0,
    });

    // Fork: workspace steps inserted behind a workspace's cursor never ran
    // either; run them before resuming so the segment ahead can rely on them.
    const catchUpReport =
      await this.forkMissedWorkspaceCommandsService.runForWorkspaces({
        sequence,
        workspaceIds: this.deriveWorkspaceIdsToProcess({
          allProvisionedWorkspaceIds,
          options,
        }),
        options,
      });

    if (catchUpReport.fail.length > 0) {
      this.logger.error(
        formatUpgradeLog({
          humanMessage:
            `Catch-up of missed workspace steps ended with ${catchUpReport.fail.length} failure(s). ` +
            'Aborting — cannot resume the sequence.',
          event: 'sequence.aborted',
          logFields: {
            failures: catchUpReport.fail.length,
            reason: 'workspace-catch-up-failures',
          },
        }),
      );

      return { totalSuccesses: 0, totalFailures: catchUpReport.fail.length };
    }

    let totalSuccesses = 0;
    let totalFailures = 0;
    let cursor = startCursor;
    let workspaceCursors = await this.fetchWorkspaceCursors(
      allProvisionedWorkspaceIds,
    );

    while (cursor < sequence.length) {
      const step = sequence[cursor];

      if (this.commandShutdownService.isShutdownRequested()) {
        this.logger.warn(
          formatUpgradeLog({
            humanMessage:
              `Stopping before step "${step.name}": shutdown requested. ` +
              'Rerun the upgrade to resume from this step.',
            event: 'sequence.stopped',
            logFields: {
              before: step.name,
              reason: 'shutdown-requested',
            },
          }),
        );

        break;
      }

      if (step.kind === 'fast-instance' || step.kind === 'slow-instance') {
        if (
          (isDefined(options.workspaceIds) &&
            options.workspaceIds.length > 0) ||
          isDefined(options.startFromWorkspaceId) ||
          isDefined(options.workspaceCountLimit)
        ) {
          this.logger.log(
            formatUpgradeLog({
              humanMessage:
                `Stopping before instance step "${step.name}": ` +
                'upgrade was run with a workspace filter (-w, --start-from-workspace-id, or --workspace-count-limit). ' +
                'Instance commands require all workspaces to be aligned.',
              event: 'sequence.stopped',
              logFields: {
                before: step.name,
                reason: 'workspace-filter-active',
              },
            }),
          );

          break;
        }

        const previousStep = cursor > 0 ? sequence[cursor - 1] : undefined;

        if (previousStep?.kind === 'workspace') {
          this.enforceWorkspacesCompletedPreviousWorkspaceSegment({
            sequence,
            previousWorkspaceStep: previousStep,
            workspaceCursors,
          });
        }

        await this.runInstanceStep({
          instanceStep: step,
          skipDataMigration: allProvisionedWorkspaceIds.length === 0,
        });

        await this.upgradeAwareEntityMetadataAdapter.refresh();

        cursor++;
        continue;
      }

      const workspaceCommandsSegment =
        this.upgradeSequenceReaderService.collectWorkspaceCommandsStartingFrom({
          sequence,
          fromWorkspaceCommand: step,
        });

      const report = await this.resumeWorkspaceCommandsFromCursors({
        workspaceCommandsSegment,
        workspaceCursors,
        allProvisionedWorkspaceIds,
        options,
      });

      totalSuccesses += report.success.length;
      totalFailures += report.fail.length;

      if (report.fail.length > 0) {
        this.logger.error(
          formatUpgradeLog({
            humanMessage:
              `Workspace steps ended with ${report.fail.length} failure(s). ` +
              'Aborting — cannot proceed to next instance step.',
            event: 'sequence.aborted',
            logFields: {
              failures: report.fail.length,
              reason: 'workspace-failures',
            },
          }),
        );

        return { totalSuccesses, totalFailures };
      }

      if (report.interrupted) {
        this.logger.warn(
          formatUpgradeLog({
            humanMessage:
              'Stopped during workspace steps: shutdown requested. ' +
              'Rerun the upgrade to process the remaining workspaces.',
            event: 'sequence.stopped',
            logFields: {
              reason: 'shutdown-requested',
              processedWorkspaces: report.success.length,
            },
          }),
        );

        return { totalSuccesses, totalFailures };
      }

      cursor += workspaceCommandsSegment.length;

      workspaceCursors = await this.fetchWorkspaceCursors(
        allProvisionedWorkspaceIds,
      );
    }

    return { totalSuccesses, totalFailures };
  }

  private async resolveStartCursor({
    sequence,
    allProvisionedWorkspaceIds,
  }: {
    sequence: UpgradeStep[];
    allProvisionedWorkspaceIds: string[];
  }): Promise<number> {
    const lastAttempted =
      await this.upgradeMigrationService.getLastAttemptedCommandNameOrThrow(
        allProvisionedWorkspaceIds,
      );

    const lastAttemptedCursor =
      this.upgradeSequenceReaderService.locateStepInSequenceOrThrow({
        sequence,
        stepName: lastAttempted.name,
      });

    const lastAttemptedStep = sequence[lastAttemptedCursor];

    switch (lastAttemptedStep.kind) {
      case 'fast-instance':
      case 'slow-instance': {
        // This fork merges upstream weekly, so upstream regularly adds instance
        // steps to a version segment the instance has already passed. Once
        // such a step runs it is the newest record, but the workspaces are
        // already further along; resume from where they are instead of
        // walking the sequence again from the backdated step.
        const furthestWorkspaceStep = await this.findWorkspaceStepAheadOfCursor(
          {
            sequence,
            allProvisionedWorkspaceIds,
            cursor: lastAttemptedCursor,
          },
        );

        if (isDefined(furthestWorkspaceStep)) {
          return this.resolveStartCursorFromWorkspaceStep({
            sequence,
            allProvisionedWorkspaceIds,
            workspaceStep: furthestWorkspaceStep,
          });
        }

        return lastAttempted.status === 'completed'
          ? lastAttemptedCursor + 1
          : lastAttemptedCursor;
      }
      case 'workspace': {
        return this.resolveStartCursorFromWorkspaceStep({
          sequence,
          allProvisionedWorkspaceIds,
          workspaceStep: lastAttemptedStep,
        });
      }
      default:
        assertUnreachable(lastAttemptedStep);
    }
  }

  private async findWorkspaceStepAheadOfCursor({
    sequence,
    allProvisionedWorkspaceIds,
    cursor,
  }: {
    sequence: UpgradeStep[];
    allProvisionedWorkspaceIds: string[];
    cursor: number;
  }): Promise<WorkspaceUpgradeStep | undefined> {
    const workspaceCursors = await this.fetchWorkspaceCursors(
      allProvisionedWorkspaceIds,
    );
    let furthest: { position: number; step: WorkspaceUpgradeStep } | undefined;

    for (const workspaceCursor of workspaceCursors.values()) {
      const position =
        this.upgradeSequenceReaderService.locateStepInSequenceOrThrow({
          sequence,
          stepName: workspaceCursor.name,
        });
      const step = sequence[position];

      if (
        position > cursor &&
        step.kind === 'workspace' &&
        (!isDefined(furthest) || position > furthest.position)
      ) {
        furthest = { position, step };
      }
    }

    return furthest?.step;
  }

  private async resolveStartCursorFromWorkspaceStep({
    sequence,
    allProvisionedWorkspaceIds,
    workspaceStep,
  }: {
    sequence: UpgradeStep[];
    allProvisionedWorkspaceIds: string[];
    workspaceStep: WorkspaceUpgradeStep;
  }): Promise<number> {
    const workspaceSliceBounds =
      this.upgradeSequenceReaderService.getWorkspaceSegmentBounds({
        sequence,
        workspaceCommand: workspaceStep,
      });

    await this.validateWorkspaceCursorsAreInWorkspaceSegment({
      sequence,
      allProvisionedWorkspaceIds,
      workspaceSliceBounds,
    });

    return workspaceSliceBounds.startCursor;
  }

  // Instance steps upstream inserted behind the cursor never ran here, and the
  // workspace steps after them assume their schema changes. Run them before
  // resuming; the workspace barrier check does not apply because every
  // workspace is already past them.
  private async runInstanceStepsSkippedBehindCursor({
    sequence,
    startCursor,
    skipDataMigration,
  }: {
    sequence: UpgradeStep[];
    startCursor: number;
    skipDataMigration: boolean;
  }): Promise<void> {
    for (const step of sequence.slice(0, startCursor)) {
      if (step.kind === 'workspace') {
        continue;
      }

      const isCompleted =
        await this.upgradeMigrationService.isLastAttemptCompleted({
          name: step.name,
          workspaceId: null,
        });

      if (isCompleted) {
        continue;
      }

      this.logger.warn(
        formatUpgradeLog({
          humanMessage:
            `Instance step "${step.name}" sits behind the cursor but never ran ` +
            '(added to an already-passed version). Running it now.',
          event: 'instance.catch-up',
          logFields: { step: step.name },
        }),
      );

      await this.runInstanceStep({ instanceStep: step, skipDataMigration });
      await this.upgradeAwareEntityMetadataAdapter.refresh();
    }
  }

  private async validateWorkspaceCursorsAreInWorkspaceSegment({
    allProvisionedWorkspaceIds,
    sequence,
    workspaceSliceBounds: { startCursor, endCursor },
  }: {
    sequence: UpgradeStep[];
    allProvisionedWorkspaceIds: string[];
    workspaceSliceBounds: { startCursor: number; endCursor: number };
  }): Promise<void> {
    const workspaceCursors =
      await this.upgradeMigrationService.getWorkspaceLastAttemptedCommandNameOrThrow(
        allProvisionedWorkspaceIds,
      );
    const precedingStep =
      startCursor > 0 ? sequence[startCursor - 1] : undefined;

    const invalidWorkspaces: Array<{
      workspaceId: string;
      cursorName: string;
      cursorStatus: string;
    }> = [];

    for (const [workspaceId, workspaceCursor] of workspaceCursors) {
      const cursorPosition =
        this.upgradeSequenceReaderService.locateStepInSequenceOrThrow({
          sequence,
          stepName: workspaceCursor.name,
        });

      const isWithinSegment =
        cursorPosition >= startCursor && cursorPosition <= endCursor;

      const isAtPrecedingInstanceCommandCompleted =
        isDefined(precedingStep) &&
        precedingStep.kind !== 'workspace' &&
        cursorPosition === startCursor - 1 &&
        workspaceCursor.status === 'completed';

      if (!isWithinSegment && !isAtPrecedingInstanceCommandCompleted) {
        invalidWorkspaces.push({
          workspaceId,
          cursorName: workspaceCursor.name,
          cursorStatus: workspaceCursor.status,
        });
      }
    }

    if (invalidWorkspaces.length > 0) {
      const details = invalidWorkspaces
        .map(
          ({ workspaceId, cursorName, cursorStatus }) =>
            `${workspaceId} at "${cursorName}" (${cursorStatus})`,
        )
        .join(', ');

      throw new Error(
        `${invalidWorkspaces.length} workspace(s) have invalid cursors for ` +
          `workspace segment [${startCursor}..${endCursor}]: ${details}`,
      );
    }
  }

  private async fetchWorkspaceCursors(
    allProvisionedWorkspaceIds: string[],
  ): Promise<Map<string, WorkspaceLastAttemptedCommand>> {
    return this.upgradeMigrationService.getWorkspaceLastAttemptedCommandNameOrThrow(
      allProvisionedWorkspaceIds,
    );
  }

  private async runInstanceStep({
    instanceStep,
    skipDataMigration,
  }: {
    instanceStep: InstanceUpgradeStep;
    skipDataMigration: boolean;
  }): Promise<void> {
    switch (instanceStep.kind) {
      case 'fast-instance': {
        const result =
          await this.instanceCommandRunnerService.runFastInstanceCommand({
            command: instanceStep.command,
            name: instanceStep.name,
          });

        if (result.status === 'failed') {
          throw result.error;
        }

        return;
      }
      case 'slow-instance': {
        const result =
          await this.instanceCommandRunnerService.runSlowInstanceCommand({
            command: instanceStep.command,
            name: instanceStep.name,
            skipDataMigration,
          });

        if (result.status === 'failed') {
          throw result.error;
        }

        return;
      }
      default:
        assertUnreachable(instanceStep);
    }
  }

  private async resumeWorkspaceCommandsFromCursors({
    workspaceCommandsSegment,
    workspaceCursors,
    allProvisionedWorkspaceIds,
    options,
  }: {
    workspaceCommandsSegment: WorkspaceUpgradeStep[];
    workspaceCursors: Map<string, WorkspaceLastAttemptedCommand>;
    allProvisionedWorkspaceIds: string[];
    options: ParsedUpgradeCommandOptions;
  }): Promise<WorkspaceIteratorReport> {
    const workspaceIds = this.deriveWorkspaceIdsToProcess({
      allProvisionedWorkspaceIds,
      options,
    });

    return this.workspaceIteratorService.iterate({
      workspaceIds,
      dryRun: options.dryRun,
      callback: async (context) => {
        const workspaceCursor = workspaceCursors.get(context.workspaceId);

        if (!workspaceCursor) {
          throw new Error(
            `No upgrade migration found for workspace ${context.workspaceId}. This should never occur.`,
          );
        }

        const pendingCommands =
          this.upgradeSequenceReaderService.getPendingWorkspaceCommands({
            workspaceCommands: workspaceCommandsSegment,
            workspaceCursor,
          });

        await this.workspaceCommandRunnerService.runWorkspaceCommands({
          iteratorContext: context,
          options,
          workspaceCommands: pendingCommands,
        });
      },
    });
  }

  private deriveWorkspaceIdsToProcess({
    allProvisionedWorkspaceIds,
    options,
  }: {
    allProvisionedWorkspaceIds: string[];
    options: ParsedUpgradeCommandOptions;
  }): string[] {
    if (isDefined(options.workspaceIds) && options.workspaceIds.length > 0) {
      return options.workspaceIds;
    }

    let workspaceIds = allProvisionedWorkspaceIds;

    if (isDefined(options.startFromWorkspaceId)) {
      workspaceIds = workspaceIds.filter(
        (id) => id >= options.startFromWorkspaceId!,
      );
    }

    if (isDefined(options.workspaceCountLimit)) {
      workspaceIds = workspaceIds.slice(0, options.workspaceCountLimit);
    }

    return workspaceIds;
  }

  private enforceWorkspacesCompletedPreviousWorkspaceSegment({
    sequence,
    previousWorkspaceStep,
    workspaceCursors,
  }: {
    sequence: UpgradeStep[];
    previousWorkspaceStep: WorkspaceUpgradeStep;
    workspaceCursors: Map<string, WorkspaceLastAttemptedCommand>;
  }): void {
    const barrierCursor =
      this.upgradeSequenceReaderService.locateStepInSequenceOrThrow({
        sequence,
        stepName: previousWorkspaceStep.name,
      });

    for (const [workspaceId, workspaceCursor] of workspaceCursors) {
      const cursorPosition =
        this.upgradeSequenceReaderService.locateStepInSequenceOrThrow({
          sequence,
          stepName: workspaceCursor.name,
        });

      const isAtBarrierAndCompleted =
        cursorPosition === barrierCursor &&
        workspaceCursor.status === 'completed';

      if (!isAtBarrierAndCompleted) {
        throw new Error(
          `Cannot run instance step: workspace ${workspaceId} ` +
            `has not completed "${previousWorkspaceStep.name}" ` +
            `(cursor: "${workspaceCursor.name}", status: "${workspaceCursor.status}")`,
        );
      }
    }
  }
}

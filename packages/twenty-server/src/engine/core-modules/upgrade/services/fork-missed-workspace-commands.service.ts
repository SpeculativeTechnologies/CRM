import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import {
  type WorkspaceIteratorContext,
  type WorkspaceIteratorReport,
  WorkspaceIteratorService,
} from 'src/database/commands/command-runners/workspace-iterator.service';
import { type ParsedUpgradeCommandOptions } from 'src/database/commands/upgrade-version-command/upgrade.command';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import {
  type UpgradeStep,
  type WorkspaceUpgradeStep,
} from 'src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service';
import {
  UpgradeMigrationEntity,
  type UpgradeMigrationStatus,
} from 'src/engine/core-modules/upgrade/upgrade-migration.entity';
import { formatUpgradeErrorForStorage } from 'src/engine/core-modules/upgrade/utils/format-upgrade-error-for-storage.util';
import { formatUpgradeLog } from 'src/engine/core-modules/upgrade/utils/format-upgrade-log.util';

export type WorkspaceCommandAttempt = {
  name: string;
  status: UpgradeMigrationStatus;
  attempt: number;
  createdAt: Date;
};

export type MissedWorkspaceCommandsPlan = {
  missedSteps: WorkspaceUpgradeStep[];
  cursorCreatedAt: Date | null;
};

// This fork merges upstream weekly, so both sides keep inserting workspace
// commands behind positions a workspace has already passed: upstream backdates
// commands into released versions, and the fork adds pre-emptive fixes in front
// of an upstream command that failed on staging. The sequencer only looks
// forward from each workspace's newest record, so those commands never run.
//
// A command counts as missed when it sits between the workspace's earliest and
// furthest attempted steps and its latest attempt is not completed. Steps
// before the earliest record are a workspace's provisioning baseline (new
// workspaces are stamped at the end of a segment and must not replay it), and
// steps after the furthest record are the sequencer's own pending work.
export const planMissedWorkspaceCommands = ({
  sequence,
  attempts,
}: {
  sequence: UpgradeStep[];
  attempts: WorkspaceCommandAttempt[];
}): MissedWorkspaceCommandsPlan => {
  const positionByName = new Map(
    sequence.map((step, position) => [step.name, position] as const),
  );
  const attemptByName = new Map(
    attempts.map((attempt) => [attempt.name, attempt] as const),
  );
  const attemptedPositions = attempts
    .map((attempt) => positionByName.get(attempt.name))
    .filter(isDefined);

  if (attemptedPositions.length === 0) {
    return { missedSteps: [], cursorCreatedAt: null };
  }

  const earliestPosition = Math.min(...attemptedPositions);
  const furthestPosition = Math.max(...attemptedPositions);

  const missedSteps = sequence
    .slice(earliestPosition + 1, furthestPosition)
    .filter(
      (step): step is WorkspaceUpgradeStep =>
        step.kind === 'workspace' &&
        attemptByName.get(step.name)?.status !== 'completed',
    );

  const cursorCreatedAt = attempts.reduce<Date>(
    (newest, attempt) =>
      attempt.createdAt > newest ? attempt.createdAt : newest,
    attempts[0].createdAt,
  );

  return { missedSteps, cursorCreatedAt };
};

@Injectable()
export class ForkMissedWorkspaceCommandsService {
  private readonly logger = new Logger(ForkMissedWorkspaceCommandsService.name);

  constructor(
    @InjectRepository(UpgradeMigrationEntity)
    private readonly upgradeMigrationRepository: Repository<UpgradeMigrationEntity>,
    private readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  async runForWorkspaces({
    sequence,
    workspaceIds,
    options,
  }: {
    sequence: UpgradeStep[];
    workspaceIds: string[];
    options: ParsedUpgradeCommandOptions;
  }): Promise<WorkspaceIteratorReport> {
    if (workspaceIds.length === 0) {
      return { fail: [], success: [], interrupted: false };
    }

    return this.workspaceIteratorService.iterate({
      workspaceIds,
      dryRun: options.dryRun,
      callback: (context) =>
        this.runForWorkspace({ context, sequence, options }),
    });
  }

  private async runForWorkspace({
    context,
    sequence,
    options,
  }: {
    context: WorkspaceIteratorContext;
    sequence: UpgradeStep[];
    options: ParsedUpgradeCommandOptions;
  }): Promise<void> {
    const { workspaceId } = context;
    const attempts = await this.loadLatestAttempts(workspaceId);
    const { missedSteps, cursorCreatedAt } = planMissedWorkspaceCommands({
      sequence,
      attempts,
    });

    if (missedSteps.length === 0 || !isDefined(cursorCreatedAt)) {
      return;
    }

    const isDryRun = options.dryRun ?? false;
    const executedByVersion =
      this.twentyConfigService.get('APP_VERSION') ?? 'unknown';
    // Dated just before the workspace's newest record, so the cursor queries,
    // which order by createdAt, keep pointing at the real position.
    const recordCreatedAt = new Date(cursorCreatedAt.getTime() - 1);

    for (const step of missedSteps) {
      this.logger.warn(
        formatUpgradeLog({
          humanMessage:
            `Workspace step "${step.name}" sits behind the cursor of workspace ${workspaceId} ` +
            'but never completed (added to an already-passed position). ' +
            `${isDryRun ? 'Would run' : 'Running'} it now.`,
          event: 'workspace.catch-up',
          logFields: { step: step.name, workspaceId, dryRun: isDryRun },
        }),
      );

      if (isDryRun) {
        continue;
      }

      try {
        await step.command.runOnWorkspace({
          options,
          workspaceId,
          dataSource: context.dataSource,
          index: context.index,
          total: context.total,
        });

        await this.recordAttempt({
          name: step.name,
          workspaceId,
          status: 'completed',
          executedByVersion,
          errorMessage: null,
          createdAt: recordCreatedAt,
        });
      } catch (error) {
        await this.recordAttempt({
          name: step.name,
          workspaceId,
          status: 'failed',
          executedByVersion,
          errorMessage: formatUpgradeErrorForStorage(error),
          createdAt: recordCreatedAt,
        });

        throw error;
      }
    }
  }

  private async loadLatestAttempts(
    workspaceId: string,
  ): Promise<WorkspaceCommandAttempt[]> {
    return this.upgradeMigrationRepository
      .createQueryBuilder('migration')
      .select([
        'migration.name',
        'migration.status',
        'migration.attempt',
        'migration.createdAt',
      ])
      .distinctOn(['migration.name'])
      .where('migration."workspaceId" = :workspaceId', { workspaceId })
      .orderBy('migration.name', 'ASC')
      .addOrderBy('migration.attempt', 'DESC')
      .getMany();
  }

  private async recordAttempt({
    name,
    workspaceId,
    status,
    executedByVersion,
    errorMessage,
    createdAt,
  }: {
    name: string;
    workspaceId: string;
    status: UpgradeMigrationStatus;
    executedByVersion: string;
    errorMessage: string | null;
    createdAt: Date;
  }): Promise<void> {
    const previousAttempt = await this.upgradeMigrationRepository.findOne({
      where: { name, workspaceId },
      order: { attempt: 'DESC' },
    });

    await this.upgradeMigrationRepository.insert({
      name,
      workspaceId,
      status,
      attempt: (previousAttempt?.attempt ?? 0) + 1,
      executedByVersion,
      errorMessage,
      isInitial: false,
      createdAt,
    });
  }
}

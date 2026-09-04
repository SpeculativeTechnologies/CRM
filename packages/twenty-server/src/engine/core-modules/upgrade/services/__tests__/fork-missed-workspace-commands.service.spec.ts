import {
  ForkMissedWorkspaceCommandsService,
  planMissedWorkspaceCommands,
  type WorkspaceCommandAttempt,
} from 'src/engine/core-modules/upgrade/services/fork-missed-workspace-commands.service';
import { type UpgradeStep } from 'src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service';

const WORKSPACE_ID = 'workspace-a';

const buildStep = (
  kind: UpgradeStep['kind'],
  name: string,
  runOnWorkspace = jest.fn(),
): UpgradeStep =>
  ({
    kind,
    name,
    version: '2.38.0',
    timestamp: 0,
    command: { runOnWorkspace },
  }) as unknown as UpgradeStep;

const at = (isoDate: string): Date => new Date(isoDate);

const attempt = (
  name: string,
  status: WorkspaceCommandAttempt['status'],
  createdAt: string,
  attemptNumber = 1,
): WorkspaceCommandAttempt => ({
  name,
  status,
  attempt: attemptNumber,
  createdAt: at(createdAt),
});

describe('planMissedWorkspaceCommands', () => {
  const sequence = [
    buildStep('fast-instance', 'instance-1'),
    buildStep('workspace', 'ws-1'),
    buildStep('workspace', 'ws-inserted'),
    buildStep('workspace', 'ws-2'),
    buildStep('fast-instance', 'instance-2'),
    buildStep('workspace', 'ws-3'),
    buildStep('workspace', 'ws-4'),
  ];

  it('should pick a never-attempted step between the earliest and furthest records', () => {
    const { missedSteps, cursorCreatedAt } = planMissedWorkspaceCommands({
      sequence,
      attempts: [
        attempt('instance-1', 'completed', '2026-09-01T00:00:00Z'),
        attempt('ws-1', 'completed', '2026-09-01T00:01:00Z'),
        attempt('ws-2', 'completed', '2026-09-01T00:02:00Z'),
        attempt('instance-2', 'completed', '2026-09-01T00:03:00Z'),
        attempt('ws-3', 'failed', '2026-09-01T00:04:00Z'),
      ],
    });

    expect(missedSteps.map((step) => step.name)).toEqual(['ws-inserted']);
    expect(cursorCreatedAt).toEqual(at('2026-09-01T00:04:00Z'));
  });

  it('should retry a step whose latest attempt failed behind the furthest record', () => {
    const { missedSteps } = planMissedWorkspaceCommands({
      sequence,
      attempts: [
        attempt('ws-1', 'failed', '2026-09-01T00:01:00Z'),
        attempt('ws-inserted', 'completed', '2026-09-01T00:02:00Z'),
        attempt('ws-2', 'completed', '2026-09-01T00:03:00Z'),
        attempt('ws-3', 'completed', '2026-09-01T00:04:00Z'),
      ],
    });

    expect(missedSteps.map((step) => step.name)).toEqual([]);

    const { missedSteps: withGap } = planMissedWorkspaceCommands({
      sequence,
      attempts: [
        attempt('instance-1', 'completed', '2026-09-01T00:00:00Z'),
        attempt('ws-1', 'failed', '2026-09-01T00:01:00Z'),
        attempt('ws-inserted', 'completed', '2026-09-01T00:02:00Z'),
        attempt('ws-2', 'completed', '2026-09-01T00:03:00Z'),
        attempt('ws-3', 'completed', '2026-09-01T00:04:00Z'),
      ],
    });

    expect(withGap.map((step) => step.name)).toEqual(['ws-1']);
  });

  it('should never include the furthest record itself or anything after it', () => {
    const { missedSteps } = planMissedWorkspaceCommands({
      sequence,
      attempts: [
        attempt('instance-1', 'completed', '2026-09-01T00:00:00Z'),
        attempt('ws-1', 'completed', '2026-09-01T00:01:00Z'),
        attempt('ws-2', 'failed', '2026-09-01T00:02:00Z'),
      ],
    });

    expect(missedSteps.map((step) => step.name)).toEqual(['ws-inserted']);
  });

  it('should leave the provisioning baseline of a new workspace alone', () => {
    const { missedSteps } = planMissedWorkspaceCommands({
      sequence,
      attempts: [attempt('ws-2', 'completed', '2026-09-01T00:00:00Z')],
    });

    expect(missedSteps).toEqual([]);
  });

  it('should ignore instance steps and records that are not in the sequence', () => {
    const { missedSteps } = planMissedWorkspaceCommands({
      sequence,
      attempts: [
        attempt('ws-1', 'completed', '2026-09-01T00:01:00Z'),
        attempt('ws-inserted', 'completed', '2026-09-01T00:02:00Z'),
        attempt('ws-2', 'completed', '2026-09-01T00:03:00Z'),
        attempt('removed-command', 'failed', '2026-09-01T00:03:30Z'),
        attempt('ws-3', 'completed', '2026-09-01T00:04:00Z'),
      ],
    });

    expect(missedSteps).toEqual([]);
  });

  it('should return nothing when the workspace has no record', () => {
    expect(planMissedWorkspaceCommands({ sequence, attempts: [] })).toEqual({
      missedSteps: [],
      cursorCreatedAt: null,
    });
  });
});

describe('ForkMissedWorkspaceCommandsService', () => {
  const buildService = ({
    attempts,
    workspaceIds = [WORKSPACE_ID],
  }: {
    attempts: WorkspaceCommandAttempt[];
    workspaceIds?: string[];
  }) => {
    const insert = jest.fn();
    const findOne = jest.fn().mockResolvedValue({ attempt: 2 });
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      distinctOn: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(attempts),
    };
    const iterate = jest.fn(
      async ({
        workspaceIds: ids,
        callback,
      }: {
        workspaceIds: string[];
        callback: (context: {
          workspaceId: string;
          index: number;
          total: number;
        }) => Promise<void>;
      }) => {
        const fail: { workspaceId: string; error: Error }[] = [];
        const success: { workspaceId: string }[] = [];

        for (const [index, workspaceId] of ids.entries()) {
          try {
            await callback({ workspaceId, index, total: ids.length });
            success.push({ workspaceId });
          } catch (error) {
            fail.push({ workspaceId, error: error as Error });
          }
        }

        return { fail, success, interrupted: false };
      },
    );

    const service = new ForkMissedWorkspaceCommandsService(
      {
        createQueryBuilder: () => queryBuilder,
        findOne,
        insert,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { iterate } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { get: () => '2.38.0' } as any,
    );

    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    return { service, insert, iterate, workspaceIds };
  };

  it('should run missed steps in sequence order and record them just before the cursor', async () => {
    const runFirst = jest.fn();
    const runSecond = jest.fn();
    const sequence = [
      buildStep('workspace', 'ws-1'),
      buildStep('workspace', 'ws-inserted-1', runFirst),
      buildStep('workspace', 'ws-inserted-2', runSecond),
      buildStep('workspace', 'ws-2'),
    ];
    const { service, insert } = buildService({
      attempts: [
        attempt('ws-1', 'completed', '2026-09-01T00:01:00.000Z'),
        attempt('ws-2', 'failed', '2026-09-01T00:02:00.000Z'),
      ],
    });

    const report = await service.runForWorkspaces({
      sequence,
      workspaceIds: [WORKSPACE_ID],
      options: {},
    });

    expect(report.fail).toEqual([]);
    expect(runFirst.mock.invocationCallOrder[0]).toBeLessThan(
      runSecond.mock.invocationCallOrder[0],
    );
    expect(runFirst).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID }),
    );
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ws-inserted-1',
        workspaceId: WORKSPACE_ID,
        status: 'completed',
        attempt: 3,
        isInitial: false,
        executedByVersion: '2.38.0',
        createdAt: at('2026-09-01T00:01:59.999Z'),
      }),
    );
  });

  it('should not run or record anything in dry-run mode', async () => {
    const runOnWorkspace = jest.fn();
    const sequence = [
      buildStep('workspace', 'ws-1'),
      buildStep('workspace', 'ws-inserted', runOnWorkspace),
      buildStep('workspace', 'ws-2'),
    ];
    const { service, insert } = buildService({
      attempts: [
        attempt('ws-1', 'completed', '2026-09-01T00:01:00Z'),
        attempt('ws-2', 'completed', '2026-09-01T00:02:00Z'),
      ],
    });

    await service.runForWorkspaces({
      sequence,
      workspaceIds: [WORKSPACE_ID],
      options: { dryRun: true },
    });

    expect(runOnWorkspace).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('should record a failed attempt, stop, and report the workspace as failed', async () => {
    const runLater = jest.fn();
    const sequence = [
      buildStep('workspace', 'ws-1'),
      buildStep(
        'workspace',
        'ws-boom',
        jest.fn().mockRejectedValue(new Error('boom')),
      ),
      buildStep('workspace', 'ws-later', runLater),
      buildStep('workspace', 'ws-2'),
    ];
    const { service, insert } = buildService({
      attempts: [
        attempt('ws-1', 'completed', '2026-09-01T00:01:00Z'),
        attempt('ws-2', 'completed', '2026-09-01T00:02:00Z'),
      ],
    });

    const report = await service.runForWorkspaces({
      sequence,
      workspaceIds: [WORKSPACE_ID],
      options: {},
    });

    expect(report.fail).toHaveLength(1);
    expect(report.fail[0].error.message).toBe('boom');
    expect(runLater).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ws-boom',
        status: 'failed',
        errorMessage: expect.stringContaining('boom'),
      }),
    );
  });

  it('should skip the iterator when there is no workspace to process', async () => {
    const { service, iterate } = buildService({ attempts: [] });

    const report = await service.runForWorkspaces({
      sequence: [],
      workspaceIds: [],
      options: {},
    });

    expect(report).toEqual({ fail: [], success: [], interrupted: false });
    expect(iterate).not.toHaveBeenCalled();
  });
});

import { ForkRunMissedWorkspaceCommandsCommand } from 'src/database/commands/upgrade-version-command/fork-run-missed-workspace-commands.command';

const WORKSPACE_A = 'workspace-a';
const WORKSPACE_B = 'workspace-b';

const buildStep = (kind: string, name: string, runOnWorkspace = jest.fn()) => ({
  kind,
  name,
  command: { runOnWorkspace },
});

const buildCommand = ({
  sequence,
  completedNames,
  lastAttemptedName,
  workspaceIds = [WORKSPACE_A, WORKSPACE_B],
}: {
  sequence: ReturnType<typeof buildStep>[];
  completedNames: Set<string>;
  lastAttemptedName: string;
  workspaceIds?: string[];
}) => {
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
      for (const [index, workspaceId] of ids.entries()) {
        await callback({ workspaceId, index, total: ids.length });
      }

      const report: {
        fail: { workspaceId: string; error: Error }[];
        success: string[];
        interrupted: boolean;
      } = { fail: [], success: ids, interrupted: false };

      return report;
    },
  );

  const command = new ForkRunMissedWorkspaceCommandsCommand(
    {
      getUpgradeSequence: () => sequence,
      locateStepInSequenceOrThrow: ({ stepName }: { stepName: string }) =>
        sequence.findIndex((step) => step.name === stepName),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      getLastAttemptedCommandNameOrThrow: async () => ({
        name: lastAttemptedName,
        status: 'completed',
      }),
      isLastAttemptCompleted: async ({
        name,
        workspaceId,
      }: {
        name: string;
        workspaceId: string | null;
      }) => completedNames.has(`${name}:${workspaceId ?? 'instance'}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      getProvisionedWorkspaceIds: async () => workspaceIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { iterate } as any,
  );

  return { command, iterate };
};

describe('ForkRunMissedWorkspaceCommandsCommand', () => {
  it('should run a passed workspace command that has no completion record', async () => {
    const runOnWorkspace = jest.fn();
    const missedStep = buildStep('workspace', 'ws-missed', runOnWorkspace);
    const sequence = [
      buildStep('fast-instance', 'instance-1'),
      missedStep,
      buildStep('workspace', 'ws-done'),
      buildStep('fast-instance', 'instance-2'),
    ];
    const { command } = buildCommand({
      sequence,
      lastAttemptedName: 'instance-2',
      completedNames: new Set([
        'instance-1:instance',
        `ws-done:${WORKSPACE_A}`,
        `ws-done:${WORKSPACE_B}`,
      ]),
    });

    await command.run([], {});

    expect(runOnWorkspace).toHaveBeenCalledTimes(2);
    expect(runOnWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_A }),
    );
    expect(runOnWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_B }),
    );
  });

  it('should only run the command for workspaces missing the record', async () => {
    const runOnWorkspace = jest.fn();
    const sequence = [
      buildStep('workspace', 'ws-partial', runOnWorkspace),
      buildStep('fast-instance', 'instance-1'),
    ];
    const { command } = buildCommand({
      sequence,
      lastAttemptedName: 'instance-1',
      completedNames: new Set([
        'instance-1:instance',
        `ws-partial:${WORKSPACE_A}`,
      ]),
    });

    await command.run([], {});

    expect(runOnWorkspace).toHaveBeenCalledTimes(1);
    expect(runOnWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_B }),
    );
  });

  it('should not run anything at or after the global cursor', async () => {
    const runAtCursor = jest.fn();
    const runAfterCursor = jest.fn();
    const sequence = [
      buildStep('fast-instance', 'instance-1'),
      buildStep('workspace', 'ws-at-cursor', runAtCursor),
      buildStep('workspace', 'ws-after-cursor', runAfterCursor),
    ];
    const { command } = buildCommand({
      sequence,
      lastAttemptedName: 'ws-at-cursor',
      completedNames: new Set(['instance-1:instance']),
    });

    await command.run([], {});

    expect(runAtCursor).not.toHaveBeenCalled();
    expect(runAfterCursor).not.toHaveBeenCalled();
  });

  it('should not run anything in dry-run mode', async () => {
    const runOnWorkspace = jest.fn();
    const sequence = [
      buildStep('workspace', 'ws-missed', runOnWorkspace),
      buildStep('fast-instance', 'instance-1'),
    ];
    const { command } = buildCommand({
      sequence,
      lastAttemptedName: 'instance-1',
      completedNames: new Set(['instance-1:instance']),
    });

    await command.run([], { dryRun: true });

    expect(runOnWorkspace).not.toHaveBeenCalled();
  });

  it('should only warn when a passed instance command has no completion record, since upgrade runs it', async () => {
    const sequence = [
      buildStep('fast-instance', 'instance-missed'),
      buildStep('fast-instance', 'instance-done'),
    ];
    const { command } = buildCommand({
      sequence,
      lastAttemptedName: 'instance-done',
      completedNames: new Set([]),
    });
    const warnSpy = jest
      .spyOn(command['logger'], 'warn')
      .mockImplementation(() => undefined);

    await expect(command.run([], {})).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/instance-missed.*`upgrade` runs them/),
    );
  });

  it('should throw when a missed command fails for a workspace', async () => {
    const sequence = [
      buildStep('workspace', 'ws-missed'),
      buildStep('fast-instance', 'instance-1'),
    ];
    const { command, iterate } = buildCommand({
      sequence,
      lastAttemptedName: 'instance-1',
      completedNames: new Set(['instance-1:instance']),
    });

    iterate.mockResolvedValueOnce({
      fail: [{ workspaceId: WORKSPACE_A, error: new Error('boom') }],
      success: [],
      interrupted: false,
    });

    await expect(command.run([], {})).rejects.toThrow(
      /Missed command "ws-missed" failed/,
    );
  });
});

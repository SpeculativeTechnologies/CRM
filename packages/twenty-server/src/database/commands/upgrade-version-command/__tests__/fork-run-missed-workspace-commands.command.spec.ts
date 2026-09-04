import { ForkRunMissedWorkspaceCommandsCommand } from 'src/database/commands/upgrade-version-command/fork-run-missed-workspace-commands.command';

const WORKSPACE_A = 'workspace-a';
const WORKSPACE_B = 'workspace-b';

const SEQUENCE = [{ kind: 'workspace', name: 'ws-1' }];

const buildCommand = ({
  workspaceIds = [WORKSPACE_A, WORKSPACE_B],
  report = {
    fail: [],
    success: workspaceIds.map((workspaceId) => ({ workspaceId })),
    interrupted: false,
  },
}: {
  workspaceIds?: string[];
  report?: {
    fail: { workspaceId: string; error: Error }[];
    success: { workspaceId: string }[];
    interrupted: boolean;
  };
} = {}) => {
  const runForWorkspaces = jest.fn().mockResolvedValue(report);

  const command = new ForkRunMissedWorkspaceCommandsCommand(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { getUpgradeSequence: () => SEQUENCE } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { getProvisionedWorkspaceIds: async () => workspaceIds } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { runForWorkspaces } as any,
  );

  jest.spyOn(command['logger'], 'log').mockImplementation(() => undefined);

  return { command, runForWorkspaces };
};

describe('ForkRunMissedWorkspaceCommandsCommand', () => {
  it('should hand every provisioned workspace to the catch-up service', async () => {
    const { command, runForWorkspaces } = buildCommand();

    await command.run([], {});

    expect(runForWorkspaces).toHaveBeenCalledWith({
      sequence: SEQUENCE,
      workspaceIds: [WORKSPACE_A, WORKSPACE_B],
      options: { dryRun: undefined },
    });
  });

  it('should pass dry-run through', async () => {
    const { command, runForWorkspaces } = buildCommand();

    await command.run([], { dryRun: true });

    expect(runForWorkspaces).toHaveBeenCalledWith(
      expect.objectContaining({ options: { dryRun: true } }),
    );
  });

  it('should do nothing without provisioned workspaces', async () => {
    const { command, runForWorkspaces } = buildCommand({ workspaceIds: [] });

    await command.run([], {});

    expect(runForWorkspaces).not.toHaveBeenCalled();
  });

  it('should throw when the catch-up failed for a workspace', async () => {
    const { command } = buildCommand({
      report: {
        fail: [{ workspaceId: WORKSPACE_A, error: new Error('boom') }],
        success: [{ workspaceId: WORKSPACE_B }],
        interrupted: false,
      },
    });

    await expect(command.run([], {})).rejects.toThrow(
      /catch-up failed for 1 workspace\(s\): workspace-a \(boom\)/,
    );
  });
});

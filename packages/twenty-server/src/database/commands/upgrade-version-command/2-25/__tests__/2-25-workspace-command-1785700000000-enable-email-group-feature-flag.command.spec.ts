import { FeatureFlagKey } from 'twenty-shared/types';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { EnableEmailGroupFeatureFlagCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785700000000-enable-email-group-feature-flag.command';
import { type FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';

describe('EnableEmailGroupFeatureFlagCommand', () => {
  let command: EnableEmailGroupFeatureFlagCommand;
  let isFeatureEnabledMock: jest.Mock;
  let enableFeatureFlagsMock: jest.Mock;

  beforeEach(() => {
    isFeatureEnabledMock = jest.fn().mockResolvedValue(false);
    enableFeatureFlagsMock = jest.fn().mockResolvedValue(undefined);

    command = new EnableEmailGroupFeatureFlagCommand(
      {} as WorkspaceIteratorService,
      {
        isFeatureEnabled: isFeatureEnabledMock,
        enableFeatureFlags: enableFeatureFlagsMock,
      } as unknown as FeatureFlagService,
    );
  });

  const runOnWorkspace = (dryRun = false) =>
    command.runOnWorkspace({
      workspaceId: WORKSPACE_ID,
      options: { dryRun },
      index: 0,
      total: 1,
    });

  it('should enable IS_EMAIL_GROUP_ENABLED when the flag is off', async () => {
    await runOnWorkspace();

    expect(isFeatureEnabledMock).toHaveBeenCalledWith(
      FeatureFlagKey.IS_EMAIL_GROUP_ENABLED,
      WORKSPACE_ID,
    );
    expect(enableFeatureFlagsMock).toHaveBeenCalledWith(
      [FeatureFlagKey.IS_EMAIL_GROUP_ENABLED],
      WORKSPACE_ID,
    );
  });

  it('should skip when the flag is already enabled', async () => {
    isFeatureEnabledMock.mockResolvedValue(true);

    await runOnWorkspace();

    expect(enableFeatureFlagsMock).not.toHaveBeenCalled();
  });

  it('should not write anything on dry run', async () => {
    await runOnWorkspace(true);

    expect(enableFeatureFlagsMock).not.toHaveBeenCalled();
  });
});

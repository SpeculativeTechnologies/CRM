import { Command } from 'nest-commander';

import { RestoreSettingsNavigationCommandMenuItemLabelsCommand } from 'src/database/commands/upgrade-version-command/2-37/2-37-workspace-command-1787840804000-restore-settings-navigation-command-menu-item-labels.command';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// Staging, 2026-09-05: a fork re-run of upstream's 2.33 label migration
// (since removed) overwrote the 17 path-based settings navigation items with
// the object navigation display fields, the same damage upstream's own 2.37
// restore exists to undo. That restore is recorded as completed, so re-run it
// from a later position. Idempotent; a no-op where nothing was overwritten.
@RegisteredWorkspaceCommand('2.38.0', 1788200701004)
@Command({
  name: 'upgrade:2-38:restore-settings-navigation-labels-after-label-rewrite',
  description:
    'Restore the standard label, short label and icon of the path-based settings navigation command menu items (the 2.37 restore, re-run after the 2.38 label rewrites)',
})
export class RestoreSettingsNavigationLabelsAfterLabelRewriteCommand extends RestoreSettingsNavigationCommandMenuItemLabelsCommand {}

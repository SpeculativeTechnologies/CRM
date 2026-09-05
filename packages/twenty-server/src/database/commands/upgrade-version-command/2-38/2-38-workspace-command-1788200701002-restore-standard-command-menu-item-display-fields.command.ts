import { Command } from 'nest-commander';

import { MigrateCommandMenuItemLabelsToPlaceholdersCommand } from 'src/database/commands/upgrade-version-command/2-33/2-33-workspace-command-1787127900000-migrate-command-menu-item-labels-to-placeholders.command';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// Upstream stored command menu item labels as template expressions until 2.33
// ("New ${capitalize(objectMetadataItem.labelSingular)}"), migrated them to
// named placeholders in 2.33, kept a rendering shim for a while, and removed
// the shim in 2.38. The 2.33 migration sits below this fork's catch-up floor
// and never ran on the boxes, so 2.38 shows the raw expression on every "New"
// button. Run the same migration again from a position the catch-up covers:
// it rewrites label, shortLabel and icon of standard and navigation items to
// the current standard definition and skips everything else. Idempotent.
@RegisteredWorkspaceCommand('2.38.0', 1788200701002)
@Command({
  name: 'upgrade:2-38:restore-standard-command-menu-item-display-fields',
  description:
    'Rewrite standard and navigation command menu item labels, short labels and icons to the current standard definition (the 2.33 placeholder migration, re-run above the catch-up floor)',
})
export class RestoreStandardCommandMenuItemDisplayFieldsCommand extends MigrateCommandMenuItemLabelsToPlaceholdersCommand {}

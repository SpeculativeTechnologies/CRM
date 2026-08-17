import { CreatePersonDuplicateReviewTablesFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-instance-command-fast-1785466013136-create-person-duplicate-review-tables';
import { AddIsExactlyViewFilterOperandsFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-27/2-27-instance-command-fast-1785774996477-add-is-exactly-view-filter-operands';
import { AddViewParentViewIdFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-31/2-31-instance-command-fast-1786400000000-add-view-parent-view-id';

// Fork-authored instance commands, kept out of upstream's INSTANCE_COMMANDS
// entries so weekly syncs stop conflicting on that list. Registration order
// does not matter: execution order comes from each command's
// @RegisteredInstanceCommand version and timestamp, and the list only feeds
// dependency injection.
export const FORK_INSTANCE_COMMANDS = [
  CreatePersonDuplicateReviewTablesFastInstanceCommand,
  AddIsExactlyViewFilterOperandsFastInstanceCommand,
  AddViewParentViewIdFastInstanceCommand,
];

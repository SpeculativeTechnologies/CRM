import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { ProvisionMessageCampaignStandardMetadataCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000000-provision-message-campaign-standard-metadata.command';
import { ProvisionAndBackfillPersonOpenTaskCountCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785700000000-provision-and-backfill-person-open-task-count.command';
import { SetConnectionJunctionTargetsCommand } from 'src/database/commands/upgrade-version-command/2-27/2-27-workspace-command-1785800000000-set-connection-junction-targets.command';
import { DefaultConnectionTypeToRelationshipCommand } from 'src/database/commands/upgrade-version-command/2-27/2-27-workspace-command-1785810000000-default-connection-type-to-relationship.command';
import { AddConnectionIsReciprocalFieldCommand } from 'src/database/commands/upgrade-version-command/2-27/2-27-workspace-command-1785820000000-add-connection-is-reciprocal-field.command';
import { BackfillConnectionReciprocalsCommand } from 'src/database/commands/upgrade-version-command/2-27/2-27-workspace-command-1785830000000-backfill-connection-reciprocals.command';
import { HidePersonConnectedFromViewFieldCommand } from 'src/database/commands/upgrade-version-command/2-27/2-27-workspace-command-1785840000000-hide-person-connected-from-view-field.command';
import { HideReciprocalsFromConnectionsViewCommand } from 'src/database/commands/upgrade-version-command/2-27/2-27-workspace-command-1785850000000-hide-reciprocals-from-connections-view.command';
import { AddComposeEmailToRelatedPeopleCommandMenuItemCommand } from 'src/database/commands/upgrade-version-command/2-32/2-32-workspace-command-1786400000000-add-compose-email-to-related-people-command-menu-item.command';
import { BackfillMissingLabelIdentifierViewFieldsCommand } from 'src/database/commands/upgrade-version-command/2-32/2-32-workspace-command-1786838400000-backfill-missing-label-identifier-view-fields.command';
import { MakeRequiredFieldsWithoutDefaultsOptionalCommand } from 'src/database/commands/upgrade-version-command/2-32/2-32-workspace-command-1786900000000-make-required-fields-without-defaults-optional.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceMigrationRunnerModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/workspace-migration-runner.module';
import { WorkspaceMigrationModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration.module';
import { ConnectionModule } from 'src/modules/connection/connection.module';

// Every fork-authored workspace upgrade command lives here instead of the
// per-version modules, which upstream edits every release; keeping fork
// registrations out of those files removes the recurring weekly sync
// conflict. Version gating is unchanged: it comes from each command's
// @RegisteredWorkspaceCommand decorator, not from which module provides it.
@Module({
  imports: [
    ApplicationModule,
    ConnectionModule,
    TypeOrmModule.forFeature([FieldMetadataEntity]),
    WorkspaceCacheModule,
    WorkspaceIteratorModule,
    WorkspaceMigrationModule,
    WorkspaceMigrationRunnerModule,
  ],
  providers: [
    ProvisionMessageCampaignStandardMetadataCommand,
    ProvisionAndBackfillPersonOpenTaskCountCommand,
    SetConnectionJunctionTargetsCommand,
    DefaultConnectionTypeToRelationshipCommand,
    AddConnectionIsReciprocalFieldCommand,
    BackfillConnectionReciprocalsCommand,
    HidePersonConnectedFromViewFieldCommand,
    HideReciprocalsFromConnectionsViewCommand,
    AddComposeEmailToRelatedPeopleCommandMenuItemCommand,
    MakeRequiredFieldsWithoutDefaultsOptionalCommand,
    BackfillMissingLabelIdentifierViewFieldsCommand,
  ],
})
export class ForkWorkspaceCommandsModule {}

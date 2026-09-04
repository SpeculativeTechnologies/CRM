import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { ForkMissedWorkspaceCommandsService } from 'src/engine/core-modules/upgrade/services/fork-missed-workspace-commands.service';
import { UpgradeMigrationEntity } from 'src/engine/core-modules/upgrade/upgrade-migration.entity';

// Separate from UpgradeModule so the fork command module can import it without
// a cycle: UpgradeModule already imports the module that registers fork commands.
@Module({
  imports: [
    TypeOrmModule.forFeature([UpgradeMigrationEntity]),
    WorkspaceIteratorModule,
  ],
  providers: [ForkMissedWorkspaceCommandsService],
  exports: [ForkMissedWorkspaceCommandsService],
})
export class ForkMissedWorkspaceCommandsModule {}

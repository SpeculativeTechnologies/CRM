import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.27.0', 1785848976994)
export class AddRoleRecordScopeFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "core"."roleRecordScope" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "roleId" uuid NOT NULL, "objectMetadataId" uuid NOT NULL, "filter" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "IDX_ROLE_RECORD_SCOPE_WORKSPACE_ROLE_OBJECT_UNIQUE" UNIQUE ("workspaceId", "roleId", "objectMetadataId"), CONSTRAINT "PK_9a0f50f78625e4018ff173a0374" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ROLE_RECORD_SCOPE_WORKSPACE_ID_ROLE_ID" ON "core"."roleRecordScope" ("workspaceId", "roleId") ',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."roleRecordScope" ADD CONSTRAINT "FK_c043e4761c4ce34912614ff795d" FOREIGN KEY ("roleId") REFERENCES "core"."role"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."roleRecordScope" ADD CONSTRAINT "FK_8cceaf144f8817fe60793073f53" FOREIGN KEY ("objectMetadataId") REFERENCES "core"."objectMetadata"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "core"."roleRecordScope" DROP CONSTRAINT "FK_8cceaf144f8817fe60793073f53"',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."roleRecordScope" DROP CONSTRAINT "FK_c043e4761c4ce34912614ff795d"',
    );
    await queryRunner.query(
      'DROP INDEX "core"."IDX_ROLE_RECORD_SCOPE_WORKSPACE_ID_ROLE_ID"',
    );
    await queryRunner.query('DROP TABLE "core"."roleRecordScope"');
  }
}

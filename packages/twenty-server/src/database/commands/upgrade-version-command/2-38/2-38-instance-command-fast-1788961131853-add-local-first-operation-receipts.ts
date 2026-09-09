import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.38.0', 1788961131853)
export class AddLocalFirstOperationReceiptsFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "core"."localFirstOperation" ("workspaceId" uuid NOT NULL, "operationId" uuid NOT NULL, "userId" uuid NOT NULL, "requestHash" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_01f64d5ce2c9a0122abfb1c480c" PRIMARY KEY ("operationId", "userId"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_LOCAL_FIRST_OPERATION_WORKSPACE_ID" ON "core"."localFirstOperation" ("workspaceId") ',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."localFirstOperation" ADD CONSTRAINT "FK_5c9216b440bc4f10c33b7edaa4c" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "core"."localFirstOperation" DROP CONSTRAINT "FK_5c9216b440bc4f10c33b7edaa4c"',
    );
    await queryRunner.query(
      'DROP INDEX "core"."IDX_LOCAL_FIRST_OPERATION_WORKSPACE_ID"',
    );
    await queryRunner.query('DROP TABLE "core"."localFirstOperation"');
  }
}

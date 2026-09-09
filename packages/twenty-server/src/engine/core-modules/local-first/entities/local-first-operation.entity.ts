import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

// Receipts share the record mutation's transaction and have no expiry: an old
// device must never replay a previously committed edit after reconnecting.
@Entity({ name: 'localFirstOperation', schema: 'core' })
@Index('IDX_LOCAL_FIRST_OPERATION_WORKSPACE_ID', ['workspaceId'])
export class LocalFirstOperationEntity extends WorkspaceRelatedEntity {
  @PrimaryColumn({ type: 'uuid' })
  operationId: string;

  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

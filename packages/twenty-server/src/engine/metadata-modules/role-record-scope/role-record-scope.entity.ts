import { type RecordGqlOperationFilter } from 'twenty-shared/types';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';

// Restricts a role to the subset of an object's records matching `filter`.
// The filter uses the same shape the GraphQL API accepts for record queries,
// so it is translated by the standard filter parser at query time.
@Entity({ name: 'roleRecordScope', schema: 'core' })
@Unique('IDX_ROLE_RECORD_SCOPE_WORKSPACE_ROLE_OBJECT_UNIQUE', [
  'workspaceId',
  'roleId',
  'objectMetadataId',
])
@Index('IDX_ROLE_RECORD_SCOPE_WORKSPACE_ID_ROLE_ID', ['workspaceId', 'roleId'])
export class RoleRecordScopeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @Column({ nullable: false, type: 'uuid' })
  roleId: string;

  @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Relation<RoleEntity>;

  @Column({ nullable: false, type: 'uuid' })
  objectMetadataId: string;

  @ManyToOne(() => ObjectMetadataEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'objectMetadataId' })
  objectMetadata: Relation<ObjectMetadataEntity>;

  @Column({ nullable: false, type: 'jsonb' })
  filter: RecordGqlOperationFilter;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}

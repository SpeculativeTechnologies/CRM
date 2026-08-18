import { FieldMetadataType } from 'twenty-shared/types';

import { findConflictingRecord } from 'src/engine/api/graphql/workspace-query-runner/utils/find-conflicting-record.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';
import { type WorkspaceEntityManager } from 'src/engine/twenty-orm/entity-manager/workspace-entity-manager';

const OBJECT_METADATA_ID = '11111111-1111-1111-1111-111111111111';
const EMAILS_FIELD_METADATA_ID = '22222222-2222-2222-2222-222222222222';
const CONFLICTING_RECORD_ID = '33333333-3333-3333-3333-333333333333';

const flatObjectMetadata = {
  id: OBJECT_METADATA_ID,
  nameSingular: 'person',
  fieldIds: [EMAILS_FIELD_METADATA_ID],
} as unknown as FlatObjectMetadata;

const buildFlatFieldMetadataMaps = ({
  isUnique,
}: {
  isUnique: boolean;
}): FlatEntityMaps<FlatFieldMetadata> =>
  ({
    byUniversalIdentifier: {
      [EMAILS_FIELD_METADATA_ID]: {
        id: EMAILS_FIELD_METADATA_ID,
        universalIdentifier: EMAILS_FIELD_METADATA_ID,
        name: 'emails',
        label: 'Emails',
        type: FieldMetadataType.EMAILS,
        isUnique,
      },
    },
    universalIdentifierById: {
      [EMAILS_FIELD_METADATA_ID]: EMAILS_FIELD_METADATA_ID,
    },
    universalIdentifiersByApplicationId: {},
  }) as unknown as FlatEntityMaps<FlatFieldMetadata>;

const buildFlatIndexMaps = (
  flatIndexes: Partial<FlatIndexMetadata>[],
): FlatEntityMaps<FlatIndexMetadata> =>
  ({
    byUniversalIdentifier: Object.fromEntries(
      flatIndexes.map((flatIndex, index) => [`index-${index}`, flatIndex]),
    ),
    universalIdentifierById: {},
    universalIdentifiersByApplicationId: {},
  }) as unknown as FlatEntityMaps<FlatIndexMetadata>;

const buildInternalContext = ({
  flatFieldMetadataMaps,
  flatIndexMaps,
}: {
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  flatIndexMaps: FlatEntityMaps<FlatIndexMetadata>;
}): WorkspaceInternalContext =>
  ({
    flatFieldMetadataMaps,
    flatIndexMaps,
  }) as unknown as WorkspaceInternalContext;

const buildEntityManager = (
  conflictingRecord: { id: string } | null,
): WorkspaceEntityManager => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(conflictingRecord),
  };

  return {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  } as unknown as WorkspaceEntityManager;
};

const uniqueEmailsIndex: Partial<FlatIndexMetadata> = {
  isUnique: true,
  objectMetadataId: OBJECT_METADATA_ID,
  flatIndexFieldMetadatas: [
    { fieldMetadataId: EMAILS_FIELD_METADATA_ID },
  ] as FlatIndexMetadata['flatIndexFieldMetadatas'],
};

describe('findConflictingRecord', () => {
  it('resolves the conflicting record when the field metadata is flagged unique', async () => {
    const result = await findConflictingRecord(
      'emailsPrimaryEmail',
      'duplicate@example.com',
      flatObjectMetadata,
      buildInternalContext({
        flatFieldMetadataMaps: buildFlatFieldMetadataMaps({ isUnique: true }),
        flatIndexMaps: buildFlatIndexMaps([]),
      }),
      buildEntityManager({ id: CONFLICTING_RECORD_ID }),
    );

    expect(result).toEqual({
      conflictingRecordId: CONFLICTING_RECORD_ID,
      fieldLabel: 'Emails',
    });
  });

  it('resolves the conflicting record when only a unique index backs the field', async () => {
    const result = await findConflictingRecord(
      'emailsPrimaryEmail',
      'duplicate@example.com',
      flatObjectMetadata,
      buildInternalContext({
        flatFieldMetadataMaps: buildFlatFieldMetadataMaps({ isUnique: false }),
        flatIndexMaps: buildFlatIndexMaps([uniqueEmailsIndex]),
      }),
      buildEntityManager({ id: CONFLICTING_RECORD_ID }),
    );

    expect(result).toEqual({
      conflictingRecordId: CONFLICTING_RECORD_ID,
      fieldLabel: 'Emails',
    });
  });

  it('ignores unique indexes belonging to another object', async () => {
    const result = await findConflictingRecord(
      'emailsPrimaryEmail',
      'duplicate@example.com',
      flatObjectMetadata,
      buildInternalContext({
        flatFieldMetadataMaps: buildFlatFieldMetadataMaps({ isUnique: false }),
        flatIndexMaps: buildFlatIndexMaps([
          { ...uniqueEmailsIndex, objectMetadataId: 'another-object-id' },
        ]),
      }),
      buildEntityManager({ id: CONFLICTING_RECORD_ID }),
    );

    expect(result).toBeNull();
  });

  it('ignores multi-column unique indexes', async () => {
    const result = await findConflictingRecord(
      'emailsPrimaryEmail',
      'duplicate@example.com',
      flatObjectMetadata,
      buildInternalContext({
        flatFieldMetadataMaps: buildFlatFieldMetadataMaps({ isUnique: false }),
        flatIndexMaps: buildFlatIndexMaps([
          {
            ...uniqueEmailsIndex,
            flatIndexFieldMetadatas: [
              { fieldMetadataId: EMAILS_FIELD_METADATA_ID },
              { fieldMetadataId: 'another-field-id' },
            ] as FlatIndexMetadata['flatIndexFieldMetadatas'],
          },
        ]),
      }),
      buildEntityManager({ id: CONFLICTING_RECORD_ID }),
    );

    expect(result).toBeNull();
  });

  it('ignores non-unique indexes', async () => {
    const result = await findConflictingRecord(
      'emailsPrimaryEmail',
      'duplicate@example.com',
      flatObjectMetadata,
      buildInternalContext({
        flatFieldMetadataMaps: buildFlatFieldMetadataMaps({ isUnique: false }),
        flatIndexMaps: buildFlatIndexMaps([
          { ...uniqueEmailsIndex, isUnique: false },
        ]),
      }),
      buildEntityManager({ id: CONFLICTING_RECORD_ID }),
    );

    expect(result).toBeNull();
  });

  it('returns null when the conflicting record is soft deleted and no longer readable', async () => {
    const result = await findConflictingRecord(
      'emailsPrimaryEmail',
      'duplicate@example.com',
      flatObjectMetadata,
      buildInternalContext({
        flatFieldMetadataMaps: buildFlatFieldMetadataMaps({ isUnique: false }),
        flatIndexMaps: buildFlatIndexMaps([uniqueEmailsIndex]),
      }),
      buildEntityManager(null),
    );

    expect(result).toBeNull();
  });
});

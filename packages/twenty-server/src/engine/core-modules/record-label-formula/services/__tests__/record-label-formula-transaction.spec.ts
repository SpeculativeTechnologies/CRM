import { FieldMetadataType } from 'twenty-shared/types';

import { RecordLabelFormulaRelationService } from 'src/engine/core-modules/record-label-formula/services/record-label-formula-relation.service';
import { RecordLabelFormulaService } from 'src/engine/core-modules/record-label-formula/services/record-label-formula.service';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type OrmFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/orm-flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

const SOURCE_FIELD = {
  id: 'source',
  universalIdentifier: 'source',
  type: FieldMetadataType.TEXT,
  name: 'jobTitle',
} as OrmFlatFieldMetadata;
const LABEL_FIELD = {
  id: 'label',
  universalIdentifier: 'label',
  type: FieldMetadataType.TEXT,
  name: 'name',
  settings: {
    labelIdentifierFormula: {
      template: '{0}',
      fieldReferences: [{ fieldMetadataUniversalIdentifiers: ['source'] }],
    },
  },
} as OrmFlatFieldMetadata;
const OBJECT = {
  id: 'object',
  nameSingular: 'example',
  labelIdentifierFieldMetadataId: 'label',
} as FlatObjectMetadata;
const FIELD_MAPS = {
  byUniversalIdentifier: { source: SOURCE_FIELD, label: LABEL_FIELD },
  universalIdentifierById: { source: 'source', label: 'label' },
  universalIdentifiersByApplicationId: {},
} as FlatEntityMaps<OrmFlatFieldMetadata>;
const OBJECT_MAPS = {
  byUniversalIdentifier: { object: OBJECT },
  universalIdentifierById: { object: 'object' },
  universalIdentifiersByApplicationId: {},
} as FlatEntityMaps<FlatObjectMetadata>;

describe('label recomputation inside a record transaction', () => {
  it('should derive and write the label from the uncommitted value on the same connection', async () => {
    const ordinaryRepository = {
      find: jest.fn(async () => [
        { id: 'record', jobTitle: 'Old committed title' },
      ]),
      updateMany: jest.fn(),
    };
    const transactionRepository = {
      find: jest.fn(async () => [{ id: 'record', jobTitle: 'New local edit' }]),
      updateMany: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn(() => ordinaryRepository),
    } as unknown as WorkspaceOrmManager;
    const transactionScope = {
      getRepository: jest.fn(() => transactionRepository),
    } as unknown as WorkspaceTransactionScope;
    const relations = new RecordLabelFormulaRelationService(manager);
    const service = new RecordLabelFormulaService(
      manager,
      {} as WorkspaceCacheService,
      relations,
    );

    const labels = await service.recomputeAffectedRecordLabels({
      flatFieldMetadataMaps: FIELD_MAPS,
      flatObjectMetadata: OBJECT,
      flatObjectMetadataMaps: OBJECT_MAPS,
      recordIds: ['record'],
      transactionScope,
    });

    expect(labels.get('record')).toBe('New local edit');
    expect(transactionRepository.updateMany).toHaveBeenCalledWith([
      { criteria: 'record', partialEntity: { name: 'New local edit' } },
    ]);
    expect(ordinaryRepository.find).not.toHaveBeenCalled();
    expect(ordinaryRepository.updateMany).not.toHaveBeenCalled();
  });

  it('should retain the ordinary repository behavior outside a transaction', async () => {
    const repository = {
      find: jest.fn(async () => [
        { id: 'record', jobTitle: 'Committed title' },
      ]),
      updateMany: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn(() => repository),
    } as unknown as WorkspaceOrmManager;
    const service = new RecordLabelFormulaService(
      manager,
      {} as WorkspaceCacheService,
      new RecordLabelFormulaRelationService(manager),
    );
    const labels = await service.recomputeAffectedRecordLabels({
      flatFieldMetadataMaps: FIELD_MAPS,
      flatObjectMetadata: OBJECT,
      flatObjectMetadataMaps: OBJECT_MAPS,
      recordIds: ['record'],
    });
    expect(labels.get('record')).toBe('Committed title');
    expect(repository.updateMany).toHaveBeenCalledWith([
      { criteria: 'record', partialEntity: { name: 'Committed title' } },
    ]);
  });
});

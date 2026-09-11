import { FieldViewDependenciesOnDeleteSideEffectHandlerService } from 'src/engine/metadata-modules/metadata-side-effect/handlers/field-metadata/services/field-view-dependencies-on-delete-side-effect-handler.service';
import { type BuildSideEffectsArgs } from 'src/engine/metadata-modules/metadata-side-effect/interfaces/base-metadata-side-effect-handler.service';

const args = (
  settings: object | null = null,
): BuildSideEffectsArgs<'fieldMetadata'> =>
  ({
    flatEntity: {
      universalIdentifier: 'deleted-field',
      settings,
      viewSortUniversalIdentifiers: ['sort-a', 'sort-b', 'missing-sort'],
      viewFilterUniversalIdentifiers: ['filter'],
      viewFieldUniversalIdentifiers: ['column', 'system-column'],
    },
    relatedFlatEntityMaps: {
      flatViewSortMaps: {
        byUniversalIdentifier: {
          'sort-a': {
            universalIdentifier: 'sort-a',
            viewUniversalIdentifier: 'view-a',
          },
          'sort-b': {
            universalIdentifier: 'sort-b',
            viewUniversalIdentifier: 'view-b',
          },
          unrelated: { universalIdentifier: 'unrelated' },
        },
      },
      flatViewFilterMaps: {
        byUniversalIdentifier: {
          filter: { universalIdentifier: 'filter' },
          unrelated: { universalIdentifier: 'unrelated' },
        },
      },
      flatViewFieldMaps: {
        byUniversalIdentifier: {
          column: { universalIdentifier: 'column', isSystemSideEffect: false },
          'system-column': {
            universalIdentifier: 'system-column',
            isSystemSideEffect: true,
          },
          unrelated: {
            universalIdentifier: 'unrelated',
            isSystemSideEffect: false,
          },
        },
      },
    },
  }) as unknown as BuildSideEffectsArgs<'fieldMetadata'>;

describe('FieldViewDependenciesOnDeleteSideEffectHandlerService', () => {
  const handler = new FieldViewDependenciesOnDeleteSideEffectHandlerService();

  it.each([
    null,
    {
      linkedField: {
        relationFieldMetadataUniversalIdentifier: 'person',
        sourceFieldMetadataUniversalIdentifier: 'recommendations',
      },
    },
  ])(
    'should explicitly remove dependent view metadata for ordinary and linked fields (%p)',
    (settings) => {
      const input = args(settings);
      const result = handler.buildSideEffects(input);
      expect(result).toEqual({
        status: 'success',
        operations: {
          viewSort: {
            flatEntityToDelete: {
              'sort-a': {
                universalIdentifier: 'sort-a',
                viewUniversalIdentifier: 'view-a',
              },
              'sort-b': {
                universalIdentifier: 'sort-b',
                viewUniversalIdentifier: 'view-b',
              },
            },
          },
          viewFilter: {
            flatEntityToDelete: { filter: { universalIdentifier: 'filter' } },
          },
          viewField: {
            flatEntityToDelete: {
              column: {
                universalIdentifier: 'column',
                isSystemSideEffect: false,
              },
            },
          },
        },
      });
      // The caller's maps remain intact until the engine applies the migration.
      expect(
        input.relatedFlatEntityMaps.flatViewSortMaps.byUniversalIdentifier[
          'sort-a'
        ],
      ).toBeDefined();
    },
  );

  it('should leave unrelated views alone when a field has no remaining dependencies', () => {
    const input = args();
    input.flatEntity.viewSortUniversalIdentifiers = [];
    input.flatEntity.viewFilterUniversalIdentifiers = [];
    input.flatEntity.viewFieldUniversalIdentifiers = ['system-column'];
    expect(handler.buildSideEffects(input)).toEqual({ status: 'noop' });
  });
});

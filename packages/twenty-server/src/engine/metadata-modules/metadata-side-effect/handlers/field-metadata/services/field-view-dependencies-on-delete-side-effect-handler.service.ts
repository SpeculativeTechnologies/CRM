import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

import { type MetadataUniversalFlatEntity } from 'src/engine/metadata-modules/flat-entity/types/metadata-universal-flat-entity.type';
import {
  type BuildSideEffectsArgs,
  MetadataSideEffectHandler,
} from 'src/engine/metadata-modules/metadata-side-effect/interfaces/base-metadata-side-effect-handler.service';
import { type MetadataSideEffectResult } from 'src/engine/metadata-modules/metadata-side-effect/types/metadata-side-effect-result.type';

@Injectable()
export class FieldViewDependenciesOnDeleteSideEffectHandlerService extends MetadataSideEffectHandler(
  {
    operation: 'delete',
    metadataName: 'fieldMetadata',
    name: 'fieldViewDependenciesOnDelete',
    description:
      'Delete saved sorts, filters and caller-authored view fields with their field. Explicit operations keep metadata caches and events consistent with the database foreign-key cascades. Engine-owned view fields are handled by fieldSystemViewFieldsOnDelete.',
  },
) {
  buildSideEffects({
    flatEntity,
    relatedFlatEntityMaps,
  }: BuildSideEffectsArgs<'fieldMetadata'>): MetadataSideEffectResult {
    const viewSorts = flatEntity.viewSortUniversalIdentifiers
      .map(
        (id) =>
          relatedFlatEntityMaps.flatViewSortMaps.byUniversalIdentifier[id],
      )
      .filter(isDefined);
    const viewFilters = flatEntity.viewFilterUniversalIdentifiers
      .map(
        (id) =>
          relatedFlatEntityMaps.flatViewFilterMaps.byUniversalIdentifier[id],
      )
      .filter(isDefined);
    const viewFields = flatEntity.viewFieldUniversalIdentifiers
      .map(
        (id) =>
          relatedFlatEntityMaps.flatViewFieldMaps.byUniversalIdentifier[id],
      )
      .filter(isDefined)
      .filter((field) => field.isSystemSideEffect !== true);

    if (viewSorts.length + viewFilters.length + viewFields.length === 0) {
      return { status: 'noop' };
    }

    const toDeleteRecord = <T extends 'viewSort' | 'viewFilter' | 'viewField'>(
      entities: MetadataUniversalFlatEntity<T>[],
    ) =>
      Object.fromEntries(
        entities.map((entity) => [entity.universalIdentifier, entity]),
      );

    return {
      status: 'success',
      operations: {
        viewSort: { flatEntityToDelete: toDeleteRecord<'viewSort'>(viewSorts) },
        viewFilter: {
          flatEntityToDelete: toDeleteRecord<'viewFilter'>(viewFilters),
        },
        viewField: {
          flatEntityToDelete: toDeleteRecord<'viewField'>(viewFields),
        },
      },
    };
  }
}

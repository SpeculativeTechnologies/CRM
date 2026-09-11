import { isFlatFieldMetadataOfType } from 'src/engine/metadata-modules/flat-field-metadata/utils/is-flat-field-metadata-of-type.util';
import {
  FieldMetadataType,
  RelationType,
  type ObjectsPermissions,
} from 'twenty-shared/types';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

import { type ObjectRecordOrderBy } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';

import {
  buildOrderByColumnExpression,
  shouldCastToText,
  shouldUseCaseInsensitiveOrder,
} from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/build-order-by-column-expression.util';
import { convertOrderByToFindOptionsOrder } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/convert-order-by-to-find-options-order';
import { computeOrderByLeafColumn } from 'src/engine/api/utils/compute-order-by-leaf-column.util';
import { resolveOrderByLeaves } from 'src/engine/api/utils/resolve-order-by-leaves.utils';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type OrmFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/orm-flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

import { type OrderByClause } from './types/order-by-condition.type';
import { type ParseOrderByResult } from './types/parse-order-by-result.type';
import { type RelationJoinInfo } from './types/relation-join-info.type';

// Re-export types for backward compatibility
export { OrderByClause, ParseOrderByResult, RelationJoinInfo };

// Compiles SQL ORDER BY clauses from the resolved orderBy leaves: walking,
// validation and permission checks live in resolveOrderByLeaves, shared with
// column selection and the cursor utilities, so the scan order can never
// diverge from what cursors continue.
export class GraphqlQueryOrderFieldParser {
  private flatObjectMetadata: FlatObjectMetadata;
  private flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  private flatFieldMetadataMaps: FlatEntityMaps<OrmFlatFieldMetadata>;

  constructor(
    flatObjectMetadata: FlatObjectMetadata,
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>,
    flatFieldMetadataMaps: FlatEntityMaps<OrmFlatFieldMetadata>,
  ) {
    this.flatObjectMetadata = flatObjectMetadata;
    this.flatObjectMetadataMaps = flatObjectMetadataMaps;
    this.flatFieldMetadataMaps = flatFieldMetadataMaps;
  }

  parse(
    orderBy: ObjectRecordOrderBy,
    objectNameSingular: string,
    isForwardPagination = true,
    objectsPermissions?: ObjectsPermissions,
  ): ParseOrderByResult {
    const orderByConditions: Record<string, OrderByClause> = {};
    const relationJoins: RelationJoinInfo[] = [];
    const addedJoinAliases = new Set<string>();

    const orderByLeaves = resolveOrderByLeaves({
      orderBy,
      flatObjectMetadata: this.flatObjectMetadata,
      flatObjectMetadataMaps: this.flatObjectMetadataMaps,
      flatFieldMetadataMaps: this.flatFieldMetadataMaps,
      strictValidation: true,
      objectsPermissions,
    });

    for (const orderByLeaf of orderByLeaves) {
      const leafColumn = computeOrderByLeafColumn(
        orderByLeaf,
        objectNameSingular,
      );

      if (!isDefined(leafColumn)) {
        continue;
      }

      if (
        orderByLeaf.kind === 'relation' &&
        !addedJoinAliases.has(leafColumn.tableAlias)
      ) {
        relationJoins.push({ joinAlias: leafColumn.tableAlias });
        addedJoinAliases.add(leafColumn.tableAlias);
      }

      if (
        orderByLeaf.kind === 'relation' &&
        isFlatFieldMetadataOfType(
          orderByLeaf.fieldMetadata,
          FieldMetadataType.RELATION,
        ) &&
        orderByLeaf.fieldMetadata.settings?.relationType ===
          RelationType.ONE_TO_MANY &&
        isDefined(getLinkedFieldReference(orderByLeaf.fieldMetadata.settings))
      ) {
        const join = relationJoins.find(
          (candidate) => candidate.joinAlias === leafColumn.tableAlias,
        );
        if (isDefined(join)) {
          // Keep the representative target stable when paging backwards.
          const targetOrder = convertOrderByToFindOptionsOrder(
            orderByLeaf.direction,
          );
          join.toManyDedupOrder ??= [];
          join.toManyDedupOrder.push({
            columnName: leafColumn.columnName,
            direction: targetOrder.order,
            nulls: targetOrder.nulls,
            useLower: shouldUseCaseInsensitiveOrder(leafColumn.columnType),
            castToText: shouldCastToText(leafColumn.columnType),
          });
        }
      }

      orderByConditions[
        buildOrderByColumnExpression(
          leafColumn.tableAlias,
          leafColumn.columnName,
        )
      ] = {
        ...convertOrderByToFindOptionsOrder(
          orderByLeaf.direction,
          isForwardPagination,
        ),
        useLower: shouldUseCaseInsensitiveOrder(leafColumn.columnType),
        castToText: shouldCastToText(leafColumn.columnType),
      };
    }

    return {
      orderBy: orderByConditions,
      relationJoins,
    };
  }
}

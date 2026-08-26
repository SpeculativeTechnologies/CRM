import {
  LOCAL_FIRST_RELATION_SOURCES,
  type LocalFirstRelationSource,
} from '@/local-first/constants/LOCAL_FIRST_RELATION_SOURCES';
import { isDefined } from 'twenty-shared/utils';

import { type RequestedNodeField } from '@/local-first/utils/extractRequestedNodeFields';
import {
  type LocalFieldSource,
  resolveLocalFieldSource,
} from '@/local-first/utils/resolveLocalFieldSource';

export type PlannedScalarField = {
  name: string;
  source: LocalFieldSource;
};

export type PlannedCompositeField = {
  name: string;
  subFields: PlannedScalarField[];
};

export type PlannedRelation = {
  name: string;
  source: LocalFirstRelationSource;
  plan: LocalReadPlan;
};

export type LocalReadPlan = {
  table: string;
  typeName: string;
  // Every column the plan needs to select, including relation foreign keys.
  columns: string[];
  scalarFields: PlannedScalarField[];
  compositeFields: PlannedCompositeField[];
  relations: PlannedRelation[];
};

export type LocalReadPlanResult =
  | { isSupported: true; plan: LocalReadPlan }
  | { isSupported: false; reason: string };

const TYPE_NAME_BY_TABLE: Record<string, string> = {
  person: 'Person',
  company: 'Company',
  _pet: 'Pet',
  _petCareAgreement: 'PetCareAgreement',
  _employmentHistory: 'EmploymentHistory',
};

// The selection a relation's records were asked for. A to-one relation whose
// selection happens to be scalars only is indistinguishable from a composite
// in the query document, so the declared relation map decides which it is and
// this reads the node fields out of whichever shape the parser produced.
const toRelationNodeFields = (
  field: RequestedNodeField,
): RequestedNodeField[] =>
  field.relation
    ? field.relation.nodeFields
    : field.subFields.map((name) => ({
        name,
        subFields: [],
        relation: null,
      }));

// Turns a query's selection into an executable plan against the local mirror,
// or refuses. Refusing is the load-bearing half: a plan that guessed at a
// field or relation it does not understand would serve wrong records, which is
// worse than falling back to the network.
export const buildLocalReadPlan = ({
  table,
  requestedFields,
  columnsByTable,
}: {
  table: string;
  requestedFields: RequestedNodeField[];
  columnsByTable: Record<string, readonly string[]>;
}): LocalReadPlanResult => {
  const tableColumns = columnsByTable[table];

  if (!isDefined(tableColumns)) {
    return { isSupported: false, reason: `table "${table}" is not mirrored` };
  }

  if (requestedFields.length === 0) {
    return { isSupported: false, reason: 'no fields parsed from the query' };
  }

  const typeName = TYPE_NAME_BY_TABLE[table];

  if (!isDefined(typeName)) {
    return { isSupported: false, reason: `no type name known for "${table}"` };
  }

  const availableColumns = new Set(tableColumns);
  const columns = new Set<string>(['id']);
  const scalarFields: PlannedScalarField[] = [];
  const compositeFields: PlannedCompositeField[] = [];
  const relations: PlannedRelation[] = [];

  for (const field of requestedFields) {
    const relationSource =
      LOCAL_FIRST_RELATION_SOURCES[`${table}.${field.name}`];

    if (isDefined(relationSource)) {
      const nestedPlan = buildLocalReadPlan({
        table: relationSource.targetTable,
        requestedFields: toRelationNodeFields(field),
        columnsByTable,
      });

      if (!nestedPlan.isSupported) {
        return {
          isSupported: false,
          reason: `${field.name}: ${nestedPlan.reason}`,
        };
      }

      if (relationSource.kind === 'toOne') {
        if (!availableColumns.has(relationSource.foreignKeyColumn)) {
          return {
            isSupported: false,
            reason: `${field.name}: missing ${relationSource.foreignKeyColumn}`,
          };
        }

        columns.add(relationSource.foreignKeyColumn);
      }

      relations.push({
        name: field.name,
        source: relationSource,
        plan: nestedPlan.plan,
      });

      continue;
    }

    // Anything with sub-selections that is not a declared relation must be a
    // composite; a relation this code does not know about has to be refused.
    if (field.relation) {
      return {
        isSupported: false,
        reason: `${field.name} is an unknown relation`,
      };
    }

    if (field.subFields.length === 0) {
      const source = resolveLocalFieldSource({
        fieldName: field.name,
        syncedColumns: availableColumns,
      });

      if (!source) {
        return { isSupported: false, reason: `${field.name} is not mirrored` };
      }

      columns.add(source.column);
      scalarFields.push({ name: field.name, source });

      continue;
    }

    const subFields: PlannedScalarField[] = [];

    for (const subFieldName of field.subFields) {
      const source = resolveLocalFieldSource({
        fieldName: field.name,
        subFieldName,
        syncedColumns: availableColumns,
      });

      if (!source) {
        return {
          isSupported: false,
          reason: `${field.name}.${subFieldName} is not mirrored`,
        };
      }

      columns.add(source.column);
      subFields.push({ name: subFieldName, source });
    }

    compositeFields.push({ name: field.name, subFields });
  }

  return {
    isSupported: true,
    plan: {
      table,
      typeName,
      columns: [...columns],
      scalarFields,
      compositeFields,
      relations,
    },
  };
};

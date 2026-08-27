import { type DocumentNode, Kind, type SelectionSetNode } from 'graphql';

export type RequestedRelation = {
  // 'toOne' selects the related record directly; 'toMany' wraps it in a
  // connection (edges { node { ... } }).
  kind: 'toOne' | 'toMany';
  // Fields requested on the related record, in the same shape as the root.
  nodeFields: RequestedNodeField[];
};

export type RequestedNodeField = {
  name: string;
  // Sub-selections of a composite, e.g. name { firstName lastName }. Empty
  // for scalars and for relations.
  subFields: string[];
  // Set when this field is a relation rather than a composite.
  relation: RequestedRelation | null;
};

const findFieldSelectionSet = (
  selectionSet: SelectionSetNode | undefined,
  fieldName: string,
): SelectionSetNode | undefined => {
  if (!selectionSet) return undefined;

  for (const selection of selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    if (selection.name.value === fieldName) return selection.selectionSet;
  }

  return undefined;
};

const isDataField = (name: string) => !name.startsWith('__');

const readSelectionFields = (
  selectionSet: SelectionSetNode | undefined,
): RequestedNodeField[] => {
  if (!selectionSet) return [];

  const fields: RequestedNodeField[] = [];

  for (const selection of selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    if (!isDataField(selection.name.value)) continue;

    const subSelectionSet = selection.selectionSet;

    if (!subSelectionSet) {
      fields.push({
        name: selection.name.value,
        subFields: [],
        relation: null,
      });
      continue;
    }

    // A connection: the relation's records live under edges { node { ... } }.
    const connectionNodeSelectionSet = findFieldSelectionSet(
      findFieldSelectionSet(subSelectionSet, 'edges'),
      'node',
    );

    if (connectionNodeSelectionSet) {
      fields.push({
        name: selection.name.value,
        subFields: [],
        relation: {
          kind: 'toMany',
          nodeFields: readSelectionFields(connectionNodeSelectionSet),
        },
      });
      continue;
    }

    const subFields = subSelectionSet.selections
      .filter((sub) => sub.kind === Kind.FIELD)
      .map((sub) => (sub as { name: { value: string } }).name.value)
      .filter(isDataField);

    // A composite is one level deep and flattens onto columns; anything with
    // deeper selections is a to-one relation to another record.
    const hasDeeperSelections = subSelectionSet.selections.some(
      (sub) => sub.kind === Kind.FIELD && isDefinedSelectionSet(sub),
    );

    if (hasDeeperSelections) {
      fields.push({
        name: selection.name.value,
        subFields: [],
        relation: {
          kind: 'toOne',
          nodeFields: readSelectionFields(subSelectionSet),
        },
      });
      continue;
    }

    fields.push({ name: selection.name.value, subFields, relation: null });
  }

  return fields;
};

const isDefinedSelectionSet = (selection: {
  selectionSet?: SelectionSetNode;
}) => selection.selectionSet !== undefined;

// Reads the fields a list query asks for on each record, so a local read can
// refuse any query whose selection it cannot fully answer. Returns [] when the
// document does not have the expected connection shape, which callers must
// treat as "cannot serve locally".
export const extractRequestedNodeFields = ({
  query,
  listFieldName,
}: {
  query: DocumentNode;
  listFieldName: string;
}): RequestedNodeField[] => {
  for (const definition of query.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;

    const nodeSelectionSet = findFieldSelectionSet(
      findFieldSelectionSet(
        findFieldSelectionSet(definition.selectionSet, listFieldName),
        'edges',
      ),
      'node',
    );

    if (!nodeSelectionSet) continue;

    return readSelectionFields(nodeSelectionSet);
  }

  return [];
};

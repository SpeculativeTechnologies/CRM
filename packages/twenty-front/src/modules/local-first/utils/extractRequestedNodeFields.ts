import { type DocumentNode, Kind, type SelectionSetNode } from 'graphql';

export type RequestedNodeField = {
  name: string;
  // Sub-selections, e.g. name { firstName lastName }. Empty for scalars.
  subFields: string[];
  // A sub-selection that itself has sub-selections is a relation, not a
  // composite: composites are one level deep and flatten onto columns.
  hasNestedSelections: boolean;
};

const findFieldSelectionSet = (
  selectionSet: SelectionSetNode | undefined,
  fieldName: string,
): SelectionSetNode | undefined => {
  if (!selectionSet) return undefined;

  for (const selection of selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue;

    if (selection.name.value === fieldName) {
      return selection.selectionSet;
    }
  }

  return undefined;
};

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

    const listSelectionSet = findFieldSelectionSet(
      definition.selectionSet,
      listFieldName,
    );
    const edgesSelectionSet = findFieldSelectionSet(listSelectionSet, 'edges');
    const nodeSelectionSet = findFieldSelectionSet(edgesSelectionSet, 'node');

    if (!nodeSelectionSet) continue;

    const fields: RequestedNodeField[] = [];

    for (const selection of nodeSelectionSet.selections) {
      if (selection.kind !== Kind.FIELD) continue;

      // __typename is added by Apollo and is not data.
      if (selection.name.value.startsWith('__')) continue;

      const subSelections = selection.selectionSet?.selections ?? [];
      const subFields: string[] = [];
      let hasNestedSelections = false;

      for (const subSelection of subSelections) {
        if (subSelection.kind !== Kind.FIELD) continue;
        if (subSelection.name.value.startsWith('__')) continue;

        subFields.push(subSelection.name.value);

        if (subSelection.selectionSet) {
          hasNestedSelections = true;
        }
      }

      fields.push({
        name: selection.name.value,
        subFields,
        hasNestedSelections,
      });
    }

    return fields;
  }

  return [];
};

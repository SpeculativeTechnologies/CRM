export const getQueryInvalidationEventName = (queryId: string): string =>
  `query-invalidation-${queryId}`;

export const dispatchQueryInvalidations = (
  queryIds: readonly string[],
): void => {
  for (const queryId of queryIds) {
    window.dispatchEvent(
      new CustomEvent(getQueryInvalidationEventName(queryId)),
    );
  }
};

export const getObjectFilterFields = (
  objectSingleName: string,
  hasPreferredName = false,
) => {
  if (['workspaceMember', 'person'].includes(objectSingleName)) {
    return [
      'name.firstName',
      'name.lastName',
      ...(objectSingleName === 'person' && hasPreferredName
        ? ['preferredName']
        : []),
    ];
  }

  return ['name'];
};

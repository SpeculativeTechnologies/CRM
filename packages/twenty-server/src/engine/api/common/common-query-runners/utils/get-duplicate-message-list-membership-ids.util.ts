import { isDefined } from 'twenty-shared/utils';

type MessageListMembership = {
  id: string;
  listId: string | null;
  personId: string | null;
};

export const getDuplicateMessageListMembershipIds = (
  memberships: MessageListMembership[],
  targetPersonId: string,
): string[] => {
  const membershipsByListId = new Map<string, MessageListMembership[]>();

  for (const membership of memberships) {
    if (!isDefined(membership.listId)) {
      continue;
    }

    const listMemberships = membershipsByListId.get(membership.listId) ?? [];

    listMemberships.push(membership);
    membershipsByListId.set(membership.listId, listMemberships);
  }

  return [...membershipsByListId.values()].flatMap((listMemberships) => {
    if (listMemberships.length < 2) {
      return [];
    }

    const membershipToKeep =
      listMemberships.find(
        (membership) => membership.personId === targetPersonId,
      ) ?? listMemberships[0];

    return listMemberships
      .filter((membership) => membership.id !== membershipToKeep.id)
      .map((membership) => membership.id);
  });
};

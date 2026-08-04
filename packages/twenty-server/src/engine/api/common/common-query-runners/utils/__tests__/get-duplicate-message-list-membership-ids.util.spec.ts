import { getDuplicateMessageListMembershipIds } from 'src/engine/api/common/common-query-runners/utils/get-duplicate-message-list-membership-ids.util';

describe('getDuplicateMessageListMembershipIds', () => {
  it('keeps the survivor membership when both people belong to the same list', () => {
    expect(
      getDuplicateMessageListMembershipIds(
        [
          { id: 'survivor', listId: 'list-1', personId: 'person-1' },
          { id: 'absorbed', listId: 'list-1', personId: 'person-2' },
        ],
        'person-1',
      ),
    ).toEqual(['absorbed']);
  });

  it('keeps one source membership when the survivor is not already a member', () => {
    expect(
      getDuplicateMessageListMembershipIds(
        [
          { id: 'source-1', listId: 'list-1', personId: 'person-2' },
          { id: 'source-2', listId: 'list-1', personId: 'person-3' },
        ],
        'person-1',
      ),
    ).toEqual(['source-2']);
  });

  it('does not remove memberships for different lists or without a list', () => {
    expect(
      getDuplicateMessageListMembershipIds(
        [
          { id: 'list-1', listId: 'list-1', personId: 'person-1' },
          { id: 'list-2', listId: 'list-2', personId: 'person-2' },
          { id: 'no-list', listId: null, personId: 'person-2' },
        ],
        'person-1',
      ),
    ).toEqual([]);
  });
});

import { getRecordIdsCollidingAfterRepoint } from 'src/engine/api/common/common-query-runners/utils/get-record-ids-colliding-after-repoint.util';

describe('getRecordIdsCollidingAfterRepoint', () => {
  const survivorCompanyId = 'survivor-company-id';
  const absorbedCompanyId = 'absorbed-company-id';
  const otherAbsorbedCompanyId = 'other-absorbed-company-id';

  it('should drop the absorbed row when the survivor already targets the same thread', () => {
    const recordIds = getRecordIdsCollidingAfterRepoint({
      records: [
        {
          id: 'survivor-target-id',
          messageThreadId: 'thread-id',
          targetCompanyId: survivorCompanyId,
        },
        {
          id: 'absorbed-target-id',
          messageThreadId: 'thread-id',
          targetCompanyId: absorbedCompanyId,
        },
      ],
      joinColumnName: 'targetCompanyId',
      partnerPaths: ['messageThreadId'],
      fromIds: [absorbedCompanyId],
      toId: survivorCompanyId,
    });

    expect(recordIds).toEqual(['absorbed-target-id']);
  });

  it('should keep the oldest absorbed row when the survivor has none', () => {
    const recordIds = getRecordIdsCollidingAfterRepoint({
      records: [
        {
          id: 'newer-absorbed-target-id',
          messageThreadId: 'thread-id',
          targetCompanyId: otherAbsorbedCompanyId,
          createdAt: '2026-02-01T00:00:00.000Z',
        },
        {
          id: 'older-absorbed-target-id',
          messageThreadId: 'thread-id',
          targetCompanyId: absorbedCompanyId,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      joinColumnName: 'targetCompanyId',
      partnerPaths: ['messageThreadId'],
      fromIds: [absorbedCompanyId, otherAbsorbedCompanyId],
      toId: survivorCompanyId,
    });

    expect(recordIds).toEqual(['newer-absorbed-target-id']);
  });

  it('should leave rows on different threads alone', () => {
    const recordIds = getRecordIdsCollidingAfterRepoint({
      records: [
        {
          id: 'survivor-target-id',
          messageThreadId: 'thread-id',
          targetCompanyId: survivorCompanyId,
        },
        {
          id: 'absorbed-target-id',
          messageThreadId: 'other-thread-id',
          targetCompanyId: absorbedCompanyId,
        },
      ],
      joinColumnName: 'targetCompanyId',
      partnerPaths: ['messageThreadId'],
      fromIds: [absorbedCompanyId],
      toId: survivorCompanyId,
    });

    expect(recordIds).toEqual([]);
  });

  it('should ignore rows pointing at unrelated records', () => {
    const recordIds = getRecordIdsCollidingAfterRepoint({
      records: [
        {
          id: 'unrelated-target-id',
          messageThreadId: 'thread-id',
          targetCompanyId: 'unrelated-company-id',
        },
        {
          id: 'absorbed-target-id',
          messageThreadId: 'thread-id',
          targetCompanyId: absorbedCompanyId,
        },
      ],
      joinColumnName: 'targetCompanyId',
      partnerPaths: ['messageThreadId'],
      fromIds: [absorbedCompanyId],
      toId: survivorCompanyId,
    });

    expect(recordIds).toEqual([]);
  });

  it('should never treat null partner values as colliding', () => {
    const recordIds = getRecordIdsCollidingAfterRepoint({
      records: [
        {
          id: 'survivor-target-id',
          messageThreadId: null,
          targetCompanyId: survivorCompanyId,
        },
        {
          id: 'absorbed-target-id',
          messageThreadId: null,
          targetCompanyId: absorbedCompanyId,
        },
      ],
      joinColumnName: 'targetCompanyId',
      partnerPaths: ['messageThreadId'],
      fromIds: [absorbedCompanyId],
      toId: survivorCompanyId,
    });

    expect(recordIds).toEqual([]);
  });

  it('should read composite partner values through their path', () => {
    const recordIds = getRecordIdsCollidingAfterRepoint({
      records: [
        {
          id: 'survivor-row-id',
          companyId: survivorCompanyId,
          externalRef: { primaryLinkUrl: 'ref.example.com' },
        },
        {
          id: 'absorbed-row-id',
          companyId: absorbedCompanyId,
          externalRef: { primaryLinkUrl: 'ref.example.com' },
        },
      ],
      joinColumnName: 'companyId',
      partnerPaths: ['externalRef.primaryLinkUrl'],
      fromIds: [absorbedCompanyId],
      toId: survivorCompanyId,
    });

    expect(recordIds).toEqual(['absorbed-row-id']);
  });
});

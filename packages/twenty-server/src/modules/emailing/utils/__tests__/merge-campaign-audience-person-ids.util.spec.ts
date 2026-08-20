import { mergeCampaignAudiencePersonIds } from 'src/modules/emailing/utils/merge-campaign-audience-person-ids.util';

describe('mergeCampaignAudiencePersonIds', () => {
  it('combines list members and individually selected people', () => {
    expect(mergeCampaignAudiencePersonIds(['person-1'], ['person-2'])).toEqual([
      'person-1',
      'person-2',
    ]);
  });

  it('does not duplicate a person selected directly and through a list', () => {
    expect(
      mergeCampaignAudiencePersonIds(
        ['person-1', 'person-2'],
        ['person-2', 'person-2'],
      ),
    ).toEqual(['person-1', 'person-2']);
  });

  it('supports an audience made only from selected people', () => {
    expect(mergeCampaignAudiencePersonIds([], ['person-1'])).toEqual([
      'person-1',
    ]);
  });
});

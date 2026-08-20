import {
  CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS,
  formatCampaignRate,
  getCampaignRecipientTrackingMessage,
  getCampaignTrackingPollInterval,
  isCampaignInFlight,
  isDraftCampaign,
  matchesCampaignRecipientStatus,
} from '@/activities/emails/utils/campaignDisplay';

const campaign = (status: string) => ({ status });

describe('campaignDisplay', () => {
  it('formats trustworthy delivery counts as rates with counts', () => {
    expect(formatCampaignRate(2, 8)).toBe('25% (2)');
    expect(formatCampaignRate(1, 3)).toBe('33.3% (1)');
    expect(formatCampaignRate(0, 0)).toBe('—');
  });

  it('only classifies DRAFT campaigns as drafts', () => {
    expect(isDraftCampaign(campaign('DRAFT'))).toBe(true);
    expect(isDraftCampaign(campaign('SENT'))).toBe(false);
    expect(isDraftCampaign(campaign('SENDING'))).toBe(false);
  });

  it('treats scheduled and sending campaigns as in flight', () => {
    expect(isCampaignInFlight(campaign('SENDING'))).toBe(true);
    expect(isCampaignInFlight(campaign('SCHEDULED'))).toBe(true);
    expect(isCampaignInFlight(campaign('DRAFT'))).toBe(false);
    expect(isCampaignInFlight(campaign('SENT'))).toBe(false);
    expect(isCampaignInFlight(campaign('SENT_WITH_ERRORS'))).toBe(false);
  });

  it('polls only while a campaign is in flight', () => {
    expect(
      getCampaignTrackingPollInterval([campaign('SENT'), campaign('DRAFT')]),
    ).toBe(0);
    expect(getCampaignTrackingPollInterval([])).toBe(0);
    expect(
      getCampaignTrackingPollInterval([campaign('SENT'), campaign('SENDING')]),
    ).toBe(CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS);
  });

  it('explains why a campaign has no recipient tracking yet', () => {
    expect(getCampaignRecipientTrackingMessage(campaign('SENDING'))).toContain(
      'still sending',
    );
    expect(getCampaignRecipientTrackingMessage(campaign('SENT'))).toContain(
      'No per-recipient tracking',
    );
    expect(getCampaignRecipientTrackingMessage(campaign('DRAFT'))).toContain(
      'once this campaign is sent',
    );
  });

  it('keeps queued and skipped recipients reachable through the filters', () => {
    expect(matchesCampaignRecipientStatus('QUEUED', 'ALL')).toBe(true);
    expect(matchesCampaignRecipientStatus('QUEUED', 'QUEUED')).toBe(true);
    expect(matchesCampaignRecipientStatus('SKIPPED', 'SKIPPED')).toBe(true);
    expect(matchesCampaignRecipientStatus('QUEUED', 'SENT')).toBe(false);
  });
});

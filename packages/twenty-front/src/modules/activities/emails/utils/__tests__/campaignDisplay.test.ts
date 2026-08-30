import {
  CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS,
  formatCampaignRate,
  formatCampaignRecipientEngagement,
  getCampaignRecipientTrackingMessage,
  getCampaignTrackingPollInterval,
  isCampaignInFlight,
  isDraftCampaign,
  matchesCampaignRecipientStatus,
} from '@/activities/emails/utils/campaignDisplay';

const campaign = (status: string) => ({ status });

const recipient = (
  overrides: Partial<{
    deliveryStatus: string;
    openedAt: string | null;
    openCount: number;
    clickedAt: string | null;
    clickCount: number;
    repliedAt: string | null;
  }> = {},
) => ({
  deliveryStatus: 'SENT',
  openedAt: null,
  openCount: 0,
  clickedAt: null,
  clickCount: 0,
  repliedAt: null,
  ...overrides,
});

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
    const queued = recipient({ deliveryStatus: 'QUEUED' });

    expect(matchesCampaignRecipientStatus(queued, 'ALL')).toBe(true);
    expect(matchesCampaignRecipientStatus(queued, 'QUEUED')).toBe(true);
    expect(
      matchesCampaignRecipientStatus(
        recipient({ deliveryStatus: 'SKIPPED' }),
        'SKIPPED',
      ),
    ).toBe(true);
    expect(matchesCampaignRecipientStatus(queued, 'SENT')).toBe(false);
  });

  it('filters engagement independently of delivery status', () => {
    const opened = recipient({ openedAt: '2026-08-25T10:00:00.000Z' });

    expect(matchesCampaignRecipientStatus(opened, 'SENT')).toBe(true);
    expect(matchesCampaignRecipientStatus(opened, 'OPENED')).toBe(true);
    expect(matchesCampaignRecipientStatus(opened, 'CLICKED')).toBe(false);

    const clicked = recipient({
      openedAt: '2026-08-25T10:00:00.000Z',
      clickedAt: '2026-08-25T10:01:00.000Z',
    });

    expect(matchesCampaignRecipientStatus(clicked, 'OPENED')).toBe(true);
    expect(matchesCampaignRecipientStatus(clicked, 'CLICKED')).toBe(true);

    const replied = recipient({ repliedAt: '2026-08-25T10:05:00.000Z' });

    expect(matchesCampaignRecipientStatus(replied, 'REPLIED')).toBe(true);
    expect(matchesCampaignRecipientStatus(replied, 'SENT')).toBe(true);
    expect(matchesCampaignRecipientStatus(replied, 'OPENED')).toBe(false);
    expect(matchesCampaignRecipientStatus(recipient(), 'REPLIED')).toBe(false);
  });

  it('summarises recipient engagement, counting a pixel-less open as one', () => {
    expect(formatCampaignRecipientEngagement(recipient())).toBeNull();
    expect(
      formatCampaignRecipientEngagement(
        recipient({ openedAt: '2026-08-25T10:00:00.000Z', openCount: 1 }),
      ),
    ).toBe('1 open');
    expect(
      formatCampaignRecipientEngagement(
        recipient({ openedAt: '2026-08-25T10:00:00.000Z', openCount: 3 }),
      ),
    ).toBe('3 opens');
    expect(
      formatCampaignRecipientEngagement(
        recipient({
          openedAt: '2026-08-25T10:00:00.000Z',
          openCount: 0,
          clickedAt: '2026-08-25T10:01:00.000Z',
          clickCount: 2,
        }),
      ),
    ).toBe('1 open · 2 clicks');
  });

  it('reports a reply without a count, since only the first one is recorded', () => {
    expect(
      formatCampaignRecipientEngagement(
        recipient({ repliedAt: '2026-08-25T10:05:00.000Z' }),
      ),
    ).toBe('replied');
    expect(
      formatCampaignRecipientEngagement(
        recipient({
          openedAt: '2026-08-25T10:00:00.000Z',
          openCount: 2,
          repliedAt: '2026-08-25T10:05:00.000Z',
        }),
      ),
    ).toBe('2 opens · replied');
  });
});

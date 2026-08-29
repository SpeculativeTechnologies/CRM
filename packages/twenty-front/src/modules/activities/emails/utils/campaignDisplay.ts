const IN_FLIGHT_CAMPAIGN_STATUSES = ['SCHEDULED', 'SENDING'];

export const CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS = 5000;

export const CAMPAIGN_RECIPIENT_STATUS_FILTERS = [
  'ALL',
  'QUEUED',
  'SENT',
  'OPENED',
  'CLICKED',
  'FAILED',
  'BOUNCED',
  'COMPLAINED',
  'SKIPPED',
] as const;

export type CampaignRecipientStatusFilter =
  (typeof CAMPAIGN_RECIPIENT_STATUS_FILTERS)[number];

type CampaignRecipientEngagement = {
  deliveryStatus: string;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
};

export const isDraftCampaign = (campaign: { status: string }) =>
  campaign.status === 'DRAFT';

export const isCampaignInFlight = (campaign: { status: string }) =>
  IN_FLIGHT_CAMPAIGN_STATUSES.includes(campaign.status);

// Sending advances on the server, so the tab has to keep asking while a
// campaign is in flight instead of freezing on the status it first loaded.
export const getCampaignTrackingPollInterval = (
  campaigns: { status: string }[],
) =>
  campaigns.some(isCampaignInFlight)
    ? CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS
    : 0;

export const getCampaignRecipientTrackingMessage = (campaign: {
  status: string;
}) => {
  if (isDraftCampaign(campaign)) {
    return 'Recipients appear here once this campaign is sent.';
  }

  if (isCampaignInFlight(campaign)) {
    return 'This campaign is still sending. Recipients appear here as their emails go out.';
  }

  return 'No per-recipient tracking was recorded for this campaign.';
};

// Opens and clicks are not delivery states, so they sit alongside deliveryStatus
// rather than replacing it: a recipient can be both SENT and OPENED.
export const matchesCampaignRecipientStatus = (
  recipient: CampaignRecipientEngagement,
  filter: CampaignRecipientStatusFilter,
) => {
  if (filter === 'ALL') {
    return true;
  }

  if (filter === 'OPENED') {
    return recipient.openedAt !== null;
  }

  if (filter === 'CLICKED') {
    return recipient.clickedAt !== null;
  }

  return recipient.deliveryStatus === filter;
};

const pluralize = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

// A click backfills openedAt without touching openCount, so a recipient can be
// known to have opened while the pixel never fired. Report at least one.
export const formatCampaignRecipientEngagement = (
  recipient: CampaignRecipientEngagement,
) => {
  const parts = [
    recipient.openedAt === null
      ? null
      : pluralize(Math.max(recipient.openCount, 1), 'open'),
    recipient.clickedAt === null
      ? null
      : pluralize(Math.max(recipient.clickCount, 1), 'click'),
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? null : parts.join(' · ');
};

export const formatCampaignRate = (count: number, total: number) => {
  if (total === 0) {
    return '—';
  }

  const percentage = (count / total) * 100;
  const formatted = Number.isInteger(percentage)
    ? percentage.toString()
    : percentage.toFixed(1);

  return `${formatted}% (${count})`;
};

export const formatCampaignDate = (value: string | null) => {
  if (value === null) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
};

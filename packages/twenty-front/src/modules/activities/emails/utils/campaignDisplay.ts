const IN_FLIGHT_CAMPAIGN_STATUSES = ['SCHEDULED', 'SENDING'];

export const CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS = 5000;

export const CAMPAIGN_RECIPIENT_STATUS_FILTERS = [
  'ALL',
  'QUEUED',
  'SENT',
  'FAILED',
  'BOUNCED',
  'COMPLAINED',
  'SKIPPED',
] as const;

export type CampaignRecipientStatusFilter =
  (typeof CAMPAIGN_RECIPIENT_STATUS_FILTERS)[number];

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

export const matchesCampaignRecipientStatus = (
  deliveryStatus: string,
  filter: CampaignRecipientStatusFilter,
) => filter === 'ALL' || deliveryStatus === filter;

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

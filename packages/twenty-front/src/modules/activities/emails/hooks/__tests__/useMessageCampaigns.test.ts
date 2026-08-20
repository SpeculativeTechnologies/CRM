import { useQuery } from '@apollo/client/react';
import { renderHook } from '@testing-library/react';

import {
  useMessageCampaign,
  useMessageCampaigns,
} from '@/activities/emails/hooks/useMessageCampaigns';
import { CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS } from '@/activities/emails/utils/campaignDisplay';

const mockUseQuery = useQuery as unknown as jest.Mock;

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn(),
}));

const startPolling = jest.fn();
const stopPolling = jest.fn();

const stubQueryResult = (data: unknown) => {
  mockUseQuery.mockReturnValue({
    data,
    loading: false,
    error: undefined,
    refetch: jest.fn(),
    startPolling,
    stopPolling,
  });
};

describe('useMessageCampaigns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('polls the campaign list while a campaign is still sending', () => {
    stubQueryResult({
      messageCampaigns: [{ status: 'SENT' }, { status: 'SENDING' }],
    });

    renderHook(() => useMessageCampaigns());

    expect(startPolling).toHaveBeenCalledWith(
      CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS,
    );
  });

  it('stops polling the campaign list once every campaign settled', () => {
    stubQueryResult({ messageCampaigns: [{ status: 'SENT_WITH_ERRORS' }] });

    renderHook(() => useMessageCampaigns());

    expect(startPolling).not.toHaveBeenCalled();
    expect(stopPolling).toHaveBeenCalled();
  });

  it('polls a single campaign while it is still sending', () => {
    stubQueryResult({ messageCampaign: { status: 'SENDING' } });

    renderHook(() => useMessageCampaign('campaign-id'));

    expect(startPolling).toHaveBeenCalledWith(
      CAMPAIGN_TRACKING_POLL_INTERVAL_MILLISECONDS,
    );
  });

  it('does not poll a campaign that has not loaded yet', () => {
    stubQueryResult(undefined);

    renderHook(() => useMessageCampaign('campaign-id'));

    expect(startPolling).not.toHaveBeenCalled();
  });
});

import { useQuery } from '@apollo/client/react';
import { useEffect } from 'react';

import {
  GET_MESSAGE_CAMPAIGN,
  GET_MESSAGE_CAMPAIGNS,
} from '@/activities/emails/graphql/metadata-queries/messageCampaigns';
import {
  type MessageCampaignDetails,
  type MessageCampaignSummary,
} from '@/activities/emails/types/MessageCampaign';
import { getCampaignTrackingPollInterval } from '@/activities/emails/utils/campaignDisplay';

// Sending is finished by the server, so the tab keeps polling while a campaign
// is in flight instead of showing the status it happened to load first.
const useCampaignTrackingPolling = ({
  campaigns,
  startPolling,
  stopPolling,
}: {
  campaigns: { status: string }[];
  startPolling: (pollInterval: number) => void;
  stopPolling: () => void;
}) => {
  const pollInterval = getCampaignTrackingPollInterval(campaigns);

  useEffect(() => {
    if (pollInterval === 0) {
      stopPolling();

      return;
    }

    startPolling(pollInterval);

    return () => stopPolling();
  }, [pollInterval, startPolling, stopPolling]);
};

export const useMessageCampaigns = () => {
  const { data, loading, error, refetch, startPolling, stopPolling } =
    useQuery<{
      messageCampaigns: MessageCampaignSummary[];
    }>(GET_MESSAGE_CAMPAIGNS, { fetchPolicy: 'cache-and-network' });

  const campaigns = data?.messageCampaigns ?? [];

  useCampaignTrackingPolling({ campaigns, startPolling, stopPolling });

  return {
    campaigns,
    loading,
    error,
    refetch,
  };
};

export const useMessageCampaign = (campaignId: string | undefined) => {
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<
    { messageCampaign: MessageCampaignDetails },
    { id: string }
  >(GET_MESSAGE_CAMPAIGN, {
    variables: { id: campaignId ?? '' },
    skip: campaignId === undefined,
    fetchPolicy: 'cache-and-network',
  });

  const campaign = data?.messageCampaign;

  useCampaignTrackingPolling({
    campaigns: campaign === undefined ? [] : [campaign],
    startPolling,
    stopPolling,
  });

  return { campaign, loading, error, refetch };
};

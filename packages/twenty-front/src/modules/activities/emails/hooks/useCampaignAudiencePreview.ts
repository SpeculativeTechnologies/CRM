import { useQuery } from '@apollo/client/react';

import { isNonEmptyString } from '@sniptt/guards';

import { PREVIEW_MESSAGE_CAMPAIGN_AUDIENCE } from '@/activities/emails/graphql/metadata-queries/previewMessageCampaignAudience';
import {
  type PreviewMessageCampaignAudienceQuery,
  type PreviewMessageCampaignAudienceQueryVariables,
} from '~/generated-metadata/graphql';

type UseCampaignAudiencePreviewArgs = {
  listId: string | null;
  personIds: string[];
  unsubscribeTopicId: string | null;
};

export const useCampaignAudiencePreview = ({
  listId,
  personIds,
  unsubscribeTopicId,
}: UseCampaignAudiencePreviewArgs) => {
  const { data } = useQuery<
    PreviewMessageCampaignAudienceQuery,
    PreviewMessageCampaignAudienceQueryVariables
  >(PREVIEW_MESSAGE_CAMPAIGN_AUDIENCE, {
    skip: !isNonEmptyString(listId) && personIds.length === 0,
    variables: {
      input: {
        listId: listId ?? undefined,
        personIds,
        unsubscribeTopicId: unsubscribeTopicId ?? undefined,
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  return data?.previewMessageCampaignAudience ?? null;
};

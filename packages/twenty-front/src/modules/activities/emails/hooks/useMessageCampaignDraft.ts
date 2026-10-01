import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';

import {
  DELETE_MESSAGE_CAMPAIGN_DRAFT,
  SAVE_MESSAGE_CAMPAIGN_DRAFT,
} from '@/activities/emails/graphql/mutations/saveMessageCampaignDraft';
import { GET_MESSAGE_CAMPAIGNS } from '@/activities/emails/graphql/metadata-queries/messageCampaigns';
import { t } from '@lingui/core/macro';
import { useToast } from 'twenty-ui/components';

export type SaveMessageCampaignDraftInput = {
  campaignId?: string;
  listId?: string | null;
  unsubscribeTopicId?: string | null;
  subject?: string | null;
  body?: string | null;
  fromAddress?: string | null;
};

export const useMessageCampaignDraft = () => {
  const { enqueueToast } = useToast();
  const [saveMutation, { loading: isSaving }] = useMutation<
    { saveMessageCampaignDraft: { campaignId: string; updatedAt: string } },
    { input: SaveMessageCampaignDraftInput }
  >(SAVE_MESSAGE_CAMPAIGN_DRAFT);
  const [deleteMutation, { loading: isDeleting }] = useMutation<
    { deleteMessageCampaignDraft: boolean },
    { campaignId: string }
  >(DELETE_MESSAGE_CAMPAIGN_DRAFT);

  const saveDraft = useCallback(
    async (input: SaveMessageCampaignDraftInput) => {
      try {
        const result = await saveMutation({
          variables: { input },
          refetchQueries: [GET_MESSAGE_CAMPAIGNS],
        });

        return result.data?.saveMessageCampaignDraft ?? null;
      } catch (error) {
        enqueueToast({
          variant: 'error',
          children:
            error instanceof Error ? error.message : t`Failed to save draft`,
        });

        return null;
      }
    },
    [enqueueToast, saveMutation],
  );

  const deleteDraft = useCallback(
    async (campaignId: string) => {
      try {
        const result = await deleteMutation({
          variables: { campaignId },
          refetchQueries: [GET_MESSAGE_CAMPAIGNS],
        });

        if (result.data?.deleteMessageCampaignDraft) {
          enqueueToast({ variant: 'success', children: t`Draft deleted` });

          return true;
        }
      } catch (error) {
        enqueueToast({
          variant: 'error',
          children:
            error instanceof Error ? error.message : t`Failed to delete draft`,
        });
      }

      return false;
    },
    [deleteMutation, enqueueToast],
  );

  return { saveDraft, deleteDraft, isSaving, isDeleting };
};

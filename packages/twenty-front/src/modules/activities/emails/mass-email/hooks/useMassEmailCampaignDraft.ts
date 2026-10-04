import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';

import { SAVE_MASS_EMAIL_CAMPAIGN_DRAFT } from '@/activities/emails/mass-email/graphql/massEmailCampaign';
import { t } from '@lingui/core/macro';
import { useToast } from 'twenty-ui/components';

type SaveMassEmailCampaignDraftInput = {
  campaignId?: string;
  connectedAccountId: string;
  personIds: string[];
  subject?: string;
  body?: string;
  cc?: string[];
};

export const useMassEmailCampaignDraft = () => {
  const { enqueueToast } = useToast();
  const [saveMutation, { loading: isSaving }] = useMutation<
    { saveMassEmailCampaignDraft: { campaignId: string; updatedAt: string } },
    { input: SaveMassEmailCampaignDraftInput }
  >(SAVE_MASS_EMAIL_CAMPAIGN_DRAFT);

  const saveDraft = useCallback(
    async (input: SaveMassEmailCampaignDraftInput) => {
      try {
        const result = await saveMutation({
          variables: { input },
        });

        return result.data?.saveMassEmailCampaignDraft ?? null;
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

  return { saveDraft, isSaving };
};

import { useMutation } from '@apollo/client/react';
import { useCallback, useState } from 'react';

import { SEND_MASS_EMAIL_CAMPAIGN } from '@/activities/emails/mass-email/graphql/massEmailCampaign';
import { t } from '@lingui/core/macro';
import { useToast } from 'twenty-ui/components';
type MassEmailToSend = {
  personId: string;
  to: string;
  subject: string;
  body: string;
  // Applies to this recipient's own email only, so each person keeps seeing a
  // single-recipient message.
  cc?: string[];
};

type SendMassEmailParams = {
  campaignId: string;
  connectedAccountId: string;
  emails: MassEmailToSend[];
};

type SendMassEmailResult = {
  sentCount: number;
  failedRecipients: string[];
};

export const useSendMassEmail = () => {
  const [sendMassEmailCampaignMutation] = useMutation<
    {
      sendMassEmailCampaign: {
        campaignId: string;
        sentCount: number;
        failedRecipients: string[];
      };
    },
    { input: SendMassEmailParams }
  >(SEND_MASS_EMAIL_CAMPAIGN);

  const { enqueueToast } = useToast();

  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const sendMassEmail = useCallback(
    async ({
      campaignId,
      connectedAccountId,
      emails,
    }: SendMassEmailParams): Promise<SendMassEmailResult> => {
      setSending(true);
      setSentCount(0);

      try {
        const result = await sendMassEmailCampaignMutation({
          variables: {
            input: { campaignId, connectedAccountId, emails },
          },
        });
        const sentCampaign = result.data?.sendMassEmailCampaign;

        if (sentCampaign === undefined) {
          throw new Error('Failed to send campaign');
        }

        setSentCount(sentCampaign.sentCount);

        const { sentCount: successCount, failedRecipients } = sentCampaign;

        if (failedRecipients.length === 0) {
          enqueueToast({
            variant: 'success',
            children: t`${successCount} emails sent`,
          });
        } else {
          enqueueToast({
            variant: 'error',
            children: t`Sent ${successCount} of ${emails.length} emails. Failed: ${failedRecipients.join(', ')}`,
          });
        }

        return { sentCount: successCount, failedRecipients };
      } catch (error) {
        enqueueToast({
          variant: 'error',
          children:
            error instanceof Error ? error.message : t`Failed to send emails`,
        });

        return {
          sentCount: 0,
          failedRecipients: emails.map(({ to }) => to),
        };
      } finally {
        setSending(false);
      }
    },
    [sendMassEmailCampaignMutation, enqueueToast],
  );

  return { sendMassEmail, sending, sentCount };
};

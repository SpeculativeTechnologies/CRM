import { useMutation } from '@apollo/client/react';
import { useCallback, useState } from 'react';

import { SEND_EMAIL } from '@/activities/emails/graphql/mutations/sendEmail';
import { getTimelineThreadsFromObjectRecord } from '@/activities/emails/graphql/queries/getTimelineThreadsFromObjectRecord';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { t } from '@lingui/core/macro';
import {
  type SendEmailMutation,
  type SendEmailMutationVariables,
} from '~/generated-metadata/graphql';

type MassEmailToSend = {
  to: string;
  subject: string;
  body: string;
};

type SendMassEmailParams = {
  connectedAccountId: string;
  emails: MassEmailToSend[];
};

type SendMassEmailResult = {
  sentCount: number;
  failedRecipients: string[];
};

export const useSendMassEmail = () => {
  const apolloCoreClient = useApolloCoreClient();

  const [sendEmailMutation] = useMutation<
    SendEmailMutation,
    SendEmailMutationVariables
  >(SEND_EMAIL);

  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const sendMassEmail = useCallback(
    async ({
      connectedAccountId,
      emails,
    }: SendMassEmailParams): Promise<SendMassEmailResult> => {
      setSending(true);
      setSentCount(0);

      const failedRecipients: string[] = [];

      for (const email of emails) {
        try {
          const result = await sendEmailMutation({
            variables: {
              input: {
                connectedAccountId,
                to: email.to,
                subject: email.subject,
                body: email.body,
              },
            },
          });

          if (result.data?.sendEmail.success === true) {
            setSentCount((previousCount) => previousCount + 1);
          } else {
            failedRecipients.push(email.to);
          }
        } catch {
          failedRecipients.push(email.to);
        }
      }

      try {
        await apolloCoreClient.refetchQueries({
          include: [
            getTimelineThreadsFromObjectRecord,
            'FindManyMessages',
            'FindManyMessageParticipants',
            'FindManyMessageChannelMessageAssociations',
          ],
        });
      } finally {
        setSending(false);
      }

      const successCount = emails.length - failedRecipients.length;

      if (failedRecipients.length === 0) {
        enqueueSuccessSnackBar({
          message: t`${successCount} emails sent`,
        });
      } else {
        enqueueErrorSnackBar({
          message: t`Sent ${successCount} of ${emails.length} emails. Failed: ${failedRecipients.join(', ')}`,
        });
      }

      return { sentCount: successCount, failedRecipients };
    },
    [
      sendEmailMutation,
      apolloCoreClient,
      enqueueSuccessSnackBar,
      enqueueErrorSnackBar,
    ],
  );

  return { sendMassEmail, sending, sentCount };
};

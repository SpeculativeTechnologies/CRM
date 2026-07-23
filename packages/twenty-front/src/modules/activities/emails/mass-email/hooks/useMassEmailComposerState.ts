import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { useMassEmailRecipients } from '@/activities/emails/mass-email/hooks/useMassEmailRecipients';
import { useSendMassEmail } from '@/activities/emails/mass-email/hooks/useSendMassEmail';
import { type MassEmailRecipient } from '@/activities/emails/mass-email/types/MassEmailRecipient';
import {
  type EmailPlaceholderKey,
  resolveEmailPlaceholders,
} from '@/activities/emails/mass-email/utils/emailPlaceholders';

type MassEmailOverride = {
  subject?: string;
  body?: string;
};

type ResolvedMassEmail = {
  subject: string;
  body: string;
  missingPlaceholderKeys: EmailPlaceholderKey[];
  isCustomized: boolean;
};

type UseMassEmailComposerStateArgs = {
  connectedAccountId: string;
  personIds: string[];
  onSent?: () => void;
};

export const useMassEmailComposerState = ({
  connectedAccountId: initialConnectedAccountId,
  personIds,
  onSent,
}: UseMassEmailComposerStateArgs) => {
  const [connectedAccountId, setConnectedAccountId] = useState(
    initialConnectedAccountId,
  );
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [overrides, setOverrides] = useState<Record<string, MassEmailOverride>>(
    {},
  );
  const [excludedPersonIds, setExcludedPersonIds] = useState<string[]>([]);

  const {
    recipients,
    skippedWithoutEmailCount,
    loading: recipientsLoading,
  } = useMassEmailRecipients(personIds);

  const { sendMassEmail, sending, sentCount } = useSendMassEmail();

  const includedRecipients = recipients.filter(
    (recipient) => !excludedPersonIds.includes(recipient.personId),
  );

  const resolveBaseForRecipient = useCallback(
    (recipient: MassEmailRecipient) => {
      const subjectResolution = resolveEmailPlaceholders(
        subjectTemplate,
        recipient.placeholderValues,
        { escapeValues: false },
      );
      const bodyResolution = resolveEmailPlaceholders(
        bodyTemplate,
        recipient.placeholderValues,
        { escapeValues: true },
      );

      return { subjectResolution, bodyResolution };
    },
    [subjectTemplate, bodyTemplate],
  );

  const resolveForRecipient = useCallback(
    (recipient: MassEmailRecipient): ResolvedMassEmail => {
      const { subjectResolution, bodyResolution } =
        resolveBaseForRecipient(recipient);
      const override = overrides[recipient.personId];

      return {
        subject: override?.subject ?? subjectResolution.resolved,
        body: override?.body ?? bodyResolution.resolved,
        missingPlaceholderKeys: [
          ...new Set([
            ...subjectResolution.missingPlaceholderKeys,
            ...bodyResolution.missingPlaceholderKeys,
          ]),
        ],
        isCustomized: isDefined(override?.subject) || isDefined(override?.body),
      };
    },
    [overrides, resolveBaseForRecipient],
  );

  const updateRecipientOverride = useCallback(
    (personId: string, patch: MassEmailOverride) => {
      const recipient = recipients.find(
        (candidate) => candidate.personId === personId,
      );

      if (!isDefined(recipient)) {
        return;
      }

      const { subjectResolution, bodyResolution } =
        resolveBaseForRecipient(recipient);

      setOverrides((previousOverrides) => {
        const nextOverride: MassEmailOverride = {
          ...previousOverrides[personId],
          ...patch,
        };

        if (nextOverride.subject === subjectResolution.resolved) {
          delete nextOverride.subject;
        }
        if (nextOverride.body === bodyResolution.resolved) {
          delete nextOverride.body;
        }

        const nextOverrides = { ...previousOverrides };

        if (!isDefined(nextOverride.subject) && !isDefined(nextOverride.body)) {
          delete nextOverrides[personId];
        } else {
          nextOverrides[personId] = nextOverride;
        }

        return nextOverrides;
      });
    },
    [recipients, resolveBaseForRecipient],
  );

  const setRecipientSubject = useCallback(
    (personId: string, subject: string) =>
      updateRecipientOverride(personId, { subject }),
    [updateRecipientOverride],
  );

  const setRecipientBody = useCallback(
    (personId: string, body: string) =>
      updateRecipientOverride(personId, { body }),
    [updateRecipientOverride],
  );

  const resetRecipientOverride = useCallback((personId: string) => {
    setOverrides((previousOverrides) => {
      const nextOverrides = { ...previousOverrides };

      delete nextOverrides[personId];

      return nextOverrides;
    });
  }, []);

  const excludeRecipient = useCallback((personId: string) => {
    setExcludedPersonIds((previousExcluded) => [...previousExcluded, personId]);
  }, []);

  const canSend =
    includedRecipients.length > 0 &&
    connectedAccountId.length > 0 &&
    !sending &&
    !recipientsLoading;

  const handleSend = useCallback(async () => {
    if (!canSend) {
      return;
    }

    const emails = includedRecipients.map((recipient) => {
      const resolved = resolveForRecipient(recipient);

      return {
        to: recipient.email,
        subject: resolved.subject,
        body: resolved.body,
      };
    });

    const { failedRecipients } = await sendMassEmail({
      connectedAccountId,
      emails,
    });

    if (failedRecipients.length === 0) {
      onSent?.();
    }
  }, [
    canSend,
    includedRecipients,
    resolveForRecipient,
    sendMassEmail,
    connectedAccountId,
    onSent,
  ]);

  return {
    connectedAccountId,
    setConnectedAccountId,
    subjectTemplate,
    setSubjectTemplate,
    bodyTemplate,
    setBodyTemplate,
    recipients,
    includedRecipients,
    skippedWithoutEmailCount,
    recipientsLoading,
    resolveForRecipient,
    setRecipientSubject,
    setRecipientBody,
    resetRecipientOverride,
    excludeRecipient,
    handleSend,
    sending,
    sentCount,
    canSend,
  };
};

export type MassEmailComposerState = ReturnType<
  typeof useMassEmailComposerState
>;

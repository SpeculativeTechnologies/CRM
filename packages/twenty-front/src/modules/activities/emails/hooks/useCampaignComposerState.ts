import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@lingui/core/macro';

import { useMessageCampaignDraft } from '@/activities/emails/hooks/useMessageCampaignDraft';
import { useSendMessageCampaign } from '@/activities/emails/hooks/useSendMessageCampaign';
import { useEmailSignatureComposer } from '@/activities/emails/signature/hooks/useEmailSignatureComposer';
import { type EmailTemplateContent } from '@/activities/emails/templates/types/EmailTemplate';

type UseCampaignComposerStateArgs = {
  campaignId?: string;
  initialValues?: {
    unsubscribeTopicId?: string | null;
    listId?: string | null;
    fromAddress?: string | null;
    subject?: string | null;
    body?: string | null;
  };
  autoSaveDraft?: boolean;
  onSent?: () => void;
};

export const useCampaignComposerState = ({
  campaignId,
  initialValues,
  autoSaveDraft = true,
  onSent,
}: UseCampaignComposerStateArgs) => {
  const [unsubscribeTopicId, setUnsubscribeTopicId] = useState<string | null>(
    initialValues?.unsubscribeTopicId ?? null,
  );
  const [listId, setListId] = useState<string | null>(
    initialValues?.listId ?? null,
  );
  const [fromAddress, setFromAddress] = useState(
    initialValues?.fromAddress ?? '',
  );
  const [subject, setSubject] = useState(initialValues?.subject ?? '');
  const signatureState = useEmailSignatureComposer({
    isEnabled: true,
    initialBody: initialValues?.body ?? '',
  });
  const [body, setBody] = useState(signatureState.initialBody);
  const [draftCampaignId, setDraftCampaignId] = useState(campaignId);
  const [draftSaveStatus, setDraftSaveStatus] = useState<
    'saving' | 'saved' | 'error'
  >('saving');
  // oxlint-disable-next-line twenty/no-state-useref -- A ref prevents React Strict Mode from creating the same server-side draft twice.
  const hasStartedDraftCreation = useRef(false);

  const { sendMessageCampaign, loading: isSending } = useSendMessageCampaign();
  const { saveDraft, isSaving } = useMessageCampaignDraft();

  const saveCurrentDraft = useCallback(
    async (content?: EmailTemplateContent) => {
      setDraftSaveStatus('saving');
      const savedDraft = await saveDraft({
        campaignId: draftCampaignId,
        listId,
        unsubscribeTopicId,
        subject: content?.subject ?? subject,
        body: content?.body ?? body,
        fromAddress:
          fromAddress.trim().length === 0 ? null : fromAddress.trim(),
      });

      setDraftSaveStatus(savedDraft === null ? 'error' : 'saved');

      if (savedDraft === null && content) {
        throw new Error(
          t`Could not save the template to this campaign. Please try again.`,
        );
      }

      if (savedDraft !== null && draftCampaignId === undefined) {
        setDraftCampaignId(savedDraft.campaignId);
      }

      return savedDraft?.campaignId ?? draftCampaignId;
    },
    [
      body,
      draftCampaignId,
      fromAddress,
      listId,
      saveDraft,
      subject,
      unsubscribeTopicId,
    ],
  );

  useEffect(() => {
    if (
      !autoSaveDraft ||
      draftCampaignId !== undefined ||
      hasStartedDraftCreation.current
    ) {
      return;
    }

    hasStartedDraftCreation.current = true;
    void saveCurrentDraft();
  }, [autoSaveDraft, draftCampaignId, saveCurrentDraft]);

  useEffect(() => {
    if (!autoSaveDraft || draftCampaignId === undefined) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentDraft();
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [autoSaveDraft, draftCampaignId, saveCurrentDraft]);

  const setSignatureIncluded = (isIncluded: boolean) => {
    setBody(signatureState.applySignatureInclusion(body, isIncluded));
  };

  const applyTemplate = async (content: EmailTemplateContent) => {
    if (autoSaveDraft && draftCampaignId === undefined) {
      throw new Error(
        t`Wait for the campaign draft to finish saving, then try again.`,
      );
    }
    const nextBody = signatureState.applySignatureInclusion(
      content.body,
      signatureState.isSignatureIncludedIn(body),
    );

    setSubject(content.subject);
    setBody(nextBody);

    if (autoSaveDraft) {
      await saveCurrentDraft({ subject: content.subject, body: nextBody });
    }
  };

  const canSend =
    listId !== null &&
    fromAddress.trim().length > 0 &&
    subject.trim().length > 0 &&
    !isSending;

  const handleSend = async () => {
    if (listId === null || !canSend) {
      return;
    }

    const savedCampaignId = autoSaveDraft
      ? await saveCurrentDraft()
      : draftCampaignId;

    // The server reads the content it sends from the persisted draft, so there
    // is nothing to send until the draft exists.
    if (savedCampaignId === undefined) {
      return;
    }

    const success = await sendMessageCampaign({ campaignId: savedCampaignId });

    if (success) {
      onSent?.();
    }
  };

  return {
    unsubscribeTopicId,
    setUnsubscribeTopicId,
    listId,
    setListId,
    fromAddress,
    setFromAddress,
    subject,
    setSubject,
    body,
    setBody,
    applyTemplate,
    draftCampaignId,
    saveCurrentDraft,
    handleSend,
    canSend,
    loading: isSending,
    isSaving,
    draftSaveStatus,
    isSignatureToggleVisible: signatureState.isSignatureToggleVisible,
    isSignatureIncluded: signatureState.isSignatureIncludedIn(body),
    setSignatureIncluded,
    signatureResyncKey: signatureState.signatureResyncKey,
  };
};

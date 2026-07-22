import { useCallback, useState } from 'react';

import { MassEmailComposerFields } from '@/activities/emails/mass-email/components/MassEmailComposerFields';
import { MassEmailPreview } from '@/activities/emails/mass-email/components/MassEmailPreview';
import { useMassEmailComposerState } from '@/activities/emails/mass-email/hooks/useMassEmailComposerState';
import { SIDE_PANEL_FOCUS_ID } from '@/side-panel/constants/SidePanelFocusId';
import { useSidePanelHistory } from '@/side-panel/hooks/useSidePanelHistory';
import { massEmailConnectedAccountIdComponentState } from '@/side-panel/pages/mass-email/states/massEmailConnectedAccountIdComponentState';
import { massEmailPersonIdsComponentState } from '@/side-panel/pages/mass-email/states/massEmailPersonIdsComponentState';
import { SidePanelFooter } from '@/ui/layout/side-panel/components/SidePanelFooter';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { IconArrowLeft, IconEye, IconSend } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { getOsControlSymbol } from 'twenty-ui/utilities';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
`;

export const SidePanelMassEmailPage = () => {
  const massEmailConnectedAccountId = useAtomComponentStateValue(
    massEmailConnectedAccountIdComponentState,
  );
  const massEmailPersonIds = useAtomComponentStateValue(
    massEmailPersonIdsComponentState,
  );

  const { goBackFromSidePanel } = useSidePanelHistory();

  const [step, setStep] = useState<'compose' | 'preview'>('compose');

  const composerState = useMassEmailComposerState({
    connectedAccountId: massEmailConnectedAccountId ?? '',
    personIds: massEmailPersonIds ?? [],
    onSent: goBackFromSidePanel,
  });

  const recipientCount = composerState.includedRecipients.length;

  const handlePrimaryAction = useCallback(() => {
    if (step === 'compose') {
      if (recipientCount > 0) {
        setStep('preview');
      }

      return;
    }

    if (composerState.canSend) {
      composerState.handleSend();
    }
  }, [step, recipientCount, composerState]);

  useHotkeysOnFocusedElement({
    keys: ['ctrl+Enter,meta+Enter'],
    callback: handlePrimaryAction,
    focusId: SIDE_PANEL_FOCUS_ID,
    dependencies: [handlePrimaryAction],
  });

  if (!massEmailConnectedAccountId) {
    return null;
  }

  const sendButtonTitle = composerState.sending
    ? t`Sending ${composerState.sentCount}/${recipientCount}…`
    : t`Send ${recipientCount} emails`;

  return (
    <StyledContainer>
      <StyledContent>
        {step === 'compose' ? (
          <MassEmailComposerFields composerState={composerState} />
        ) : (
          <MassEmailPreview composerState={composerState} />
        )}
      </StyledContent>
      {step === 'compose' ? (
        <SidePanelFooter
          actions={[
            <Button
              key="cancel"
              size="small"
              variant="secondary"
              title={t`Cancel`}
              onClick={goBackFromSidePanel}
            />,
            <Button
              key="preview"
              size="small"
              variant="primary"
              accent="blue"
              title={t`Preview`}
              Icon={IconEye}
              hotkeys={[getOsControlSymbol(), '⏎']}
              onClick={handlePrimaryAction}
              disabled={recipientCount === 0 || composerState.recipientsLoading}
            />,
          ]}
        />
      ) : (
        <SidePanelFooter
          actions={[
            <Button
              key="back"
              size="small"
              variant="secondary"
              title={t`Back`}
              Icon={IconArrowLeft}
              onClick={() => setStep('compose')}
              disabled={composerState.sending}
            />,
            <Button
              key="send"
              size="small"
              variant="primary"
              accent="blue"
              title={sendButtonTitle}
              Icon={IconSend}
              hotkeys={[getOsControlSymbol(), '⏎']}
              onClick={composerState.handleSend}
              disabled={!composerState.canSend}
            />,
          ]}
        />
      )}
    </StyledContainer>
  );
};

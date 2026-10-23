import { t } from '@lingui/core/macro';
import { useId, useState } from 'react';
import { EmailTemplateActionButton as Button } from '@/activities/emails/templates/components/EmailTemplateActionButton';
import { Dialog } from 'twenty-ui/primitives/surfaces';

import { EmailTemplateLibrary } from '@/activities/emails/templates/components/EmailTemplateLibrary';
import { type EmailTemplateContent } from '@/activities/emails/templates/types/EmailTemplate';
import { DialogInstance } from '@/ui/layout/dialog/components/DialogInstance';
import { useDialog } from '@/ui/layout/dialog/hooks/useDialog';

type EmailTemplatesButtonProps = {
  subject: string;
  body: string;
  onApply: (content: EmailTemplateContent) => void | Promise<void>;
  personalize?: boolean;
  defaultPersonId?: string;
};

export const EmailTemplatesButton = ({
  subject,
  body,
  onApply,
  personalize = false,
  defaultPersonId,
}: EmailTemplatesButtonProps) => {
  const dialogId = `email-templates-${useId()}`;
  const { openDialog, closeDialog } = useDialog();
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => {
    closeDialog(dialogId);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        title={t`Templates`}
        size="small"
        onClick={() => {
          setIsOpen(true);
          openDialog(dialogId);
        }}
      />
      <DialogInstance dialogId={dialogId} renderInDocumentBody>
        {({ container, backdrop, viewportProps, onKeyDown }) => (
          <Dialog.Popup
            {...{ container, backdrop, viewportProps, onKeyDown }}
            size="lg"
            aria-label={t`Email templates`}
          >
            {isOpen && (
              <EmailTemplateLibrary
                currentContent={{ subject, body }}
                personalize={personalize}
                defaultPersonId={defaultPersonId}
                onApply={onApply}
                onClose={handleClose}
              />
            )}
          </Dialog.Popup>
        )}
      </DialogInstance>
    </>
  );
};

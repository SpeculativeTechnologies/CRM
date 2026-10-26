import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { EmailTemplateActionButton as Button } from '@/activities/emails/templates/components/EmailTemplateActionButton';
import { themeCssVariables } from 'twenty-ui/theme';

import { EmailTemplateEditor } from '@/activities/emails/templates/components/EmailTemplateEditor';
import { EmailTemplateList } from '@/activities/emails/templates/components/EmailTemplateList';
import { EmailTemplatePreview } from '@/activities/emails/templates/components/EmailTemplatePreview';
import { useEmailTemplates } from '@/activities/emails/templates/hooks/useEmailTemplates';
import { type EmailTemplateContent } from '@/activities/emails/templates/types/EmailTemplate';
import { TIPTAP_DOCUMENT_SCHEMA_VERSION } from 'twenty-shared/utils';

const StyledLibrary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[5]};
`;
const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;
const StyledWorkspace = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[5]};
  grid-template-columns: minmax(160px, 1fr) minmax(0, 3fr);

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;
const StyledDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-width: 0;
`;
const EMPTY_CONTENT = {
  name: '',
  subject: '',
  body: JSON.stringify({
    type: 'doc',
    attrs: { schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION },
    content: [{ type: 'paragraph' }],
  }),
};

type EmailTemplateLibraryProps = {
  currentContent: EmailTemplateContent;
  personalize: boolean;
  defaultPersonId?: string;
  onApply: (content: EmailTemplateContent) => void | Promise<void>;
  onClose: () => void;
};

export const EmailTemplateLibrary = ({
  currentContent,
  personalize,
  defaultPersonId,
  onApply,
  onClose,
}: EmailTemplateLibraryProps) => {
  const {
    templates,
    loading,
    error,
    isSaving,
    isDeleting,
    saveTemplate,
    deleteTemplate,
  } = useEmailTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftContent, setContent] = useState<typeof EMPTY_CONTENT | null>(
    null,
  );
  const [editorKey, setEditorKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const selected =
    selectedId === null
      ? templates[0]
      : templates.find((template) => template.id === selectedId);
  const content = draftContent ?? {
    name: selected?.name ?? '',
    subject: selected?.subject ?? '',
    body: selected?.body ?? EMPTY_CONTENT.body,
  };
  const savedContent = selected ?? EMPTY_CONTENT;
  const isDirty =
    content.name !== savedContent.name ||
    content.subject !== savedContent.subject ||
    content.body !== savedContent.body;
  const isBusy = isSaving || isDeleting || isApplying;

  const selectTemplate = (id: string | null) => {
    setSelectedId(id);
    setContent(null);
    setEditorKey((key) => key + 1);
    setMessage(null);
    setConfirmDelete(false);
    setPendingSelection(null);
    setConfirmClose(false);
  };
  const handleSave = async () => {
    setMessage(null);
    try {
      const saved = await saveTemplate({
        ...content,
        ...(selected && { id: selected.id }),
      });

      if (saved) {
        setSelectedId(saved.id);
        setContent({
          name: saved.name,
          subject: saved.subject,
          body: saved.body,
        });
        setMessage(t`Template saved`);
      }
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : t`Could not save template`,
      );
    }
  };
  const handleDelete = async () => {
    try {
      if (!selected) return;
      await deleteTemplate(selected.id);
      selectTemplate(null);
      setMessage(t`Template deleted`);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : t`Could not delete template`,
      );
    }
  };
  const handleApply = async (nextContent: EmailTemplateContent) => {
    setIsApplying(true);
    try {
      await onApply(nextContent);
      onClose();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : t`Could not insert template`,
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <StyledLibrary>
      <strong>{t`Email templates`}</strong>
      <div>{t`Templates are shared with everyone who can send email in this workspace.`}</div>
      {loading && <div role="status">{t`Loading templates…`}</div>}
      {error && (
        <div role="alert">{t`Could not load templates. Close and try again.`}</div>
      )}
      <StyledWorkspace>
        <EmailTemplateList
          templates={templates}
          selectedId={selected?.id}
          disabled={isBusy || loading || !!error}
          onSelect={(id) => {
            if (id === selected?.id || (id === '' && selectedId === '')) return;
            if (isDirty) setPendingSelection(id);
            else selectTemplate(id);
          }}
        />
        <StyledDetails>
          {!loading && !error && !selected && selectedId !== '' && (
            <div>{t`No saved templates yet. Choose New template to create one.`}</div>
          )}
          {pendingSelection !== null && (
            <StyledActions>
              <span>{t`Discard unsaved changes?`}</span>
              <Button
                title={t`Discard and switch`}
                onClick={() => selectTemplate(pendingSelection)}
              />
              <Button
                title={t`Keep editing`}
                onClick={() => setPendingSelection(null)}
              />
            </StyledActions>
          )}
          {(selected || selectedId === '') && (
            <EmailTemplateEditor
              key={`${selected?.id ?? 'new'}:${editorKey}`}
              content={content}
              onChange={setContent}
              disabled={isBusy || !!error}
            />
          )}
          {message && <div role="status">{message}</div>}
          <StyledActions>
            {(selected || selectedId === '') && (
              <Button
                title={t`Save template`}
                variant="primary"
                disabled={
                  isBusy ||
                  loading ||
                  !!error ||
                  !content.name.trim() ||
                  !content.subject.trim()
                }
                onClick={() => void handleSave()}
              />
            )}
            {selected && (
              <Button
                title={confirmDelete ? t`Confirm delete` : t`Delete template`}
                disabled={isBusy}
                onClick={() => {
                  if (confirmDelete) void handleDelete();
                  else setConfirmDelete(true);
                }}
              />
            )}
            <Button
              title={t`Close`}
              disabled={isBusy}
              onClick={() => {
                if (isDirty) setConfirmClose(true);
                else onClose();
              }}
            />
          </StyledActions>
          {confirmClose && (
            <StyledActions>
              <span>{t`Discard unsaved changes?`}</span>
              <Button title={t`Discard and close`} onClick={onClose} />
              <Button
                title={t`Keep editing`}
                onClick={() => setConfirmClose(false)}
              />
            </StyledActions>
          )}
          {selected && (
            <EmailTemplatePreview
              content={selected}
              personalize={personalize}
              defaultPersonId={defaultPersonId}
              disabled={isBusy || isDirty}
              replacesContent={
                currentContent.subject.trim().length > 0 ||
                currentContent.body.trim().length > 0
              }
              onApply={handleApply}
            />
          )}
          {selected && isDirty && (
            <div>{t`Save your changes before using this template.`}</div>
          )}
        </StyledDetails>
      </StyledWorkspace>
    </StyledLibrary>
  );
};

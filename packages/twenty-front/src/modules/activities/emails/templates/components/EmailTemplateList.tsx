import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { IconPlus } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { type EmailTemplate } from '@/activities/emails/templates/types/EmailTemplate';

const StyledSidebar = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  min-width: 0;
`;
const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  max-height: 480px;
  overflow-y: auto;
`;
const StyledTemplate = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font: inherit;
  gap: ${themeCssVariables.spacing[1]};
  overflow-wrap: anywhere;
  padding: ${themeCssVariables.spacing[3]};
  text-align: left;

  &:hover,
  &[aria-pressed='true'] {
    background: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.color.blue};
  }

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.color.blue};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;
const StyledSubject = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

type EmailTemplateListProps = {
  templates: EmailTemplate[];
  selectedId?: string;
  disabled: boolean;
  onSelect: (id: string) => void;
};

export const EmailTemplateList = ({
  templates,
  selectedId,
  disabled,
  onSelect,
}: EmailTemplateListProps) => (
  <StyledSidebar aria-label={t`Saved templates`}>
    <strong>
      {t`Saved templates`} ({templates.length})
    </strong>
    <StyledList>
      {templates.map((template) => (
        <StyledTemplate
          key={template.id}
          type="button"
          aria-label={template.name}
          aria-pressed={selectedId === template.id}
          disabled={disabled}
          onClick={() => onSelect(template.id)}
        >
          <strong>{template.name}</strong>
          <StyledSubject>{template.subject}</StyledSubject>
        </StyledTemplate>
      ))}
    </StyledList>
    <Button
      type="button"
      size="sm"
      variant="outline"
      color="neutral"
      startIcon={<IconPlus />}
      disabled={disabled}
      onClick={() => onSelect('')}
    >
      {t`New template`}
    </Button>
  </StyledSidebar>
);

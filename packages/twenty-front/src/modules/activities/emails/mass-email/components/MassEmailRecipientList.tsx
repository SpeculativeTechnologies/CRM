import { styled } from '@linaria/react';
import { useState } from 'react';

import { type MassEmailComposerState } from '@/activities/emails/mass-email/hooks/useMassEmailComposerState';
import { t } from '@lingui/core/macro';
import { Avatar } from 'twenty-ui/data-display';
import { IconSearch, IconUsers, IconX } from 'twenty-ui/icon';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { getAbsoluteImageUrl } from '~/utils/image/getAbsoluteImageUrl';

const StyledContainer = styled.div`
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  width: 280px;
`;

const StyledSearchRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledSearchInput = styled.input`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  outline: none;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

const StyledList = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledRow = styled.button<{ selected: boolean }>`
  align-items: center;
  background: ${({ selected }) =>
    selected ? themeCssVariables.background.transparent.light : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledRowText = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
`;

const StyledRowTitle = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowSubtitle = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledCustomizedDot = styled.span`
  background: ${themeCssVariables.color.blue};
  border-radius: 50%;
  flex-shrink: 0;
  height: 6px;
  width: 6px;
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

type MassEmailRecipientListProps = {
  composerState: MassEmailComposerState;
  selectedPersonId: string | null;
  onSelect: (personId: string | null) => void;
};

export const MassEmailRecipientList = ({
  composerState,
  selectedPersonId,
  onSelect,
}: MassEmailRecipientListProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleRecipients = composerState.includedRecipients.filter(
    (recipient) =>
      normalizedQuery === '' ||
      recipient.displayName.toLowerCase().includes(normalizedQuery) ||
      recipient.email.toLowerCase().includes(normalizedQuery),
  );

  const handleRemove = (personId: string) => {
    composerState.excludeRecipient(personId);

    if (selectedPersonId === personId) {
      onSelect(null);
    }
  };

  return (
    <StyledContainer>
      <StyledSearchRow>
        <IconSearch size={16} />
        <StyledSearchInput
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t`Search`}
        />
      </StyledSearchRow>
      <StyledList>
        <StyledRow
          selected={selectedPersonId === null}
          onClick={() => onSelect(null)}
        >
          <Avatar
            placeholder={t`Everyone`}
            Icon={IconUsers}
            size="lg"
            type="rounded"
          />
          <StyledRowText>
            <StyledRowTitle>{t`Everyone`}</StyledRowTitle>
            <StyledRowSubtitle>
              {t`Edit template · ${composerState.includedRecipients.length} recipients`}
            </StyledRowSubtitle>
          </StyledRowText>
        </StyledRow>
        {visibleRecipients.map((recipient) => {
          const isCustomized =
            composerState.resolveForRecipient(recipient).isCustomized;

          return (
            <StyledRow
              key={recipient.personId}
              selected={selectedPersonId === recipient.personId}
              onClick={() => onSelect(recipient.personId)}
            >
              <Avatar
                avatarUrl={getAbsoluteImageUrl(recipient.avatarUrl)}
                placeholder={recipient.displayName}
                placeholderColorSeed={recipient.personId}
                size="lg"
                type="rounded"
              />
              <StyledRowText>
                <StyledRowTitle>
                  {recipient.displayName}
                  {isCustomized && <StyledCustomizedDot />}
                </StyledRowTitle>
                <StyledRowSubtitle>{recipient.email}</StyledRowSubtitle>
              </StyledRowText>
              <LightIconButton
                Icon={IconX}
                size="small"
                accent="tertiary"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemove(recipient.personId);
                }}
              />
            </StyledRow>
          );
        })}
        {visibleRecipients.length === 0 && normalizedQuery !== '' && (
          <StyledHint>{t`No recipients match your search.`}</StyledHint>
        )}
      </StyledList>
      {composerState.skippedWithoutEmailCount > 0 && (
        <StyledHint>
          {t`${composerState.skippedWithoutEmailCount} selected people have no email address and were skipped.`}
        </StyledHint>
      )}
    </StyledContainer>
  );
};

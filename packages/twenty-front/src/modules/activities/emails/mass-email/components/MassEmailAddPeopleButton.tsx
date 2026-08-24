import { styled } from '@linaria/react';
import { useId } from 'react';

import { useOpenFormMultiRecordPicker } from '@/object-record/record-field/ui/form-types/hooks/useOpenFormMultiRecordPicker';
import { MultipleRecordPicker } from '@/object-record/record-picker/multiple-record-picker/components/MultipleRecordPicker';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { t } from '@lingui/core/macro';
import { MAX_EMAIL_RECIPIENTS } from 'twenty-shared/constants';
import { IconUserPlus } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  padding: ${themeCssVariables.spacing[2]};
`;

type MassEmailAddPeopleButtonProps = {
  selectedPersonIds: string[];
  onPersonSelected: (personId: string, isSelected: boolean) => void;
};

export const MassEmailAddPeopleButton = ({
  selectedPersonIds,
  onPersonSelected,
}: MassEmailAddPeopleButtonProps) => {
  const componentId = useId();
  const dropdownId = `mass-email-add-people-${componentId}`;
  const { closeDropdown } = useCloseDropdown();
  const { enqueueWarningSnackBar } = useSnackBar();
  const { openFormMultiRecordPicker } = useOpenFormMultiRecordPicker({
    objectNameSingular: 'person',
  });

  const handleOpen = () => {
    openFormMultiRecordPicker({
      pickerInstanceId: dropdownId,
      selectedRecordIds: selectedPersonIds,
      selectedRecords: [],
    });
  };

  return (
    <StyledContainer>
      <Dropdown
        dropdownId={dropdownId}
        dropdownPlacement="top-start"
        clickableComponentWidth="100%"
        onOpen={handleOpen}
        clickableComponent={
          <Button
            title={t`Add people`}
            Icon={IconUserPlus}
            size="small"
            variant="secondary"
            fullWidth
          />
        }
        dropdownComponents={
          <MultipleRecordPicker
            componentInstanceId={dropdownId}
            focusId={dropdownId}
            layoutDirection="search-bar-on-top"
            dropdownWidth={GenericDropdownContentWidth.ExtraLarge}
            onChange={({ recordId, isSelected }) => {
              if (
                isSelected &&
                !selectedPersonIds.includes(recordId) &&
                selectedPersonIds.length >= MAX_EMAIL_RECIPIENTS
              ) {
                enqueueWarningSnackBar({
                  message: t`You can select at most ${MAX_EMAIL_RECIPIENTS} people.`,
                });

                return;
              }

              onPersonSelected(recordId, isSelected);
            }}
            onSubmit={() => closeDropdown(dropdownId)}
            onClickOutside={() => closeDropdown(dropdownId)}
          />
        }
      />
    </StyledContainer>
  );
};

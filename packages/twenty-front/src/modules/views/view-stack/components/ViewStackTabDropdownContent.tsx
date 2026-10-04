import { styled } from '@linaria/react';
import { type MouseEvent, useCallback } from 'react';

import { type DraggableListDropResult } from '@/ui/layout/draggable-list/types/DraggableListDropResult';

import { DraggableItem } from '@/ui/layout/draggable-list/components/DraggableItem';
import { DraggableList } from '@/ui/layout/draggable-list/components/DraggableList';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { usePerformViewApiUpdate } from '@/views/hooks/internal/usePerformViewApiUpdate';
import { useChangeView } from '@/views/hooks/useChangeView';
import { useOpenCreateViewDropdown } from '@/views/hooks/useOpenCreateViewDropown';
import { VIEW_PICKER_DROPDOWN_ID } from '@/views/view-picker/constants/ViewPickerDropdownId';
import { useViewPickerMode } from '@/views/view-picker/hooks/useViewPickerMode';
import { viewPickerReferenceViewIdComponentState } from '@/views/view-picker/states/viewPickerReferenceViewIdComponentState';
import { ViewPickerOptionDropdown } from '@/views/view-picker/components/ViewPickerOptionDropdown';
import { type ViewStack } from '@/views/view-stack/types/ViewStack';
import { useLingui } from '@lingui/react/macro';
import { IconPlus } from 'twenty-ui/icon';
import { MenuItem } from 'twenty-ui/components';
import { themeCssVariables } from 'twenty-ui/theme';
import { moveArrayItem } from '~/utils/array/moveArrayItem';

const StyledBoldDropdownMenuItemsContainerWrapper = styled.div`
  font-weight: ${themeCssVariables.font.weight.regular};
`;

type ViewStackTabDropdownContentProps = {
  viewStack: ViewStack;
  currentViewId: string | undefined;
  isLastView: boolean;
};

export const ViewStackTabDropdownContent = ({
  viewStack,
  currentViewId,
  isLastView,
}: ViewStackTabDropdownContentProps) => {
  const { t } = useLingui();

  const { rootView, childViews } = viewStack;

  const { changeView } = useChangeView();
  const { closeDropdown } = useCloseDropdown();
  const { openCreateViewDropdown } = useOpenCreateViewDropdown();
  const { performViewApiUpdate } = usePerformViewApiUpdate();
  const { setViewPickerMode } = useViewPickerMode();

  const setViewPickerReferenceViewId = useSetAtomComponentState(
    viewPickerReferenceViewIdComponentState,
  );

  const handleViewSelect = (viewId: string) => {
    changeView(viewId);
    closeDropdown(VIEW_PICKER_DROPDOWN_ID);
  };

  const handleEditViewButtonClick = (
    event: MouseEvent<HTMLElement>,
    viewId: string,
  ) => {
    event.stopPropagation();
    setViewPickerReferenceViewId(viewId);
    setViewPickerMode('edit');
  };

  const handleAddViewToStackClick = () => {
    openCreateViewDropdown(rootView, rootView.id);
  };

  const handleChildDragEnd = useCallback(
    async (result: DraggableListDropResult) => {
      if (!result.destination) return;

      const reorderedChildViews = moveArrayItem(childViews, {
        fromIndex: result.source.index,
        toIndex: result.destination.index,
      });

      await Promise.all(
        reorderedChildViews.map(async (childView, index) => {
          if (childView.position !== index) {
            await performViewApiUpdate({
              id: childView.id,
              input: { position: index },
            });
          }
        }),
      );
    },
    [childViews, performViewApiUpdate],
  );

  return (
    <DropdownContent>
      <DropdownMenuItemsContainer hasMaxHeight>
        <ViewPickerOptionDropdown
          view={rootView}
          handleViewSelect={handleViewSelect}
          isIndexView={rootView.key === 'INDEX'}
          isLastView={isLastView}
          onEdit={handleEditViewButtonClick}
          isCurrentView={currentViewId === rootView.id}
        />
      </DropdownMenuItemsContainer>
      {childViews.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItemsContainer hasMaxHeight>
            <DraggableList
              onDragEnd={handleChildDragEnd}
              draggableItems={childViews.map((childView, index) => (
                <DraggableItem
                  key={childView.id}
                  draggableId={childView.id}
                  index={index}
                  isDragDisabled={childViews.length === 1}
                  itemComponent={
                    <ViewPickerOptionDropdown
                      view={childView}
                      handleViewSelect={handleViewSelect}
                      isIndexView={childView.key === 'INDEX'}
                      isLastView={isLastView}
                      onEdit={handleEditViewButtonClick}
                      isCurrentView={currentViewId === childView.id}
                    />
                  }
                />
              ))}
            />
          </DropdownMenuItemsContainer>
        </>
      )}
      <DropdownMenuSeparator />
      <StyledBoldDropdownMenuItemsContainerWrapper>
        <DropdownMenuItemsContainer scrollable={false}>
          <MenuItem
            onClick={handleAddViewToStackClick}
            LeftIcon={IconPlus}
            text={t`Add view to this stack`}
          />
        </DropdownMenuItemsContainer>
      </StyledBoldDropdownMenuItemsContainerWrapper>
    </DropdownContent>
  );
};

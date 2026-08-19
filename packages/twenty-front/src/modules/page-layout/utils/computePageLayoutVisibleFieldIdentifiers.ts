import { type PageLayout } from '@/page-layout/types/PageLayout';
import { getWidgetConfigurationViewId } from '@/page-layout/utils/getWidgetConfigurationViewId';
import { type ViewWithRelations } from '@/views/types/ViewWithRelations';
import { isDefined, isNonEmptyArray } from 'twenty-shared/utils';
import {
  type FieldsConfiguration,
  WidgetType,
} from '~/generated-metadata/graphql';

export type PageLayoutVisibleFieldIdentifiers =
  | { canRestrictToVisibleFields: false }
  | { canRestrictToVisibleFields: true; fieldIdentifiers: Set<string> };

const CANNOT_RESTRICT: PageLayoutVisibleFieldIdentifiers = {
  canRestrictToVisibleFields: false,
};

// Collects the field metadata ids (or names, for FIELD widgets configured by
// name) that the record page layout can display, across every tab. Returns
// canRestrictToVisibleFields: false whenever a widget could surface arbitrary
// fields, in which case callers must fetch the full field set.
export const computePageLayoutVisibleFieldIdentifiers = ({
  pageLayout,
  viewsById,
}: {
  pageLayout: PageLayout | undefined;
  viewsById: Map<string, ViewWithRelations>;
}): PageLayoutVisibleFieldIdentifiers => {
  if (!isDefined(pageLayout)) {
    return CANNOT_RESTRICT;
  }

  const fieldIdentifiers = new Set<string>();

  for (const tab of pageLayout.tabs ?? []) {
    for (const widget of tab.widgets ?? []) {
      if (widget.type === WidgetType.FIELD) {
        if (
          'fieldMetadataId' in widget.configuration &&
          isDefined(widget.configuration.fieldMetadataId)
        ) {
          fieldIdentifiers.add(widget.configuration.fieldMetadataId);
        }
        continue;
      }

      if (widget.type !== WidgetType.FIELDS) {
        continue;
      }

      const fieldsConfiguration = widget.configuration as FieldsConfiguration;

      // The "More" group exposes every active field of the object.
      if (fieldsConfiguration.shouldAllowUserToSeeHiddenFields === true) {
        return CANNOT_RESTRICT;
      }

      const viewId = getWidgetConfigurationViewId(fieldsConfiguration);

      // Without a resolvable view the widget falls back to showing all
      // active fields (buildDefaultFieldsWidgetGroups).
      if (!isDefined(viewId)) {
        return CANNOT_RESTRICT;
      }

      const view = viewsById.get(viewId);

      if (!isDefined(view)) {
        return CANNOT_RESTRICT;
      }

      if (isNonEmptyArray(view.viewFieldGroups)) {
        for (const viewFieldGroup of view.viewFieldGroups) {
          if (!viewFieldGroup.isVisible) {
            continue;
          }

          for (const viewField of viewFieldGroup.viewFields ?? []) {
            if (viewField.isVisible) {
              fieldIdentifiers.add(viewField.fieldMetadataId);
            }
          }
        }
        continue;
      }

      if (isNonEmptyArray(view.viewFields)) {
        for (const viewField of view.viewFields) {
          if (viewField.isVisible) {
            fieldIdentifiers.add(viewField.fieldMetadataId);
          }
        }
        continue;
      }

      return CANNOT_RESTRICT;
    }
  }

  return { canRestrictToVisibleFields: true, fieldIdentifiers };
};

import { type PageLayout } from '@/page-layout/types/PageLayout';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { computePageLayoutVisibleFieldIdentifiers } from '@/page-layout/utils/computePageLayoutVisibleFieldIdentifiers';
import { type ViewWithRelations } from '@/views/types/ViewWithRelations';
import { WidgetType } from '~/generated-metadata/graphql';

const buildWidget = (
  type: WidgetType,
  configuration: Record<string, unknown>,
): PageLayoutWidget =>
  ({
    id: `widget-${type}-${JSON.stringify(configuration)}`,
    type,
    configuration,
  }) as unknown as PageLayoutWidget;

const buildPageLayout = (widgets: PageLayoutWidget[]): PageLayout =>
  ({
    id: 'page-layout-id',
    tabs: [
      {
        id: 'tab-1',
        widgets: widgets.slice(0, 1),
      },
      {
        id: 'tab-2',
        widgets: widgets.slice(1),
      },
    ],
  }) as unknown as PageLayout;

const buildView = (
  view: Partial<ViewWithRelations>,
): ViewWithRelations => view as ViewWithRelations;

describe('computePageLayoutVisibleFieldIdentifiers', () => {
  it('should not restrict when the page layout is undefined', () => {
    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout: undefined,
      viewsById: new Map(),
    });

    expect(result.canRestrictToVisibleFields).toBe(false);
  });

  it('should collect visible view fields from a fields widget backed by a view', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELDS, { viewId: 'view-1' }),
    ]);

    const viewsById = new Map([
      [
        'view-1',
        buildView({
          id: 'view-1',
          viewFields: [
            {
              id: 'view-field-1',
              fieldMetadataId: 'field-visible',
              isVisible: true,
              position: 0,
            },
            {
              id: 'view-field-2',
              fieldMetadataId: 'field-hidden',
              isVisible: false,
              position: 1,
            },
          ] as ViewWithRelations['viewFields'],
        }),
      ],
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById,
    });

    expect(result).toEqual({
      canRestrictToVisibleFields: true,
      fieldIdentifiers: new Set(['field-visible']),
    });
  });

  it('should collect visible view fields from visible view field groups only', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELDS, { viewId: 'view-1' }),
    ]);

    const viewsById = new Map([
      [
        'view-1',
        buildView({
          id: 'view-1',
          viewFields: [],
          viewFieldGroups: [
            {
              id: 'group-visible',
              isVisible: true,
              viewFields: [
                {
                  id: 'view-field-1',
                  fieldMetadataId: 'field-in-visible-group',
                  isVisible: true,
                  position: 0,
                },
                {
                  id: 'view-field-2',
                  fieldMetadataId: 'field-hidden-in-visible-group',
                  isVisible: false,
                  position: 1,
                },
              ],
            },
            {
              id: 'group-hidden',
              isVisible: false,
              viewFields: [
                {
                  id: 'view-field-3',
                  fieldMetadataId: 'field-in-hidden-group',
                  isVisible: true,
                  position: 0,
                },
              ],
            },
          ] as ViewWithRelations['viewFieldGroups'],
        }),
      ],
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById,
    });

    expect(result).toEqual({
      canRestrictToVisibleFields: true,
      fieldIdentifiers: new Set(['field-in-visible-group']),
    });
  });

  it('should collect the field metadata identifier of a field widget', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELD, { fieldMetadataId: 'single-field-id' }),
      buildWidget(WidgetType.TIMELINE, {}),
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById: new Map(),
    });

    expect(result).toEqual({
      canRestrictToVisibleFields: true,
      fieldIdentifiers: new Set(['single-field-id']),
    });
  });

  it('should not restrict when a fields widget allows the user to see hidden fields', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELDS, {
        viewId: 'view-1',
        shouldAllowUserToSeeHiddenFields: true,
      }),
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById: new Map([['view-1', buildView({ id: 'view-1' })]]),
    });

    expect(result.canRestrictToVisibleFields).toBe(false);
  });

  it('should not restrict when a fields widget has no view id', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELDS, {}),
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById: new Map(),
    });

    expect(result.canRestrictToVisibleFields).toBe(false);
  });

  it('should not restrict when the referenced view is not loaded', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELDS, { viewId: 'missing-view' }),
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById: new Map(),
    });

    expect(result.canRestrictToVisibleFields).toBe(false);
  });

  it('should not restrict when the referenced view has no view fields', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELDS, { viewId: 'view-1' }),
    ]);

    const viewsById = new Map([
      ['view-1', buildView({ id: 'view-1', viewFields: [] })],
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById,
    });

    expect(result.canRestrictToVisibleFields).toBe(false);
  });

  it('should union field identifiers across widgets and tabs', () => {
    const pageLayout = buildPageLayout([
      buildWidget(WidgetType.FIELDS, { viewId: 'view-1' }),
      buildWidget(WidgetType.FIELD, { fieldMetadataId: 'field-from-widget' }),
    ]);

    const viewsById = new Map([
      [
        'view-1',
        buildView({
          id: 'view-1',
          viewFields: [
            {
              id: 'view-field-1',
              fieldMetadataId: 'field-from-view',
              isVisible: true,
              position: 0,
            },
          ] as ViewWithRelations['viewFields'],
        }),
      ],
    ]);

    const result = computePageLayoutVisibleFieldIdentifiers({
      pageLayout,
      viewsById,
    });

    expect(result).toEqual({
      canRestrictToVisibleFields: true,
      fieldIdentifiers: new Set(['field-from-view', 'field-from-widget']),
    });
  });
});

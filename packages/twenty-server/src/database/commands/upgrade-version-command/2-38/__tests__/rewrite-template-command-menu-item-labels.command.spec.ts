import {
  buildStandardDisplayFieldsByEngineComponentKey,
  planTemplateCommandMenuItemLabelRewrite,
} from 'src/database/commands/upgrade-version-command/2-38/2-38-workspace-command-1788200701003-rewrite-template-command-menu-item-labels.command';
import { EngineComponentKey } from 'src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';
import { type FlatCommandMenuItem } from 'src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';

const NOW = '2026-09-05T00:00:00.000Z';

const buildItem = (
  overrides: Partial<FlatCommandMenuItem> & Pick<FlatCommandMenuItem, 'id'>,
): FlatCommandMenuItem =>
  ({
    universalIdentifier: `universal-${overrides.id}`,
    engineComponentKey: EngineComponentKey.CREATE_NEW_RECORD,
    label: 'New ${capitalize(objectMetadataItem.labelSingular)}',
    shortLabel: null,
    icon: 'IconPlus',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as FlatCommandMenuItem;

const buildMaps = (
  items: FlatCommandMenuItem[],
): FlatEntityMaps<FlatCommandMenuItem> =>
  ({
    byUniversalIdentifier: Object.fromEntries(
      items.map((item) => [item.universalIdentifier, item]),
    ),
    universalIdentifierById: Object.fromEntries(
      items.map((item) => [item.id, item.universalIdentifier]),
    ),
    universalIdentifiersByApplicationId: {},
  }) as unknown as FlatEntityMaps<FlatCommandMenuItem>;

describe('buildStandardDisplayFieldsByEngineComponentKey', () => {
  const byKey = buildStandardDisplayFieldsByEngineComponentKey();

  it('should expose keys that name exactly one standard item', () => {
    expect(byKey[EngineComponentKey.CREATE_NEW_RECORD]?.icon).toBe('IconPlus');
    expect(byKey[EngineComponentKey.IMPORT_RECORDS]).toBeDefined();
    expect(byKey[EngineComponentKey.SEE_DELETED_RECORDS]).toBeDefined();
  });

  it('should leave out keys shared by several standard items', () => {
    expect(byKey[EngineComponentKey.NAVIGATION]).toBeUndefined();
    expect(byKey[EngineComponentKey.COMPOSE_EMAIL]).toBeUndefined();
  });
});

describe('planTemplateCommandMenuItemLabelRewrite', () => {
  const standard = buildStandardDisplayFieldsByEngineComponentKey();

  it('should rewrite a template label from the standard item with the same key', () => {
    const plan = planTemplateCommandMenuItemLabelRewrite({
      flatCommandMenuItemMaps: buildMaps([buildItem({ id: 'new-record' })]),
      standardDisplayFieldsByEngineComponentKey: standard,
      now: NOW,
    });

    expect(plan.skippedUniversalIdentifiers).toEqual([]);
    expect(plan.flatCommandMenuItemsToUpdate).toHaveLength(1);
    expect(plan.flatCommandMenuItemsToUpdate[0]).toMatchObject({
      id: 'new-record',
      label: standard[EngineComponentKey.CREATE_NEW_RECORD]?.label,
      shortLabel: standard[EngineComponentKey.CREATE_NEW_RECORD]?.shortLabel,
      updatedAt: NOW,
    });
    expect(plan.flatCommandMenuItemsToUpdate[0].label).not.toContain('${');
  });

  it('should leave items without a template alone', () => {
    const plan = planTemplateCommandMenuItemLabelRewrite({
      flatCommandMenuItemMaps: buildMaps([
        buildItem({ id: 'fine', label: 'New {objectLabelSingular}' }),
      ]),
      standardDisplayFieldsByEngineComponentKey: standard,
      now: NOW,
    });

    expect(plan.flatCommandMenuItemsToUpdate).toEqual([]);
    expect(plan.skippedUniversalIdentifiers).toEqual([]);
  });

  it('should skip and report a template on a key it cannot match', () => {
    const plan = planTemplateCommandMenuItemLabelRewrite({
      flatCommandMenuItemMaps: buildMaps([
        buildItem({
          id: 'email',
          engineComponentKey: EngineComponentKey.COMPOSE_EMAIL,
        }),
        buildItem({
          id: 'nav',
          engineComponentKey: EngineComponentKey.NAVIGATION,
        }),
      ]),
      standardDisplayFieldsByEngineComponentKey: standard,
      now: NOW,
    });

    expect(plan.flatCommandMenuItemsToUpdate).toEqual([]);
    expect(plan.skippedUniversalIdentifiers).toEqual([
      'universal-email',
      'universal-nav',
    ]);
  });

  it('should catch a template hiding in the short label or icon', () => {
    const plan = planTemplateCommandMenuItemLabelRewrite({
      flatCommandMenuItemMaps: buildMaps([
        buildItem({
          id: 'short',
          label: 'Create new record',
          shortLabel: 'New ${capitalize(objectMetadataItem.labelSingular)}',
        }),
      ]),
      standardDisplayFieldsByEngineComponentKey: standard,
      now: NOW,
    });

    expect(plan.flatCommandMenuItemsToUpdate.map((item) => item.id)).toEqual([
      'short',
    ]);
  });
});

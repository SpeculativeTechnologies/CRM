import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LOG_CONTACT_TAB_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from '../src/constants/universal-identifiers.ts';
import { configurePersonTab } from './configure-person-tab.mjs';

const setup = (tabs, layoutsCount = 1) => {
  const writes = [];
  const request = async (query, variables) => {
    if (query.includes('frontComponents'))
      return {
        objects: {
          edges: [{ node: { id: 'person-object', nameSingular: 'person' } }],
        },
        frontComponents: [
          {
            id: 'contact-component',
            universalIdentifier:
              LOG_CONTACT_TAB_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        ],
      };
    if (query.includes('getPageLayouts'))
      return {
        getPageLayouts: Array.from({ length: layoutsCount }, (_, index) => ({
          id: `existing-layout-${index}`,
          tabs,
        })),
      };
    writes.push({ query, variables });
    return { createPageLayoutTab: { id: 'new-contact-tab' } };
  };
  return { request, writes };
};

test('adds only the contact tab and widget to the existing layout', async () => {
  const tabs = [
    { id: 'home', title: 'Home', position: 10, widgets: [{ id: 'fields' }] },
    { id: 'timeline', title: 'Timeline', position: 20, widgets: [] },
    { id: 'tasks', title: 'Tasks', position: 30, widgets: [] },
  ];
  const original = structuredClone(tabs);
  const { request, writes } = setup(tabs);
  assert.deepEqual(await configurePersonTab({ request, apply: true }), {
    status: 'configured',
  });
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].variables.input, {
    pageLayoutId: 'existing-layout-0',
    title: 'Log contact',
    position: 25,
    layoutMode: 'VERTICAL_LIST',
  });
  assert.equal(
    writes[1].variables.input.configuration.frontComponentId,
    'contact-component',
  );
  assert.deepEqual(tabs, original);
});

test('does not create duplicates when the component is already configured', async () => {
  const { request, writes } = setup([
    {
      id: 'custom-title',
      title: 'My contact tab',
      widgets: [{ configuration: { frontComponentId: 'contact-component' } }],
    },
  ]);
  assert.deepEqual(await configurePersonTab({ request, apply: true }), {
    status: 'already-configured',
  });
  assert.equal(writes.length, 0);
});

test('previews without writing and resumes an interrupted empty tab', async () => {
  const { request, writes } = setup([
    { id: 'empty-tab', title: 'Log contact', widgets: [] },
  ]);
  assert.deepEqual(await configurePersonTab({ request }), {
    status: 'ready',
    tabsToAdd: 0,
    widgetsToAdd: 1,
  });
  assert.equal(writes.length, 0);
  await configurePersonTab({ request, apply: true });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].variables.input.pageLayoutTabId, 'empty-tab');
});

test('leaves a conflicting user tab unchanged', async () => {
  const { request, writes } = setup([
    {
      title: 'Log contact',
      widgets: [{ configuration: { frontComponentId: 'another-component' } }],
    },
  ]);
  await assert.rejects(
    configurePersonTab({ request, apply: true }),
    /left unchanged/,
  );
  assert.equal(writes.length, 0);
});

test('refuses to guess when several Person layouts exist', async () => {
  const { request, writes } = setup([], 2);
  await assert.rejects(
    configurePersonTab({ request, apply: true }),
    /exactly one/,
  );
  assert.equal(writes.length, 0);
});

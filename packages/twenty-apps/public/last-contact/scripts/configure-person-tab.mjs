import { pathToFileURL } from 'node:url';

import { LOG_CONTACT_TAB_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from '../src/constants/universal-identifiers.ts';

export const configurePersonTab = async ({ request, apply = false }) => {
  const { objects, frontComponents } = await request(`query {
    objects(paging: {first: 1000}) { edges { node { id nameSingular } } }
    frontComponents { id universalIdentifier }
  }`);
  const person = objects.edges.find(
    ({ node }) => node.nameSingular === 'person',
  )?.node;
  const component = frontComponents.find(
    ({ universalIdentifier }) =>
      universalIdentifier ===
      LOG_CONTACT_TAB_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  );

  if (!person || !component) {
    throw new Error(
      'Install the Last contact app with its tab component first.',
    );
  }

  const { getPageLayouts: layouts } = await request(
    `query($objectMetadataId: String!) {
      getPageLayouts(objectMetadataId: $objectMetadataId, pageLayoutType: RECORD_PAGE) {
        id tabs { id title position widgets {
          id configuration { ... on FrontComponentConfiguration { frontComponentId } }
        } }
      }
    }`,
    { objectMetadataId: person.id },
  );

  if (layouts.length !== 1) {
    throw new Error(
      'Expected exactly one Person record layout; no layout was changed.',
    );
  }

  const layout = layouts[0];
  const configured = layout.tabs.find((tab) =>
    tab.widgets.some(
      (widget) => widget.configuration?.frontComponentId === component.id,
    ),
  );
  if (configured) return { status: 'already-configured' };

  let tab = layout.tabs.find(({ title }) => title === 'Log contact');
  if (tab?.widgets.length) {
    throw new Error(
      'A different Log contact tab already exists; it was left unchanged.',
    );
  }
  if (!apply)
    return { status: 'ready', tabsToAdd: tab ? 0 : 1, widgetsToAdd: 1 };

  if (!tab) {
    const timeline = layout.tabs.find(({ title }) => title === 'Timeline');
    const positions = layout.tabs.map(({ position }) => position);
    const previousPosition = timeline?.position ?? Math.max(0, ...positions);
    const nextPosition = Math.min(
      ...positions.filter((position) => position > previousPosition),
    );
    const position = Number.isFinite(nextPosition)
      ? (previousPosition + nextPosition) / 2
      : previousPosition + 10;
    const result = await request(
      `mutation($input: CreatePageLayoutTabInput!) {
        createPageLayoutTab(input: $input) { id }
      }`,
      {
        input: {
          pageLayoutId: layout.id,
          title: 'Log contact',
          position,
          layoutMode: 'VERTICAL_LIST',
        },
      },
    );
    tab = result.createPageLayoutTab;
  }

  // Reuse an empty tab after an interrupted run; never replace existing widgets.
  await request(
    `mutation($input: CreatePageLayoutWidgetInput!) {
      createPageLayoutWidget(input: $input) { id }
    }`,
    {
      input: {
        pageLayoutTabId: tab.id,
        title: 'Log contact',
        type: 'FRONT_COMPONENT',
        position: { layoutMode: 'VERTICAL_LIST', index: 0 },
        configuration: {
          configurationType: 'FRONT_COMPONENT',
          frontComponentId: component.id,
        },
      },
    },
  );
  return { status: 'configured' };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { TWENTY_API_URL, TWENTY_API_KEY } = process.env;
  if (!TWENTY_API_URL || !TWENTY_API_KEY) {
    throw new Error(
      'Set TWENTY_API_URL and TWENTY_API_KEY with permission to edit layouts.',
    );
  }
  const request = async (query, variables = {}) => {
    const response = await fetch(
      `${TWENTY_API_URL.replace(/\/$/, '')}/metadata`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TWENTY_API_KEY}`,
        },
        body: JSON.stringify({ query, variables }),
      },
    );
    const result = await response.json();
    if (!response.ok || result.errors) {
      throw new Error(
        'Layout API request failed; check the app installation and layout permissions.',
      );
    }
    return result.data;
  };
  console.log(
    JSON.stringify(
      await configurePersonTab({
        request,
        apply: process.argv.includes('--apply'),
      }),
    ),
  );
}

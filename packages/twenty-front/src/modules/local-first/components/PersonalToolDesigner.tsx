// This separate entry has no CRM keyboard shortcuts or focus-stack provider.
// oxlint-disable twenty/require-text-input-focus-handlers
import { Trans } from '@lingui/react/macro';
import { PersonalToolFields } from '@/local-first/components/PersonalToolFields';

import { StyledPersonalToolActions } from '@/local-first/components/PersonalToolStyles';
import {
  type PersonalTool,
  type PersonalToolView,
} from '@/local-first/types/PersonalTool';

export const PersonalToolDesigner = ({
  tool,
  view,
  onChange,
  onSelectView,
}: {
  tool: PersonalTool;
  view: PersonalToolView;
  onChange: (tool: PersonalTool) => void;
  onSelectView: (id: string) => void;
}) => {
  const changeView = (next: PersonalToolView) =>
    onChange({
      ...tool,
      views: tool.views.map((candidate) =>
        candidate.id === view.id ? next : candidate,
      ),
    });
  return (
    <>
      <StyledPersonalToolActions>
        <label>
          <Trans>View</Trans>
          <select
            value={view.id}
            onChange={(event) => onSelectView(event.target.value)}
          >
            {tool.views.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            const copy = {
              ...view,
              id: crypto.randomUUID(),
              name: `${view.name} (copy)`,
            };
            onChange({ ...tool, views: [...tool.views, copy] });
            onSelectView(copy.id);
          }}
        >
          <Trans>Duplicate view</Trans>
        </button>
      </StyledPersonalToolActions>
      <details>
        <summary>
          <Trans>Shape this tool</Trans>
        </summary>
        <StyledPersonalToolActions>
          <label>
            <Trans>View name</Trans>
            <input
              defaultValue={view.name}
              key={`${view.id}:${view.name}`}
              maxLength={200}
              onBlur={(event) => {
                if (
                  event.target.value.trim() &&
                  event.target.value !== view.name
                )
                  changeView({ ...view, name: event.target.value });
              }}
            />
          </label>
          <label>
            <Trans>Filter field</Trans>
            <select
              value={view.filter?.fieldId ?? ''}
              onChange={(event) =>
                changeView({
                  ...view,
                  filter: event.target.value
                    ? {
                        fieldId: event.target.value,
                        value: view.filter?.value ?? '',
                      }
                    : null,
                })
              }
            >
              <option value="">
                <Trans>All records</Trans>
              </option>
              {tool.fields
                .filter((field) => !field.archived)
                .map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
            </select>
          </label>
          {view.filter && (
            <label>
              <Trans>Contains</Trans>
              <input
                defaultValue={view.filter.value}
                maxLength={1000}
                key={`${view.id}:${view.filter.fieldId}:${view.filter.value}`}
                onBlur={(event) => {
                  if (view.filter && view.filter.value !== event.target.value)
                    changeView({
                      ...view,
                      filter: { ...view.filter, value: event.target.value },
                    });
                }}
              />
            </label>
          )}
          <label>
            <Trans>Sort field</Trans>
            <select
              value={view.sort?.fieldId ?? ''}
              onChange={(event) =>
                changeView({
                  ...view,
                  sort: event.target.value
                    ? {
                        fieldId: event.target.value,
                        direction: view.sort?.direction ?? 'ascending',
                      }
                    : null,
                })
              }
            >
              <option value="">
                <Trans>Original order</Trans>
              </option>
              {tool.fields
                .filter((field) => !field.archived)
                .map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
            </select>
          </label>
          {view.sort && (
            <select
              aria-label="Sort direction"
              value={view.sort.direction}
              onChange={(event) => {
                if (view.sort)
                  changeView({
                    ...view,
                    sort: {
                      ...view.sort,
                      direction:
                        event.target.value === 'descending'
                          ? 'descending'
                          : 'ascending',
                    },
                  });
              }}
            >
              <option value="ascending">
                <Trans>Ascending</Trans>
              </option>
              <option value="descending">
                <Trans>Descending</Trans>
              </option>
            </select>
          )}
        </StyledPersonalToolActions>
        <PersonalToolFields tool={tool} view={view} onChange={onChange} />
      </details>
    </>
  );
};

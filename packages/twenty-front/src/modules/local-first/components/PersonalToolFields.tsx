// This separate entry has no CRM keyboard shortcuts or focus-stack provider.
// oxlint-disable twenty/require-text-input-focus-handlers
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { StyledPersonalToolActions } from '@/local-first/components/PersonalToolStyles';
import {
  type PersonalTool,
  type PersonalToolField,
  type PersonalToolView,
} from '@/local-first/types/PersonalTool';

export const PersonalToolFields = ({
  tool,
  view,
  onChange,
}: {
  tool: PersonalTool;
  view: PersonalToolView;
  onChange: (tool: PersonalTool) => void;
}) => {
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<PersonalToolField['type']>('text');
  const changeView = (next: PersonalToolView) =>
    onChange({
      ...tool,
      views: tool.views.map((candidate) =>
        candidate.id === view.id ? next : candidate,
      ),
    });
  return (
    <>
      <h2>
        <Trans>Fields and columns</Trans>
      </h2>
      <p>
        <small>
          <Trans>
            Archived fields keep their values and can be restored here.
          </Trans>
        </small>
      </p>
      {tool.fields.map((field) => (
        <StyledPersonalToolActions key={field.id}>
          <input
            aria-label={`Rename ${field.label}`}
            defaultValue={field.label}
            key={`${field.id}:${field.label}`}
            maxLength={200}
            onBlur={(event) => {
              if (
                event.target.value.trim() &&
                field.label !== event.target.value
              )
                onChange({
                  ...tool,
                  fields: tool.fields.map((candidate) =>
                    candidate.id === field.id
                      ? { ...candidate, label: event.target.value }
                      : candidate,
                  ),
                });
            }}
          />
          <small>{field.type}</small>
          {!field.archived && (
            <label>
              <input
                type="checkbox"
                checked={view.columns.includes(field.id)}
                onChange={(event) =>
                  changeView({
                    ...view,
                    columns: event.target.checked
                      ? [...view.columns, field.id]
                      : view.columns.filter((fieldId) => fieldId !== field.id),
                  })
                }
              />
              <Trans>Visible</Trans>
            </label>
          )}
          <button
            onClick={() =>
              onChange({
                ...tool,
                fields: tool.fields.map((candidate) =>
                  candidate.id === field.id
                    ? { ...candidate, archived: !candidate.archived }
                    : candidate,
                ),
                views: tool.views.map((candidate) => ({
                  ...candidate,
                  filter:
                    !field.archived && candidate.filter?.fieldId === field.id
                      ? null
                      : candidate.filter,
                  sort:
                    !field.archived && candidate.sort?.fieldId === field.id
                      ? null
                      : candidate.sort,
                })),
              })
            }
          >
            {field.archived ? (
              <Trans>Restore field</Trans>
            ) : (
              <Trans>Archive field</Trans>
            )}
          </button>
        </StyledPersonalToolActions>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!fieldLabel.trim()) return;
          const field = {
            id: crypto.randomUUID(),
            label: fieldLabel,
            type: fieldType,
            archived: false,
          };
          onChange({
            ...tool,
            fields: [...tool.fields, field],
            views: tool.views.map((candidate) =>
              candidate.id === view.id
                ? { ...candidate, columns: [...candidate.columns, field.id] }
                : candidate,
            ),
          });
          setFieldLabel('');
        }}
      >
        <StyledPersonalToolActions>
          <label>
            <Trans>New field</Trans>
            <input
              value={fieldLabel}
              required
              maxLength={200}
              onChange={(event) => setFieldLabel(event.target.value)}
            />
          </label>
          <label>
            <Trans>Field type</Trans>
            <select
              value={fieldType}
              onChange={(event) =>
                setFieldType(event.target.value as PersonalToolField['type'])
              }
            >
              <option value="text">
                <Trans>Text</Trans>
              </option>
              <option value="number">
                <Trans>Number</Trans>
              </option>
              <option value="checkbox">
                <Trans>Checkbox</Trans>
              </option>
            </select>
          </label>
          <button type="submit">
            <Trans>Add field</Trans>
          </button>
        </StyledPersonalToolActions>
      </form>
    </>
  );
};

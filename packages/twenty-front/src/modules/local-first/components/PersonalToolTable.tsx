// This separate entry has no CRM keyboard shortcuts or focus-stack provider.
// oxlint-disable twenty/require-text-input-focus-handlers
import { Trans } from '@lingui/react/macro';

import { StyledPersonalToolTableContainer } from '@/local-first/components/PersonalToolStyles';
import {
  type PersonalTool,
  type PersonalToolView,
} from '@/local-first/types/PersonalTool';
import { projectPersonalTool } from '@/local-first/utils/projectPersonalTool';

export const PersonalToolTable = ({
  tool,
  view,
  onChange,
}: {
  tool: PersonalTool;
  view: PersonalToolView;
  onChange: (tool: PersonalTool) => void;
}) => {
  const fields = view.columns.flatMap((fieldId) => {
    const field = tool.fields.find(
      (candidate) => candidate.id === fieldId && !candidate.archived,
    );
    return field ? [field] : [];
  });
  const records = projectPersonalTool(tool, view);
  const changeValue = (
    recordId: string,
    fieldId: string,
    value: string | number | boolean | null,
  ) => {
    if (
      tool.records.find((record) => record.id === recordId)?.values[fieldId] ===
      value
    )
      return;
    onChange({
      ...tool,
      records: tool.records.map((record) =>
        record.id === recordId
          ? { ...record, values: { ...record.values, [fieldId]: value } }
          : record,
      ),
    });
  };
  return (
    <>
      <StyledPersonalToolTableContainer>
        <table>
          <thead>
            <tr>
              <th>
                <Trans>Record</Trans>
              </th>
              {fields.map((field) => (
                <th key={field.id}>{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr key={record.id}>
                <td>
                  {index + 1}
                  {record.source && (
                    <small>
                      {' '}
                      · <Trans>CRM copy</Trans>
                    </small>
                  )}
                </td>
                {fields.map((field) => (
                  <td key={field.id}>
                    {field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        aria-label={`${field.label} ${index + 1}`}
                        checked={record.values[field.id] === true}
                        onChange={(event) =>
                          changeValue(record.id, field.id, event.target.checked)
                        }
                      />
                    ) : (
                      <input
                        key={`${record.id}:${field.id}:${String(record.values[field.id])}`}
                        aria-label={`${field.label} ${index + 1}`}
                        type={field.type === 'number' ? 'number' : 'text'}
                        step="any"
                        maxLength={100000}
                        defaultValue={String(record.values[field.id] ?? '')}
                        onBlur={(event) => {
                          const value = event.target.value;
                          if (
                            field.type === 'number' &&
                            value !== '' &&
                            !Number.isFinite(Number(value))
                          )
                            return;
                          changeValue(
                            record.id,
                            field.id,
                            field.type === 'number'
                              ? value === ''
                                ? null
                                : Number(value)
                              : value,
                          );
                        }}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <p>
            <Trans>No records match this view.</Trans>
          </p>
        )}
      </StyledPersonalToolTableContainer>
      <p>
        <small>
          {records.length} / {tool.records.length} <Trans>records</Trans>
        </small>
      </p>
      <button
        onClick={() =>
          onChange({
            ...tool,
            records: [...tool.records, { id: crypto.randomUUID(), values: {} }],
          })
        }
      >
        <Trans>Add record</Trans>
      </button>
    </>
  );
};

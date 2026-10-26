import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmailTemplatePreview } from '@/activities/emails/templates/components/EmailTemplatePreview';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';

jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: () => ({ objectMetadataItem: { fields: [] } }),
}));

jest.mock('@/object-record/hooks/useFindOneRecord', () => ({
  useFindOneRecord: jest.fn(),
}));
jest.mock(
  '@/activities/emails/templates/components/EmailTemplateActionButton',
  () => ({
    EmailTemplateActionButton: ({
      title,
      disabled,
      onClick,
    }: {
      title: string;
      disabled: boolean;
      onClick: () => void;
    }) => (
      <button disabled={disabled} onClick={onClick}>
        {title}
      </button>
    ),
  }),
);
jest.mock(
  '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker',
  () => ({
    FormSingleRecordPicker: ({ label }: { label: string }) => (
      <span>{label}</span>
    ),
  }),
);
jest.mock(
  '@/advanced-text-editor/components/FormAdvancedTextFieldInput',
  () => ({
    FormAdvancedTextFieldInput: ({
      defaultValue,
    }: {
      defaultValue: string;
    }) => <pre>{defaultValue}</pre>,
  }),
);

const content = {
  subject: 'Welcome {{firstName}}',
  body: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello {{fullName}}' }],
      },
    ],
  }),
};
const mockedFindOne = jest.mocked(useFindOneRecord);

describe('EmailTemplatePreview', () => {
  beforeEach(() => {
    mockedFindOne.mockReturnValue({
      record: {
        __typename: 'Person',
        id: 'person-1',
        name: { firstName: 'Ada', lastName: 'Lovelace' },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });
  });

  it('should preview a person and insert resolved subject and body into a single email', async () => {
    const onApply = jest.fn().mockResolvedValue(undefined);

    render(
      <EmailTemplatePreview
        content={content}
        personalize
        defaultPersonId="person-1"
        disabled={false}
        replacesContent={false}
        onApply={onApply}
      />,
    );
    expect(screen.getByText('Welcome Ada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use template' }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Welcome Ada',
        body: expect.stringContaining('Hello Ada Lovelace'),
      }),
    );
  });

  it('should preview a person but preserve placeholders when inserting into a campaign', async () => {
    const onApply = jest.fn().mockResolvedValue(undefined);

    render(
      <EmailTemplatePreview
        content={content}
        personalize={false}
        defaultPersonId="person-1"
        disabled={false}
        replacesContent={false}
        onApply={onApply}
      />,
    );
    expect(screen.getByText('Welcome Ada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use template' }));
    expect(onApply).toHaveBeenCalledWith(content);
  });

  it('should prevent inserting personalized single-email content without an accessible person', () => {
    mockedFindOne.mockReturnValue({
      record: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });
    render(
      <EmailTemplatePreview
        content={content}
        personalize
        disabled={false}
        replacesContent={false}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Use template' })).toBeDisabled();
    expect(
      screen.getByText(
        'Choose a person to preview and fill personalized fields.',
      ),
    ).toBeInTheDocument();
  });

  it('should show missing values before the user inserts a template', () => {
    mockedFindOne.mockReturnValue({
      record: {
        __typename: 'Person',
        id: 'person-1',
        name: { firstName: '', lastName: '' },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });
    render(
      <EmailTemplatePreview
        content={content}
        personalize
        defaultPersonId="person-1"
        disabled={false}
        replacesContent={false}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('firstName, fullName');
  });
});

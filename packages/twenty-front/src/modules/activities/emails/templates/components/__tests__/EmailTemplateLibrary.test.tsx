import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmailTemplateLibrary } from '@/activities/emails/templates/components/EmailTemplateLibrary';
import { useEmailTemplates } from '@/activities/emails/templates/hooks/useEmailTemplates';

jest.mock('@/activities/emails/templates/hooks/useEmailTemplates', () => ({
  useEmailTemplates: jest.fn(),
}));
jest.mock('@/ui/input/hooks/useTextInputFocusStack', () => ({
  useTextInputFocusStack: () => ({
    handleFocus: jest.fn(),
    handleBlur: jest.fn(),
  }),
}));
jest.mock(
  '@/advanced-text-editor/components/FormAdvancedTextFieldInput',
  () => ({
    FormAdvancedTextFieldInput: ({
      label,
      defaultValue,
    }: {
      label: string;
      defaultValue: string;
    }) => <div aria-label={label}>{defaultValue}</div>,
  }),
);
jest.mock(
  '@/activities/emails/templates/components/EmailTemplatePreview',
  () => ({
    EmailTemplatePreview: () => <div>Template preview</div>,
  }),
);

const templates = [
  {
    id: 'welcome',
    name: 'Welcome',
    subject: 'Hi {{firstName}}',
    body: 'Welcome body',
    updatedAt: '2026-10-26',
  },
  {
    id: 'follow-up',
    name: 'Follow up',
    subject: 'Following up',
    body: 'Follow-up body',
    updatedAt: '2026-10-26',
  },
];
const mockedTemplates = jest.mocked(useEmailTemplates);
const saveTemplate = jest.fn();
const deleteTemplate = jest.fn();
const state = () => ({
  templates,
  loading: false,
  error: undefined,
  isSaving: false,
  isDeleting: false,
  saveTemplate,
  deleteTemplate,
});
const renderLibrary = () =>
  render(
    <EmailTemplateLibrary
      currentContent={{ subject: '', body: '' }}
      personalize={false}
      onApply={jest.fn()}
      onClose={jest.fn()}
    />,
  );

describe('EmailTemplateLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTemplates.mockReturnValue(state());
  });

  it('should open a saved template and visibly list all selectable templates', async () => {
    renderLibrary();
    const saved = within(
      screen.getByRole('region', { name: 'Saved templates' }),
    );
    expect(saved.getByRole('button', { name: 'Welcome' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue(
      'Welcome',
    );
    await userEvent.click(saved.getByRole('button', { name: 'Follow up' }));
    expect(saved.getByRole('button', { name: 'Follow up' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Following up',
    );
  });

  it('should choose the first saved template when loading finishes', () => {
    mockedTemplates.mockReturnValue({
      ...state(),
      templates: [],
      loading: true,
    });
    const { rerender } = renderLibrary();
    expect(
      screen.queryByRole('textbox', { name: 'Template name' }),
    ).not.toBeInTheDocument();
    mockedTemplates.mockReturnValue(state());
    rerender(
      <EmailTemplateLibrary
        currentContent={{ subject: '', body: '' }}
        personalize={false}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue(
      'Welcome',
    );
  });

  it('should require an explicit New template action even when the library is empty', async () => {
    mockedTemplates.mockReturnValue({ ...state(), templates: [] });
    renderLibrary();
    expect(
      screen.getByText(
        'No saved templates yet. Choose New template to create one.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Template name' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New template' }));
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue(
      '',
    );
  });

  it('should expose literal tokens for typing into the subject or body without insertion menus', () => {
    renderLibrary();
    const reference = within(
      screen.getByRole('note', { name: 'Personalization fields' }),
    );
    for (const token of [
      'firstName',
      'lastName',
      'fullName',
      'email',
      'jobTitle',
      'city',
    ]) {
      expect(reference.getByText(`{{${token}}}`)).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('button', { name: /Insert a field/ }),
    ).not.toBeInTheDocument();
  });

  it('should confirm switching away from an edited template and keep the selected template until confirmed', async () => {
    renderLibrary();
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), '!');
    await userEvent.click(screen.getByRole('button', { name: 'New template' }));
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue(
      'Welcome',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Hi {{firstName}}!',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Follow up' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard and switch' }),
    );
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Following up',
    );
  });

  it('should update the default selected template using only editable fields and its id', async () => {
    saveTemplate.mockResolvedValue({
      ...templates[0],
      subject: 'Hi {{firstName}}!',
    });
    renderLibrary();
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), '!');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save template' }),
    );
    expect(saveTemplate).toHaveBeenCalledWith({
      id: 'welcome',
      name: 'Welcome',
      subject: 'Hi {{firstName}}!',
      body: 'Welcome body',
    });
  });

  it('should show the remaining saved template after deleting the selected template', async () => {
    deleteTemplate.mockImplementation(async () => {
      mockedTemplates.mockReturnValue({
        ...state(),
        templates: [templates[1]],
      });
    });
    renderLibrary();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete template' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delete' }),
    );
    expect(deleteTemplate).toHaveBeenCalledWith('welcome');
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue(
      'Follow up',
    );
  });
});

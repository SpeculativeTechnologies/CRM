import { act, renderHook, waitFor } from '@testing-library/react';

import { useMassEmailCampaignDraft } from '@/activities/emails/mass-email/hooks/useMassEmailCampaignDraft';
import { useMassEmailComposerState } from '@/activities/emails/mass-email/hooks/useMassEmailComposerState';
import { useMassEmailRecipients } from '@/activities/emails/mass-email/hooks/useMassEmailRecipients';
import { useSendMassEmail } from '@/activities/emails/mass-email/hooks/useSendMassEmail';

jest.mock('@/activities/emails/mass-email/hooks/useMassEmailCampaignDraft');
jest.mock('@/activities/emails/mass-email/hooks/useMassEmailRecipients');
jest.mock('@/activities/emails/mass-email/hooks/useSendMassEmail');

const recipients = [
  {
    personId: 'person-1',
    email: 'ada@example.com',
    displayName: 'Ada Lovelace',
    avatarUrl: null,
    placeholderValues: {
      first_name: 'Ada',
      last_name: 'Lovelace',
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      job_title: '',
      city: '',
      company: '',
    },
  },
  {
    personId: 'person-2',
    email: 'grace@example.com',
    displayName: 'Grace Hopper',
    avatarUrl: null,
    placeholderValues: {
      first_name: 'Grace',
      last_name: 'Hopper',
      full_name: 'Grace Hopper',
      email: 'grace@example.com',
      job_title: '',
      city: '',
      company: '',
    },
  },
];
const saveDraftMock = jest.fn(() =>
  Promise.resolve({ campaignId: 'campaign-1', updatedAt: '2026-07-31' }),
);
const sendMassEmailMock = jest.fn(() =>
  Promise.resolve({ sentCount: 1, failedRecipients: [] }),
);

describe('useMassEmailComposerState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useMassEmailRecipients).mockImplementation((personIds) => ({
      recipients: recipients.filter(({ personId }) =>
        personIds.includes(personId),
      ),
      skippedWithoutEmail: [],
      skippedWithoutEmailCount: 0,
      loading: false,
    }));
    jest.mocked(useMassEmailCampaignDraft).mockReturnValue({
      saveDraft: saveDraftMock,
      isSaving: false,
    });
    jest.mocked(useSendMassEmail).mockReturnValue({
      sendMassEmail: sendMassEmailMock,
      sending: false,
      sentCount: 0,
    });
  });

  it('creates a campaign draft for the selected people', async () => {
    const onDraftCreated = jest.fn();
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1'],
        onDraftCreated,
      }),
    );

    await waitFor(() => {
      expect(result.current.draftCampaignId).toBe('campaign-1');
    });

    expect(saveDraftMock).toHaveBeenCalledWith({
      campaignId: undefined,
      connectedAccountId: 'account-1',
      personIds: ['person-1'],
      subject: '',
      body: '',
    });
    expect(onDraftCreated).toHaveBeenCalledWith('campaign-1');
  });

  it('uses the current template as the base email for added people', async () => {
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1'],
        initialDraft: {
          campaignId: 'campaign-1',
          subject: '',
          body: '',
        },
      }),
    );

    act(() => {
      result.current.setSubjectTemplate('Hello {first_name}');
      result.current.setBodyTemplate('<p>Hi {full_name}</p>');
      result.current.setPersonSelected('person-2', true);
    });

    const addedRecipient = result.current.includedRecipients.find(
      ({ personId }) => personId === 'person-2',
    );

    if (addedRecipient === undefined) {
      throw new Error('Added recipient was not resolved');
    }

    expect(result.current.resolveForRecipient(addedRecipient)).toMatchObject({
      subject: 'Hello Grace',
      body: '<p>Hi Grace Hopper</p>',
      isCustomized: false,
    });

    await act(async () => {
      await result.current.saveCurrentDraft();
    });

    expect(saveDraftMock).toHaveBeenLastCalledWith({
      campaignId: 'campaign-1',
      connectedAccountId: 'account-1',
      personIds: ['person-1', 'person-2'],
      subject: 'Hello {first_name}',
      body: '<p>Hi {full_name}</p>',
    });
  });

  it('sends the same campaign record with personalized recipients', async () => {
    const onSent = jest.fn();
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1'],
        onSent,
      }),
    );

    await waitFor(() => {
      expect(result.current.draftCampaignId).toBe('campaign-1');
    });

    act(() => {
      result.current.setSubjectTemplate('Hello {first_name}');
      result.current.setBodyTemplate('<p>Hi {first_name}</p>');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(sendMassEmailMock).toHaveBeenCalledWith({
      campaignId: 'campaign-1',
      connectedAccountId: 'account-1',
      emails: [
        {
          personId: 'person-1',
          to: 'ada@example.com',
          subject: 'Hello Ada',
          body: '<p>Hi Ada</p>',
        },
      ],
    });
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it('applies the shared cc list to every recipient email', async () => {
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1', 'person-2'],
        initialDraft: {
          campaignId: 'campaign-1',
          subject: 'Hello',
          body: '<p>Hello</p>',
        },
      }),
    );

    expect(result.current.isCcFieldVisible).toBe(false);

    act(() => {
      result.current.setCcTemplate([{ address: 'boss@example.com' }]);
    });

    for (const recipient of result.current.includedRecipients) {
      expect(result.current.resolveForRecipient(recipient)).toMatchObject({
        cc: [{ address: 'boss@example.com' }],
        isCustomized: false,
      });
    }

    await act(async () => {
      await result.current.handleSend();
    });

    expect(sendMassEmailMock).toHaveBeenCalledWith({
      campaignId: 'campaign-1',
      connectedAccountId: 'account-1',
      emails: [
        {
          personId: 'person-1',
          to: 'ada@example.com',
          subject: 'Hello',
          body: '<p>Hello</p>',
          cc: ['boss@example.com'],
        },
        {
          personId: 'person-2',
          to: 'grace@example.com',
          subject: 'Hello',
          body: '<p>Hello</p>',
          cc: ['boss@example.com'],
        },
      ],
    });
  });

  it('overrides the cc list for a single recipient and resets it', async () => {
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1', 'person-2'],
        initialDraft: {
          campaignId: 'campaign-1',
          subject: 'Hello',
          body: '<p>Hello</p>',
        },
      }),
    );

    act(() => {
      result.current.setCcTemplate([{ address: 'boss@example.com' }]);
    });

    act(() => {
      result.current.setRecipientCc('person-1', [
        { address: 'assistant@example.com' },
      ]);
    });

    const [firstRecipient, secondRecipient] = result.current.includedRecipients;

    expect(result.current.resolveForRecipient(firstRecipient)).toMatchObject({
      cc: [{ address: 'assistant@example.com' }],
      isCustomized: true,
    });
    expect(result.current.resolveForRecipient(secondRecipient)).toMatchObject({
      cc: [{ address: 'boss@example.com' }],
      isCustomized: false,
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(sendMassEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        emails: [
          expect.objectContaining({
            personId: 'person-1',
            cc: ['assistant@example.com'],
          }),
          expect.objectContaining({
            personId: 'person-2',
            cc: ['boss@example.com'],
          }),
        ],
      }),
    );

    act(() => {
      result.current.resetRecipientOverride('person-1');
    });

    expect(result.current.resolveForRecipient(firstRecipient)).toMatchObject({
      cc: [{ address: 'boss@example.com' }],
      isCustomized: false,
    });
  });

  it('drops the cc override when it matches the shared list again', () => {
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1'],
        initialDraft: {
          campaignId: 'campaign-1',
          subject: 'Hello',
          body: '<p>Hello</p>',
        },
      }),
    );

    act(() => {
      result.current.setCcTemplate([{ address: 'boss@example.com' }]);
    });

    act(() => {
      result.current.setRecipientCc('person-1', [
        { address: 'assistant@example.com' },
      ]);
    });

    act(() => {
      result.current.setRecipientCc('person-1', [
        { address: 'boss@example.com' },
      ]);
    });

    const [firstRecipient] = result.current.includedRecipients;

    expect(result.current.resolveForRecipient(firstRecipient)).toMatchObject({
      cc: [{ address: 'boss@example.com' }],
      isCustomized: false,
    });
  });

  it('blocks sending when a cc address is invalid or the limit is exceeded', () => {
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1'],
        initialDraft: {
          campaignId: 'campaign-1',
          subject: 'Hello',
          body: '<p>Hello</p>',
        },
      }),
    );

    expect(result.current.canSend).toBe(true);

    act(() => {
      result.current.setCcTemplate([{ address: 'not-an-email' }]);
    });

    expect(result.current.hasInvalidCcRecipients).toBe(true);
    expect(result.current.canSend).toBe(false);

    act(() => {
      result.current.setCcTemplate(
        Array.from(
          { length: result.current.maxRecipients },
          (_unused, index) => ({ address: `person-${index}@example.com` }),
        ),
      );
    });

    expect(result.current.exceedsRecipientLimit).toBe(true);
    expect(result.current.largestRecipientCount).toBe(
      result.current.maxRecipients + 1,
    );
    expect(result.current.canSend).toBe(false);
  });

  it('restores a cc list from an existing draft and reveals the field', () => {
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1'],
        initialDraft: {
          campaignId: 'campaign-1',
          subject: 'Existing subject',
          body: '<p>Existing body</p>',
          cc: 'Boss <boss@example.com>, second@example.com',
        },
      }),
    );

    expect(result.current.isCcFieldVisible).toBe(true);
    expect(result.current.ccTemplate).toEqual([
      { address: 'boss@example.com', displayName: 'Boss' },
      { address: 'second@example.com', displayName: undefined },
    ]);
  });

  it('resumes an existing draft without creating another campaign', async () => {
    const { result } = renderHook(() =>
      useMassEmailComposerState({
        connectedAccountId: 'account-1',
        personIds: ['person-1'],
        initialDraft: {
          campaignId: 'campaign-1',
          subject: 'Existing subject',
          body: '<p>Existing body</p>',
        },
      }),
    );

    expect(result.current.draftCampaignId).toBe('campaign-1');
    expect(result.current.subjectTemplate).toBe('Existing subject');
    expect(result.current.bodyTemplate).toBe('<p>Existing body</p>');
    expect(saveDraftMock).not.toHaveBeenCalled();
  });
});

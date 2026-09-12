import {
  MessageChannelSyncStage,
  MessageParticipantRole,
} from 'twenty-shared/types';

import { ATTRIBUTE_CAMPAIGN_REPLY_JOB } from 'src/engine/core-modules/emailing-domain/constants/campaign.constant';
import { type ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { type MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { MessagingMessagesImportService } from 'src/modules/messaging/message-import-manager/services/messaging-messages-import.service';
import { MessagingSaveMessagesAndEnqueueContactCreationService } from 'src/modules/messaging/message-import-manager/services/messaging-save-messages-and-enqueue-contact-creation.service';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message';

const WORKSPACE_ID = '20202020-0000-4000-8000-000000000001';
const CHANNEL_ID = '20202020-0000-4000-8000-000000000002';

const buildReply = (
  overrides: Partial<MessageWithParticipants> = {},
): MessageWithParticipants => ({
  externalId: 'provider-reply',
  headerMessageId: '<reply@acme.com>',
  messageThreadExternalId: 'provider-campaign-thread',
  receivedAt: new Date('2026-09-11T14:00:00Z'),
  direction: MessageDirection.INCOMING,
  subject: 'Re: Campaign test',
  text: 'Private internal reply body',
  attachments: [],
  isDraft: false,
  messageHeaders: [{ name: 'In-Reply-To', value: '<campaign@acme.com>' }],
  participants: [
    {
      role: MessageParticipantRole.FROM,
      handle: 'recipient@acme.com',
      displayName: 'Recipient',
    },
    {
      role: MessageParticipantRole.TO,
      handle: 'sender@acme.com',
      displayName: 'Sender',
    },
  ],
  ...overrides,
});

describe('campaign replies excluded from message storage', () => {
  let service: MessagingMessagesImportService;
  let enqueue: jest.Mock;
  let saveMessages: jest.SpyInstance;
  let getMessages: jest.Mock;
  let getBlocklist: jest.Mock;
  let getWorkspace: jest.Mock;
  let handleDriverException: jest.Mock;

  const channel = {
    id: CHANNEL_ID,
    handle: 'sender@acme.com',
    syncStage: MessageChannelSyncStage.MESSAGES_IMPORT_SCHEDULED,
    excludeGroupEmails: true,
    messageFolders: [],
  } as unknown as MessageChannelEntity;
  const account = {
    handleAliases: [],
    userWorkspaceId: 'user-workspace',
  } as unknown as ConnectedAccountEntity;

  beforeEach(() => {
    enqueue = jest.fn().mockResolvedValue(undefined);
    const saveService =
      new MessagingSaveMessagesAndEnqueueContactCreationService(
        ...([
          {},
          { add: enqueue },
          {},
          {},
          {},
          {},
        ] as unknown as ConstructorParameters<
          typeof MessagingSaveMessagesAndEnqueueContactCreationService
        >),
      );
    saveMessages = jest
      .spyOn(saveService, 'saveMessagesAndEnqueueContactCreation')
      .mockResolvedValue(undefined);
    getMessages = jest.fn().mockResolvedValue([buildReply()]);
    getBlocklist = jest.fn().mockResolvedValue([]);
    getWorkspace = jest
      .fn()
      .mockResolvedValue({ isInternalMessagesImportEnabled: false });
    handleDriverException = jest.fn();
    service = new MessagingMessagesImportService(
      ...([
        {
          setPop: jest.fn().mockResolvedValue(['provider-reply']),
          setAdd: jest.fn(),
        },
        {
          markAsMessagesImportOngoing: jest.fn(),
          markAsMessageSyncCompleted: jest.fn(),
        },
        saveService,
        { track: jest.fn() },
        { getByWorkspaceMemberId: getBlocklist },
        {},
        {
          executeInWorkspaceContext: (work: () => Promise<void>) => work(),
          getRepository: () => ({
            findOne: jest.fn().mockResolvedValue({ id: 'member' }),
          }),
        },
        { update: jest.fn() },
        { getMessages },
        { handleDriverException },
        { findOne: jest.fn().mockResolvedValue({ userId: 'user' }) },
        { findOne: getWorkspace },
        { get: () => 100 },
      ] as unknown as ConstructorParameters<
        typeof MessagingMessagesImportService
      >),
    );
  });

  const importBatch = () =>
    service.processMessageBatchImport(channel, account, WORKSPACE_ID);

  it('queues internal reply accounting without storing the message or its contents', async () => {
    await importBatch();

    expect(handleDriverException).not.toHaveBeenCalled();
    expect(saveMessages).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(ATTRIBUTE_CAMPAIGN_REPLY_JOB, {
      workspaceId: WORKSPACE_ID,
      replies: [
        {
          senderHandle: 'recipient@acme.com',
          replyHeaderMessageIds: [
            '<campaign@acme.com>',
            'campaign@acme.com',
            'campaign',
          ],
          messageChannelId: CHANNEL_ID,
          messageThreadExternalId: 'provider-campaign-thread',
          receivedAt: '2026-09-11T14:00:00.000Z',
        },
      ],
    });
    expect(JSON.stringify(enqueue.mock.calls)).not.toContain(
      'Private internal reply body',
    );
  });

  it('still honors the mailbox blocklist', async () => {
    getBlocklist.mockResolvedValue([{ handle: 'recipient@acme.com' }]);

    await importBatch();

    expect(saveMessages).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(handleDriverException).not.toHaveBeenCalled();
  });

  it.each([
    { isDraft: true },
    { direction: MessageDirection.OUTGOING },
    { messageHeaders: [] },
    {
      messageHeaders: [
        { name: 'In-Reply-To', value: '<campaign@acme.com>' },
        { name: 'Auto-Submitted', value: 'auto-replied' },
      ],
    },
  ])(
    'ignores a message that is not a human incoming reply: %j',
    async (overrides) => {
      getMessages.mockResolvedValue([buildReply(overrides)]);

      await importBatch();

      expect(enqueue).not.toHaveBeenCalled();
      expect(handleDriverException).not.toHaveBeenCalled();
    },
  );

  it('uses the normal save path when internal message import is enabled', async () => {
    getWorkspace.mockResolvedValue({ isInternalMessagesImportEnabled: true });

    await importBatch();

    expect(saveMessages).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not enqueue external replies a second time', async () => {
    const reply = buildReply();
    reply.participants[0].handle = 'recipient@other-company.com';
    getMessages.mockResolvedValue([reply]);

    await importBatch();

    expect(saveMessages).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('completes mailbox import even when reply accounting cannot be queued', async () => {
    enqueue.mockRejectedValue(new Error('Queue unavailable'));

    await importBatch();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(handleDriverException).not.toHaveBeenCalled();
  });
});

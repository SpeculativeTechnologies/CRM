import { MessageParticipantRole } from 'twenty-shared/types';
import { In, IsNull, Not } from 'typeorm';

import { MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';

import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type CampaignStatsRefreshSchedulerService } from 'src/modules/emailing/services/campaign-stats-refresh-scheduler.service';
import { MessageEngagementService } from 'src/modules/emailing/services/message-engagement.service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const CAMPAIGN_ID = '20202020-0000-0000-0000-0000000000c1';
const MESSAGE_ID = '20202020-0000-0000-0000-0000000000m1';

const SCOPE = { id: MESSAGE_ID, messageCampaignId: CAMPAIGN_ID };

describe('MessageEngagementService', () => {
  let service: MessageEngagementService;
  let updateMock: jest.Mock;
  let findOneMock: jest.Mock;
  let findMock: jest.Mock;
  let findParticipantsMock: jest.Mock;
  let scheduleMock: jest.Mock;

  beforeEach(() => {
    findOneMock = jest
      .fn()
      .mockResolvedValue({ id: MESSAGE_ID, openCount: 2, clickCount: 0 });
    findMock = jest.fn().mockResolvedValue([]);
    findParticipantsMock = jest.fn().mockResolvedValue([]);
    updateMock = jest.fn().mockResolvedValue(undefined);
    scheduleMock = jest.fn().mockResolvedValue(undefined);

    const globalWorkspaceOrmManager = {
      executeInWorkspaceContext: (work: () => Promise<void>) => work(),
      getRepository: async (_workspaceId: string, entity: unknown) =>
        entity === MessageParticipantWorkspaceEntity
          ? { find: findParticipantsMock }
          : {
              findOne: findOneMock,
              find: findMock,
              update: updateMock,
            },
    } as unknown as GlobalWorkspaceOrmManager;

    service = new MessageEngagementService(globalWorkspaceOrmManager, {
      schedule: scheduleMock,
    } as unknown as CampaignStatsRefreshSchedulerService);
  });

  const args = {
    workspaceId: WORKSPACE_ID,
    campaignId: CAMPAIGN_ID,
    messageId: MESSAGE_ID,
  };

  it('bumps the open count and stamps the first open', async () => {
    await service.recordOpen(args);

    expect(updateMock).toHaveBeenCalledWith(SCOPE, { openCount: 3 });
    expect(updateMock).toHaveBeenCalledWith(
      { ...SCOPE, openedAt: IsNull() },
      { openedAt: expect.any(Date) },
    );
  });

  it('leaves an already-stamped first open alone', async () => {
    await service.recordOpen(args);

    // The IsNull criteria is what protects the original timestamp, so the
    // update must never be issued against the bare scope.
    expect(updateMock).not.toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ openedAt: expect.anything() }),
    );
  });

  it('treats a click as proof of an open for clients that block images', async () => {
    await service.recordClick(args);

    expect(updateMock).toHaveBeenCalledWith(SCOPE, { clickCount: 1 });
    expect(updateMock).toHaveBeenCalledWith(
      { ...SCOPE, clickedAt: IsNull() },
      { clickedAt: expect.any(Date) },
    );
    expect(updateMock).toHaveBeenCalledWith(
      { ...SCOPE, openedAt: IsNull() },
      { openedAt: expect.any(Date) },
    );
  });

  it('does not touch the click fields when recording an open', async () => {
    await service.recordOpen(args);

    expect(updateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ clickedAt: IsNull() }),
      expect.anything(),
    );
  });

  it('schedules a campaign recount so the rollup catches up', async () => {
    await service.recordOpen(args);

    expect(scheduleMock).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      campaignId: CAMPAIGN_ID,
    });
  });

  it('discards a hit whose message does not belong to the campaign', async () => {
    findOneMock.mockResolvedValue(null);

    await service.recordOpen(args);

    expect(updateMock).not.toHaveBeenCalled();
    expect(scheduleMock).not.toHaveBeenCalled();
  });
  describe('recordReply', () => {
    const HEADER_MESSAGE_ID = '0100019abc-000000';
    const ANCESTOR_HEADER_MESSAGE_ID = '0100019xyz-000000';
    const RECIPIENT_HANDLE = 'recipient@example.com';
    const ANCESTOR_MESSAGE_ID = '20202020-0000-0000-0000-0000000000m2';

    const replyArgs = {
      workspaceId: WORKSPACE_ID,
      replyHeaderMessageIds: [HEADER_MESSAGE_ID, ANCESTOR_HEADER_MESSAGE_ID],
      senderHandle: RECIPIENT_HANDLE,
    };

    const addressTo = (...messageIds: string[]) =>
      findParticipantsMock.mockResolvedValue(
        messageIds.map((messageId) => ({
          messageId,
          role: MessageParticipantRole.TO,
          handle: RECIPIENT_HANDLE.toUpperCase(),
        })),
      );

    it('stamps the first reply on the campaign message that was answered', async () => {
      findMock.mockResolvedValue([
        {
          id: MESSAGE_ID,
          headerMessageId: HEADER_MESSAGE_ID,
          messageCampaignId: CAMPAIGN_ID,
        },
      ]);
      addressTo(MESSAGE_ID);

      await service.recordReply(replyArgs);

      expect(findMock).toHaveBeenCalledWith({
        where: {
          headerMessageId: In(replyArgs.replyHeaderMessageIds),
          messageCampaignId: Not(IsNull()),
          repliedAt: IsNull(),
        },
      });
      expect(updateMock).toHaveBeenCalledWith(
        { id: MESSAGE_ID, repliedAt: IsNull() },
        { repliedAt: expect.any(Date) },
      );
      expect(scheduleMock).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        campaignId: CAMPAIGN_ID,
      });
    });

    it('attributes to the message actually answered, not an older ancestor', async () => {
      findMock.mockResolvedValue([
        {
          id: ANCESTOR_MESSAGE_ID,
          headerMessageId: ANCESTOR_HEADER_MESSAGE_ID,
          messageCampaignId: CAMPAIGN_ID,
        },
        {
          id: MESSAGE_ID,
          headerMessageId: HEADER_MESSAGE_ID,
          messageCampaignId: CAMPAIGN_ID,
        },
      ]);
      addressTo(ANCESTOR_MESSAGE_ID, MESSAGE_ID);

      await service.recordReply(replyArgs);

      expect(updateMock).toHaveBeenCalledWith(
        { id: MESSAGE_ID, repliedAt: IsNull() },
        { repliedAt: expect.any(Date) },
      );
    });

    it('does nothing when the reply answers no campaign message', async () => {
      findMock.mockResolvedValue([]);

      await service.recordReply(replyArgs);

      expect(updateMock).not.toHaveBeenCalled();
      expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('does not query at all without reply headers', async () => {
      await service.recordReply({ ...replyArgs, replyHeaderMessageIds: [] });

      expect(findMock).not.toHaveBeenCalled();
    });

    it('ignores a reply from someone who was not the recipient', async () => {
      findMock.mockResolvedValue([
        {
          id: MESSAGE_ID,
          headerMessageId: HEADER_MESSAGE_ID,
          messageCampaignId: CAMPAIGN_ID,
        },
      ]);
      findParticipantsMock.mockResolvedValue([
        {
          messageId: MESSAGE_ID,
          role: MessageParticipantRole.TO,
          handle: 'someone-else@example.com',
        },
      ]);

      await service.recordReply(replyArgs);

      expect(updateMock).not.toHaveBeenCalled();
      expect(scheduleMock).not.toHaveBeenCalled();
    });
  });
});

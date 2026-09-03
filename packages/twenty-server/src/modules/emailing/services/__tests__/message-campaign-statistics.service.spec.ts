import { IsNull, Not } from 'typeorm';

import { type CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { type MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { type CampaignDeliveryEntity } from 'src/engine/core-modules/emailing-domain/campaign-delivery.entity';
import { MessageCampaignStatisticsService } from 'src/modules/emailing/services/message-campaign-statistics.service';
import { MessageCampaignWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-campaign.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const CAMPAIGN_ID = '20202020-0000-0000-0000-0000000000c1';

const ZERO_COUNTS = {
  sentCount: 0,
  deliveredCount: 0,
  failedCount: 0,
  skippedCount: 0,
  bouncedCount: 0,
  complainedCount: 0,
  openedCount: 0,
  clickedCount: 0,
  repliedCount: 0,
};

type DeliveryCountGroup = {
  state: string;
  total: string;
  deliveredCount: string;
  bouncedCount: string;
  complainedCount: string;
  providerFailedCount: string;
};

describe('MessageCampaignStatisticsService', () => {
  let service: MessageCampaignStatisticsService;
  let campaignUpdateMock: jest.Mock;
  let messageCountMock: jest.Mock;
  let deliveryCountGroups: DeliveryCountGroup[];

  beforeEach(() => {
    deliveryCountGroups = [
      {
        state: 'SENT',
        total: '8',
        deliveredCount: '6',
        bouncedCount: '2',
        complainedCount: '1',
        providerFailedCount: '0',
      },
      {
        state: 'FAILED',
        total: '1',
        deliveredCount: '0',
        bouncedCount: '0',
        complainedCount: '0',
        providerFailedCount: '0',
      },
      {
        state: 'SKIPPED',
        total: '3',
        deliveredCount: '0',
        bouncedCount: '0',
        complainedCount: '0',
        providerFailedCount: '0',
      },
    ];
    campaignUpdateMock = jest.fn().mockResolvedValue(undefined);
    messageCountMock = jest.fn(async ({ where }) => {
      if (where.openedAt !== undefined) {
        return 5;
      }

      return where.clickedAt !== undefined ? 2 : 1;
    });

    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => deliveryCountGroups),
    };

    const workspaceOrmManager = {
      executeInWorkspaceContext: (work: () => Promise<void>) => work(),
      getRepository: (entity: unknown) => {
        if (entity === MessageWorkspaceEntity) {
          return { count: messageCountMock };
        }

        if (entity === MessageCampaignWorkspaceEntity) {
          return {
            findOne: jest.fn().mockResolvedValue({
              id: CAMPAIGN_ID,
              ...ZERO_COUNTS,
            }),
            update: campaignUpdateMock,
          };
        }

        throw new Error('Unexpected entity requested');
      },
    } as unknown as WorkspaceOrmManager;

    service = new MessageCampaignStatisticsService(
      {
        createQueryBuilder: () => queryBuilder,
      } as unknown as WorkspaceScopedRepository<CampaignDeliveryEntity>,
      workspaceOrmManager,
      {} as MessageQueueService,
      {} as CacheStorageService,
    );
  });

  const refresh = () =>
    service.refreshCampaignCounts({
      workspaceId: WORKSPACE_ID,
      campaignId: CAMPAIGN_ID,
    });

  it('writes delivery and engagement counts onto the campaign', async () => {
    await refresh();

    expect(campaignUpdateMock).toHaveBeenCalledWith(
      { id: CAMPAIGN_ID },
      {
        sentCount: 8,
        deliveredCount: 6,
        failedCount: 1,
        skippedCount: 3,
        bouncedCount: 2,
        complainedCount: 1,
        openedCount: 5,
        clickedCount: 2,
        repliedCount: 1,
      },
    );
  });

  it('counts a recipient once however many times they opened', async () => {
    await refresh();

    expect(messageCountMock).toHaveBeenCalledWith({
      where: { messageCampaignId: CAMPAIGN_ID, openedAt: Not(IsNull()) },
    });
    expect(messageCountMock).toHaveBeenCalledWith({
      where: { messageCampaignId: CAMPAIGN_ID, clickedAt: Not(IsNull()) },
    });
    expect(messageCountMock).toHaveBeenCalledWith({
      where: { messageCampaignId: CAMPAIGN_ID, repliedAt: Not(IsNull()) },
    });
  });

  it('leaves an already-correct campaign alone', async () => {
    deliveryCountGroups = [];
    messageCountMock.mockResolvedValue(0);

    await refresh();

    expect(campaignUpdateMock).not.toHaveBeenCalled();
  });
});

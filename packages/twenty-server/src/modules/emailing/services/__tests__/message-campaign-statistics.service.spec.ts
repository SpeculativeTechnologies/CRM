import { IsNull, Not } from 'typeorm';

import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { MessageCampaignStatisticsService } from 'src/modules/emailing/services/message-campaign-statistics.service';
import { MessageCampaignWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-campaign.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const CAMPAIGN_ID = '20202020-0000-0000-0000-0000000000c1';

const buildDeliveryStatusRows = (
  countByDeliveryStatus: Record<string, number>,
) =>
  Object.entries(countByDeliveryStatus).map(([deliveryStatus, count]) => ({
    deliveryStatus,
    count: String(count),
  }));

describe('MessageCampaignStatisticsService', () => {
  let service: MessageCampaignStatisticsService;
  let campaignUpdateMock: jest.Mock;
  let messageCountMock: jest.Mock;
  let deliveryStatusRows: { deliveryStatus: string; count: string }[];

  beforeEach(() => {
    deliveryStatusRows = buildDeliveryStatusRows({
      SENT: 8,
      FAILED: 1,
      BOUNCED: 2,
      COMPLAINED: 1,
      SKIPPED: 3,
    });
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
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => deliveryStatusRows),
    };

    const globalWorkspaceOrmManager = {
      executeInWorkspaceContext: (work: () => Promise<void>) => work(),
      getRepository: async (_workspaceId: string, entity: unknown) => {
        if (entity === MessageWorkspaceEntity) {
          return {
            createQueryBuilder: () => queryBuilder,
            count: messageCountMock,
          };
        }

        if (entity === MessageCampaignWorkspaceEntity) {
          return { update: campaignUpdateMock };
        }

        throw new Error('Unexpected entity requested');
      },
    } as unknown as GlobalWorkspaceOrmManager;

    service = new MessageCampaignStatisticsService(globalWorkspaceOrmManager);
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
        failedCount: 1,
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

  it('reports zeroes for a campaign with no messages yet', async () => {
    deliveryStatusRows = [];
    messageCountMock.mockResolvedValue(0);

    await refresh();

    expect(campaignUpdateMock).toHaveBeenCalledWith(
      { id: CAMPAIGN_ID },
      {
        sentCount: 0,
        failedCount: 0,
        bouncedCount: 0,
        complainedCount: 0,
        openedCount: 0,
        clickedCount: 0,
        repliedCount: 0,
      },
    );
  });
});

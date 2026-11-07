import { MessageCampaignStatus } from 'twenty-shared/types';

import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { MessageCampaignQueryService } from 'src/modules/emailing/services/message-campaign-query.service';
import { CampaignDeliveryWorkspaceEntity } from 'src/modules/emailing/standard-objects/campaign-delivery.workspace-entity';
import { MessageCampaignWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-campaign.workspace-entity';
import { MessageListMemberWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-list-member.workspace-entity';
import { MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

const campaign = {
  id: 'campaign',
  status: MessageCampaignStatus.SENT,
  listId: null,
  subject: 'Hi {{firstName}} / {{name.firstName}}',
  bodyTemplate: '<p>Hello {{firstName}} / {{name.firstName}}</p>',
  createdBy: { workspaceMemberId: 'member', name: 'Test sender' },
  createdAt: '2026-11-07T12:00:00Z',
  updatedAt: '2026-11-07T12:00:00Z',
  sentAt: null,
};

describe('MessageCampaignQueryService preferred-name previews', () => {
  it.each([
    [' Tim ', 'Tim'],
    [null, 'Timothy'],
    ['   ', 'Timothy'],
    ['<b>Tim</b>', '<b>Tim</b>'],
  ])(
    'should preview preferred name %p using the same fallback as delivery',
    async (preferredName, expectedName) => {
      const repositories = new Map<unknown, unknown>([
        [
          MessageCampaignWorkspaceEntity,
          { findOne: jest.fn().mockResolvedValue(campaign) },
        ],
        [
          MessageParticipantWorkspaceEntity,
          {
            find: jest.fn().mockResolvedValue([
              {
                messageId: 'message',
                personId: 'person',
                handle: 'tim@example.com',
              },
            ]),
          },
        ],
        [MessageWorkspaceEntity, { find: jest.fn().mockResolvedValue([]) }],
        [
          CampaignDeliveryWorkspaceEntity,
          { find: jest.fn().mockResolvedValue([]) },
        ],
        [
          MessageListMemberWorkspaceEntity,
          { find: jest.fn().mockResolvedValue([]) },
        ],
        [
          PersonWorkspaceEntity,
          {
            find: jest.fn().mockResolvedValue([
              {
                id: 'person',
                name: { firstName: 'Timothy', lastName: 'McGee' },
                preferredName,
              },
            ]),
          },
        ],
      ]);
      const manager = {
        getRepository: (entity: unknown) => repositories.get(entity),
        executeInWorkspaceContext: (callback: () => unknown) => callback(),
      };
      const service = new MessageCampaignQueryService(
        manager as unknown as WorkspaceOrmManager,
      );
      const result = await service.findOne({
        workspaceId: 'workspace',
        campaignId: 'campaign',
        workspaceMemberId: 'member',
      });

      expect(result.recipients[0].subject).toBe(
        `Hi ${expectedName} / ${expectedName}`,
      );
      expect(result.recipients[0].displayName).toBe('Timothy McGee');
      const escapedName = expectedName
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      expect(result.recipients[0].body).toBe(
        `<p>Hello ${escapedName} / ${escapedName}</p>`,
      );
    },
  );
});

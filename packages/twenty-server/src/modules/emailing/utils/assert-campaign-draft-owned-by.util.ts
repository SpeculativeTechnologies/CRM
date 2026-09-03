import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { MessageCampaignStatus } from 'twenty-shared/types';

import { type MessageCampaignWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-campaign.workspace-entity';

// Drafts are private to their author until sent: only the creator may edit,
// delete or send one.
export function assertCampaignDraftOwnedBy(
  campaign: MessageCampaignWorkspaceEntity | null,
  workspaceMemberId: string,
): asserts campaign is MessageCampaignWorkspaceEntity {
  if (campaign === null) {
    throw new NotFoundException('Campaign draft not found');
  }

  if (campaign.status !== MessageCampaignStatus.DRAFT) {
    throw new BadRequestException('Only campaign drafts can be modified');
  }

  if (campaign.createdBy.workspaceMemberId !== workspaceMemberId) {
    throw new ForbiddenException(
      'Only the campaign draft creator can modify it',
    );
  }
}

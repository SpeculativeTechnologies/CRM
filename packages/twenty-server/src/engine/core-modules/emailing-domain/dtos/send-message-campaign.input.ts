import { Field, InputType } from '@nestjs/graphql';

import { IsUUID } from 'class-validator';

@InputType()
export class SendMessageCampaignInput {
  @Field(() => String)
  @IsUUID()
  campaignId: string;
}

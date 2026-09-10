import { Field, InputType } from '@nestjs/graphql';

import { IsOptional, IsUUID } from 'class-validator';

@InputType()
export class PreviewMessageCampaignAudienceInput {
  @Field(() => String)
  @IsUUID()
  listId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  unsubscribeTopicId?: string;
}

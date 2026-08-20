import { Field, InputType } from '@nestjs/graphql';

import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class PreviewMessageCampaignAudienceInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  listId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  personIds?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  unsubscribeTopicId?: string;
}

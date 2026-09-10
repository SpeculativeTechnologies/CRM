import { Field, InputType } from '@nestjs/graphql';

import { IsEmail, IsOptional, IsString, IsUUID, Length } from 'class-validator';

@InputType()
export class SaveMessageCampaignDraftInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  listId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  unsubscribeTopicId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 998)
  subject?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  body?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  fromAddress?: string;
}

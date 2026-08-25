import { Field, InputType } from '@nestjs/graphql';

import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { MAX_EMAIL_RECIPIENTS } from 'twenty-shared/constants';

import { MAX_CAMPAIGN_RECIPIENTS } from 'src/engine/core-modules/emailing-domain/constants/campaign.constant';

// Each mass email is addressed to exactly one person, so its Cc list is what
// decides whether the per-email recipient cap is exceeded.
const MAX_CC_RECIPIENTS_PER_EMAIL = MAX_EMAIL_RECIPIENTS - 1;

@InputType()
export class SaveMassEmailCampaignDraftInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  campaignId?: string;

  @Field(() => String)
  @IsUUID('4')
  connectedAccountId: string;

  @Field(() => [String])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CAMPAIGN_RECIPIENTS)
  @IsUUID('4', { each: true })
  personIds: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 998)
  subject?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  body?: string;
}

@InputType()
export class MassEmailCampaignRecipientInput {
  @Field(() => String)
  @IsUUID('4')
  personId: string;

  @Field(() => String)
  @IsEmail()
  to: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CC_RECIPIENTS_PER_EMAIL)
  @IsEmail({}, { each: true })
  cc?: string[];

  @Field(() => String)
  @IsString()
  @Length(0, 998)
  subject: string;

  @Field(() => String)
  @IsString()
  body: string;
}

@InputType()
export class SendMassEmailCampaignInput {
  @Field(() => String)
  @IsUUID('4')
  campaignId: string;

  @Field(() => String)
  @IsUUID('4')
  connectedAccountId: string;

  @Field(() => [MassEmailCampaignRecipientInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CAMPAIGN_RECIPIENTS)
  @ValidateNested({ each: true })
  @Type(() => MassEmailCampaignRecipientInput)
  emails: MassEmailCampaignRecipientInput[];
}

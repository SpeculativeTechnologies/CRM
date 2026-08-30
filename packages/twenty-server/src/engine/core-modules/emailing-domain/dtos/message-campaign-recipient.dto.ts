import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('MessageCampaignRecipient')
export class MessageCampaignRecipientDTO {
  @Field(() => String)
  messageId: string;

  @Field(() => String, { nullable: true })
  personId: string | null;

  @Field(() => String)
  displayName: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  deliveryStatus: string;

  @Field(() => Date, { nullable: true })
  openedAt: Date | null;

  @Field(() => Int)
  openCount: number;

  @Field(() => Date, { nullable: true })
  clickedAt: Date | null;

  @Field(() => Int)
  clickCount: number;

  @Field(() => Date, { nullable: true })
  repliedAt: Date | null;

  @Field(() => String, { nullable: true })
  subject: string | null;

  @Field(() => String, { nullable: true })
  body: string | null;
}

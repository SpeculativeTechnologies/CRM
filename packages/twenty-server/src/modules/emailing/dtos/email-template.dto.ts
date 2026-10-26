import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('EmailTemplate')
export class EmailTemplateDTO {
  @Field(() => String)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  subject: string;

  @Field(() => String)
  body: string;

  @Field(() => String)
  updatedAt: string;
}

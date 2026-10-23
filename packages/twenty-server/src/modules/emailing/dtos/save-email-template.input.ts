import { Field, InputType } from '@nestjs/graphql';

import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

@InputType()
export class SaveEmailTemplateInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  id?: string;

  @Field(() => String)
  @IsString()
  @MaxLength(120)
  name: string;

  @Field(() => String)
  @IsString()
  @MaxLength(998)
  subject: string;

  @Field(() => String)
  @IsString()
  @MaxLength(500000)
  body: string;
}

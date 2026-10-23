import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  type EmailDocument,
  EMAIL_DOCUMENT_SCHEMA_VERSION,
  parseEmailDocument,
  parseJson,
} from 'twenty-shared/utils';
import { IsNull, Like, Repository } from 'typeorm';
import { v4 } from 'uuid';
import { z } from 'zod';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { type EmailTemplateDTO } from 'src/modules/emailing/dtos/email-template.dto';
import { type SaveEmailTemplateInput } from 'src/modules/emailing/dtos/save-email-template.input';
import { collectCampaignVariableNames } from 'src/modules/emailing/utils/collect-campaign-variable-names.util';
import { collectCampaignVariableNamesFromString } from 'src/modules/emailing/utils/collect-campaign-variable-names-from-string.util';

const KEY_PREFIX = 'email-template:';
const TEMPLATE_FIELDS = new Set([
  'firstName',
  'lastName',
  'fullName',
  'email',
  'jobTitle',
  'city',
]);
const storedTemplateSchema = z.object({
  name: z.string(),
  subject: z.string(),
  body: z.string(),
});

@Injectable()
export class EmailTemplateService {
  constructor(
    @InjectRepository(KeyValuePairEntity)
    private readonly repository: Repository<KeyValuePairEntity>,
  ) {}

  // One row per template avoids overwriting unrelated templates when two
  // members save at the same time. Null user/application IDs make these shared
  // workspace values, isolated from user preferences and application storage.
  private scope(workspaceId: string) {
    return {
      workspaceId,
      userId: IsNull(),
      applicationId: IsNull(),
      type: KeyValuePairType.USER_VARIABLE,
      key: Like(`${KEY_PREFIX}%`),
    };
  }

  async findAll(workspaceId: string): Promise<EmailTemplateDTO[]> {
    const rows = await this.repository.find({
      where: this.scope(workspaceId),
      order: { updatedAt: 'DESC', id: 'ASC' },
    });

    return rows.map((row) => this.toTemplate(row));
  }

  async save(
    workspaceId: string,
    input: SaveEmailTemplateInput,
  ): Promise<EmailTemplateDTO> {
    const name = input.name.trim();
    const parsedBody = parseEmailDocument(parseJson<unknown>(input.body));

    if (!name || !input.subject.trim() || !parsedBody.success) {
      throw new BadRequestException(
        'A name, subject and valid email body are required',
      );
    }

    const variables = new Set([
      ...collectCampaignVariableNamesFromString(input.subject),
      ...collectCampaignVariableNames(parsedBody.document),
    ]);
    const unknown = [...variables].filter(
      (variable) => !TEMPLATE_FIELDS.has(variable),
    );

    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown template fields: ${unknown.join(', ')}`,
      );
    }

    const value = {
      name,
      subject: input.subject,
      body: this.serializeBody(parsedBody.document),
    };
    const id = input.id ?? v4();

    if (input.id) {
      const { affected } = await this.repository.update(
        { ...this.scope(workspaceId), id },
        { value: value as unknown as JSON },
      );

      if (affected !== 1) {
        throw new NotFoundException('Email template not found');
      }
    } else {
      await this.repository.insert({
        id,
        key: `${KEY_PREFIX}${id}`,
        workspaceId,
        userId: null,
        applicationId: null,
        type: KeyValuePairType.USER_VARIABLE,
        value: value as unknown as JSON,
      });
    }

    const row = await this.repository.findOneBy({
      ...this.scope(workspaceId),
      id,
    });

    if (!row) {
      throw new NotFoundException('Email template not found');
    }

    return this.toTemplate(row);
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const { affected } = await this.repository.delete({
      ...this.scope(workspaceId),
      id,
    });

    if (affected !== 1) {
      throw new NotFoundException('Email template not found');
    }

    return true;
  }

  private toTemplate(row: KeyValuePairEntity): EmailTemplateDTO {
    const value = storedTemplateSchema.parse(row.value);
    const parsed = parseEmailDocument(parseJson<unknown>(value.body));

    if (!parsed.success) {
      throw new BadRequestException('Stored email template body is invalid');
    }

    return {
      id: row.id,
      ...value,
      body: this.serializeBody(parsed.document),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private serializeBody(document: EmailDocument): string {
    return JSON.stringify({
      ...document,
      attrs: {
        ...document.attrs,
        schemaVersion: EMAIL_DOCUMENT_SCHEMA_VERSION,
      },
    });
  }
}

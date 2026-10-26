import { BadRequestException, NotFoundException } from '@nestjs/common';

import { IsNull, Like, type Repository } from 'typeorm';

import {
  type KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { EmailTemplateService } from 'src/modules/emailing/services/email-template.service';

const id = '20202020-2d40-4f3a-aed0-e8d30740d18f';
const input = {
  name: 'Welcome',
  subject: 'Hi {{firstName}}',
  body: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'variableTag', attrs: { variable: '{{fullName}}' } }],
      },
    ],
  }),
};

describe('EmailTemplateService', () => {
  const repository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const service = new EmailTemplateService(
    repository as unknown as Repository<KeyValuePairEntity>,
  );
  const row = { id, value: input, updatedAt: new Date('2026-10-23T12:00:00Z') };
  const scope = {
    workspaceId: 'workspace-a',
    userId: IsNull(),
    applicationId: IsNull(),
    type: KeyValuePairType.USER_VARIABLE,
    key: Like('email-template:%'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findOneBy.mockResolvedValue(row);
    repository.update.mockResolvedValue({ affected: 1 });
    repository.delete.mockResolvedValue({ affected: 1 });
  });

  it('should persist a template shared only within its authenticated workspace', async () => {
    const saved = await service.save('workspace-a', input);

    expect(JSON.parse(saved.body).attrs.schemaVersion).toBe(1);

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        userId: null,
        applicationId: null,
        value: expect.objectContaining({ subject: 'Hi {{firstName}}' }),
      }),
    );
    expect(repository.findOneBy).toHaveBeenCalledWith(
      expect.objectContaining(scope),
    );
  });

  it('should return persisted templates and exclude preferences and other workspaces', async () => {
    repository.find.mockResolvedValue([row]);

    expect(await service.findAll('workspace-a')).toEqual([
      {
        ...input,
        body: expect.any(String),
        id,
        updatedAt: '2026-10-23T12:00:00.000Z',
      },
    ]);
    expect(repository.find).toHaveBeenCalledWith({
      where: scope,
      order: { updatedAt: 'DESC', id: 'ASC' },
    });
  });

  it('should update exactly one template within the workspace', async () => {
    await service.save('workspace-a', {
      ...input,
      id,
      subject: 'Updated {{firstName}}',
    });

    expect(repository.update).toHaveBeenCalledWith(
      { ...scope, id },
      expect.objectContaining({
        value: expect.objectContaining({ subject: 'Updated {{firstName}}' }),
      }),
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('should refuse to update another workspace template or a deleted template', async () => {
    repository.update.mockResolvedValue({ affected: 0 });

    await expect(service.save('workspace-a', { ...input, id })).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('should delete only a template in this workspace', async () => {
    await service.delete('workspace-a', id);

    expect(repository.delete).toHaveBeenCalledWith({ ...scope, id });
    repository.delete.mockResolvedValue({ affected: 0 });
    await expect(service.delete('workspace-b', id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([
    { ...input, name: ' ' },
    { ...input, subject: ' ' },
    { ...input, body: '<p>Not a document</p>' },
    { ...input, subject: '{{unknownField}}' },
    {
      ...input,
      body: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'variableTag', attrs: { variable: '{{typo}}' } }],
          },
        ],
      }),
    },
  ])('should reject invalid content without writing', async (invalid) => {
    await expect(service.save('workspace-a', invalid)).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });
});

import { FieldMetadataType } from 'twenty-shared/types';

import { ProcessNestedRelationsHelper } from 'src/engine/api/common/common-nested-relations-processor/process-nested-relations.helper';
import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { RelationType } from 'src/engine/metadata-modules/field-metadata/interfaces/relation-type.interface';

const PARTICIPANT_OBJECT_ID = 'message-participant-object-id';
const MESSAGE_OBJECT_ID = 'message-object-id';
const MESSAGE_FIELD_ID = 'message-field-id';
const PARTICIPANTS_FIELD_ID = 'message-participants-field-id';

// Lookups resolve id -> universalIdentifier -> entity, so both directions have
// to be populated or every metadata lookup silently returns undefined.
const buildFlatEntityMaps = <T>(byId: Record<string, T>) => ({
  byId,
  idByUniversalIdentifier: Object.fromEntries(
    Object.keys(byId).map((id) => [id, id]),
  ),
  universalIdentifierById: Object.fromEntries(
    Object.keys(byId).map((id) => [id, id]),
  ),
  byUniversalIdentifier: byId,
});

const buildMetadata = () => {
  const messageField = {
    id: MESSAGE_FIELD_ID,
    name: 'message',
    type: FieldMetadataType.RELATION,
    objectMetadataId: PARTICIPANT_OBJECT_ID,
    settings: {
      relationType: RelationType.MANY_TO_ONE,
      targetFieldMetadataId: PARTICIPANTS_FIELD_ID,
    },
    relationTargetObjectMetadataId: MESSAGE_OBJECT_ID,
    relationTargetFieldMetadataId: PARTICIPANTS_FIELD_ID,
  };

  const participantsField = {
    id: PARTICIPANTS_FIELD_ID,
    name: 'messageParticipants',
    type: FieldMetadataType.RELATION,
    objectMetadataId: MESSAGE_OBJECT_ID,
    settings: {
      relationType: RelationType.ONE_TO_MANY,
      targetFieldMetadataId: MESSAGE_FIELD_ID,
    },
    relationTargetObjectMetadataId: PARTICIPANT_OBJECT_ID,
    relationTargetFieldMetadataId: MESSAGE_FIELD_ID,
  };

  const participantObject = {
    id: PARTICIPANT_OBJECT_ID,
    nameSingular: 'messageParticipant',
    namePlural: 'messageParticipants',
    fieldIds: [MESSAGE_FIELD_ID],
    isSystem: true,
  };

  const messageObject = {
    id: MESSAGE_OBJECT_ID,
    nameSingular: 'message',
    namePlural: 'messages',
    fieldIds: [PARTICIPANTS_FIELD_ID],
    isSystem: true,
  };

  return {
    flatObjectMetadataMaps: buildFlatEntityMaps({
      [PARTICIPANT_OBJECT_ID]: participantObject,
      [MESSAGE_OBJECT_ID]: messageObject,
    }),
    flatFieldMetadataMaps: buildFlatEntityMaps({
      [MESSAGE_FIELD_ID]: messageField,
      [PARTICIPANTS_FIELD_ID]: participantsField,
    }),
    participantObject,
  };
};

describe('ProcessNestedRelationsHelper post query hooks', () => {
  const authContext = { workspace: { id: 'workspace-id' } };

  let executePostQueryHooks: jest.Mock;
  let helper: ProcessNestedRelationsHelper;
  let relationRows: Record<string, unknown>[];

  const traverseToMessage = async (
    parentRecords: Record<string, unknown>[],
  ) => {
    const { flatObjectMetadataMaps, flatFieldMetadataMaps, participantObject } =
      buildMetadata();

    await helper.processNestedRelations({
      flatObjectMetadataMaps: flatObjectMetadataMaps as never,
      flatFieldMetadataMaps: flatFieldMetadataMaps as never,
      parentObjectMetadataItem: participantObject as never,
      parentObjectRecords: parentRecords as never,
      relations: { message: {} },
      limit: 10,
      authContext: authContext as never,
      selectedFields: { message: { id: true, text: true } },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    relationRows = [
      {
        id: 'e0b5a2c4-1f3d-4a2b-8c9e-1d2f3a4b5c6d',
        text: 'confidential body',
        subject: 'confidential subject',
      },
    ];

    executePostQueryHooks = jest.fn();

    const queryBuilder = {
      setFindOptions: jest.fn().mockReturnThis(),
      getFindOptions: jest.fn().mockReturnValue({ select: {} }),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockImplementation(async () => relationRows),
    };

    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      isReadDeniedByReadability: jest.fn().mockReturnValue(false),
    };

    const workspaceOrmManager = {
      getRepository: jest.fn().mockReturnValue(repository),
    };

    helper = new ProcessNestedRelationsHelper(
      workspaceOrmManager as never,
      { executePostQueryHooks } as never,
    );
  });

  it('should run the target object post query hooks on relation results', async () => {
    await traverseToMessage([
      {
        id: 'participant-1',
        messageId: 'e0b5a2c4-1f3d-4a2b-8c9e-1d2f3a4b5c6d',
      },
    ]);

    expect(executePostQueryHooks).toHaveBeenCalledWith(
      authContext,
      'message',
      CommonQueryNames.FIND_MANY,
      relationRows,
    );
  });

  it('should propagate redaction applied by the hook to the assigned records', async () => {
    executePostQueryHooks.mockImplementation(
      async (
        _authContext: unknown,
        _objectName: string,
        _operation: string,
        payload: Record<string, unknown>[],
      ) => {
        for (const record of payload) {
          record.text = 'RESTRICTED';
        }
      },
    );

    const parentRecords = [
      {
        id: 'participant-1',
        messageId: 'e0b5a2c4-1f3d-4a2b-8c9e-1d2f3a4b5c6d',
      },
    ];

    await traverseToMessage(parentRecords);

    const assignedMessage = (
      parentRecords[0] as unknown as { message?: Record<string, unknown> }
    ).message;

    expect(assignedMessage?.text).toBe('RESTRICTED');
  });

  it('should not assign a record the hook removed from the payload', async () => {
    executePostQueryHooks.mockImplementation(
      async (
        _authContext: unknown,
        _objectName: string,
        _operation: string,
        payload: Record<string, unknown>[],
      ) => {
        payload.splice(0, payload.length);
      },
    );

    const parentRecords = [
      {
        id: 'participant-1',
        messageId: 'e0b5a2c4-1f3d-4a2b-8c9e-1d2f3a4b5c6d',
      },
    ];

    await traverseToMessage(parentRecords);

    const assignedMessage = (
      parentRecords[0] as unknown as { message?: Record<string, unknown> }
    ).message;

    expect(assignedMessage ?? null).toBeNull();
  });
});

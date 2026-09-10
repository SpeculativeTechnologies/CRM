import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_EMAIL_RECIPIENTS } from 'twenty-shared/constants';

import {
  SaveMassEmailCampaignDraftInput,
  SendMassEmailCampaignInput,
} from 'src/modules/messaging/message-outbound-manager/dtos/mass-email-campaign.input';

const CAMPAIGN_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONNECTED_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001';
const PERSON_ID = '550e8400-e29b-41d4-a716-446655440002';
// People imported through the API can carry deterministic v5 ids.
const V5_PERSON_ID = 'b8691b73-83b5-5067-b3d6-115788fa62a7';

const buildInput = (cc?: unknown, personId: string = PERSON_ID) =>
  plainToInstance(SendMassEmailCampaignInput, {
    campaignId: CAMPAIGN_ID,
    connectedAccountId: CONNECTED_ACCOUNT_ID,
    emails: [
      {
        personId,
        to: 'ada@example.com',
        subject: 'Hello',
        body: '<p>Hello</p>',
        ...(cc === undefined ? {} : { cc }),
      },
    ],
  });

const getEmailErrors = async (input: SendMassEmailCampaignInput) => {
  const errors = await validate(input);

  return errors.flatMap(
    (error) => error.children?.flatMap((child) => child.children ?? []) ?? [],
  );
};

describe('SendMassEmailCampaignInput', () => {
  it('should pass validation when no cc is provided', async () => {
    const errors = await validate(buildInput());

    expect(errors).toHaveLength(0);
  });

  it('should accept a person id that is not a v4 uuid', async () => {
    const errors = await validate(buildInput(undefined, V5_PERSON_ID));

    expect(errors).toHaveLength(0);
  });

  it('should reject a person id that is not a uuid', async () => {
    const emailErrors = await getEmailErrors(
      buildInput(undefined, 'not-a-uuid'),
    );

    expect(emailErrors).toHaveLength(1);
    expect(emailErrors[0].property).toBe('personId');
    expect(emailErrors[0].constraints).toHaveProperty('isUuid');
  });

  it('should pass validation with valid cc addresses', async () => {
    const errors = await validate(
      buildInput(['grace@example.com', 'alan@example.com']),
    );

    expect(errors).toHaveLength(0);
  });

  it('should fail validation when a cc address is not an email', async () => {
    const emailErrors = await getEmailErrors(buildInput(['not-an-email']));

    expect(emailErrors).toHaveLength(1);
    expect(emailErrors[0].property).toBe('cc');
    expect(emailErrors[0].constraints).toHaveProperty('isEmail');
  });

  it('should fail validation when cc is not an array', async () => {
    const emailErrors = await getEmailErrors(buildInput('grace@example.com'));

    expect(emailErrors[0].property).toBe('cc');
    expect(emailErrors[0].constraints).toHaveProperty('isArray');
  });

  it('should fail validation when cc exceeds the per-email recipient limit', async () => {
    const tooManyCcAddresses = Array.from(
      { length: MAX_EMAIL_RECIPIENTS },
      (_unused, index) => `person-${index}@example.com`,
    );

    const emailErrors = await getEmailErrors(buildInput(tooManyCcAddresses));

    expect(emailErrors[0].property).toBe('cc');
    expect(emailErrors[0].constraints).toHaveProperty('arrayMaxSize');
  });
});

describe('SaveMassEmailCampaignDraftInput', () => {
  const buildDraftInput = (personIds: unknown) =>
    plainToInstance(SaveMassEmailCampaignDraftInput, {
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      personIds,
    });

  it('should accept person ids of any uuid version', async () => {
    const errors = await validate(buildDraftInput([PERSON_ID, V5_PERSON_ID]));

    expect(errors).toHaveLength(0);
  });

  it('should reject a person id that is not a uuid', async () => {
    const errors = await validate(buildDraftInput([PERSON_ID, 'not-a-uuid']));

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('personIds');
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });
});

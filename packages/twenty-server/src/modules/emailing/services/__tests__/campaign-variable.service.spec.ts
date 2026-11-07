import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-shared/metadata';
import { FieldMetadataType } from 'twenty-shared/types';
import { v4 } from 'uuid';

import { type WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { CampaignVariableService } from 'src/modules/emailing/services/campaign-variable.service';
import { buildCampaignBatchReplacements } from 'src/modules/emailing/utils/build-campaign-batch-replacements.util';
import { renderCampaignTemplate } from 'src/modules/emailing/utils/render-campaign-template.util';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

const createService = () => {
  const person = getFlatObjectMetadataMock({
    universalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person,
    nameSingular: 'person',
  });
  const fields = [
    getFlatFieldMetadataMock({
      universalIdentifier: v4(),
      objectMetadataId: person.id,
      name: 'name',
      type: FieldMetadataType.FULL_NAME,
    }),
    getFlatFieldMetadataMock({
      universalIdentifier: v4(),
      objectMetadataId: person.id,
      name: 'preferredName',
      type: FieldMetadataType.TEXT,
    }),
  ];
  person.fieldIds = fields.map((field) => field.id);
  const flatMaps = (
    entities: { id: string; universalIdentifier: string }[],
  ) => ({
    byUniversalIdentifier: Object.fromEntries(
      entities.map((entity) => [entity.universalIdentifier, entity]),
    ),
    universalIdentifierById: Object.fromEntries(
      entities.map((entity) => [entity.id, entity.universalIdentifier]),
    ),
    universalIdentifiersByApplicationId: {},
  });
  const cache = {
    getOrRecomputeManyOrAllFlatEntityMapsWithHashes: jest
      .fn()
      .mockResolvedValue({
        data: {
          flatObjectMetadataMaps: flatMaps([person]),
          flatFieldMetadataMaps: flatMaps(fields),
        },
        hashes: {
          flatObjectMetadataMaps: 'objects',
          flatFieldMetadataMaps: 'fields',
        },
      }),
  };

  return new CampaignVariableService(
    cache as unknown as WorkspaceManyOrAllFlatEntityMapsCacheService,
  );
};

describe('CampaignVariableService preferred names', () => {
  it.each([
    [' Tim ', 'Tim'],
    [undefined, 'Timothy'],
    [null, 'Timothy'],
    ['', 'Timothy'],
    ['  ', 'Timothy'],
    [42, 'Timothy'],
  ])(
    'should resolve the greeting for preferred name %p',
    async (preferredName, expectedName) => {
      const service = createService();
      const person = {
        name: { firstName: 'Timothy', lastName: 'McGee' },
        preferredName,
      };
      const variables = await service.buildVariablesForPerson(
        'workspace',
        person as unknown as PersonWorkspaceEntity,
      );

      await expect(
        service.assertKnownVariables('workspace', [
          'name.firstName',
          'firstName',
        ]),
      ).resolves.toBeUndefined();
      expect(variables['name.firstName']).toBe(expectedName);
      expect(variables.firstName).toBe(expectedName);
      expect(variables.fullName).toBe('Timothy McGee');
      expect(
        renderCampaignTemplate(
          'Hi {{name.firstName}} / {{firstName}}',
          variables,
          { escapeValues: false },
        ),
      ).toBe(`Hi ${expectedName} / ${expectedName}`);
    },
  );

  it('should escape preferred names in batch HTML while preserving plain text', async () => {
    const service = createService();
    const variables = await service.buildVariablesForPerson('workspace', {
      preferredName: '<b>Tim & "T"</b>',
    } as unknown as PersonWorkspaceEntity);

    expect(
      buildCampaignBatchReplacements({
        variableNames: ['name.firstName'],
        variables,
      }),
    ).toEqual({
      v_h_0: '&lt;b&gt;Tim &amp; &quot;T&quot;&lt;/b&gt;',
      v_t_0: '<b>Tim & "T"</b>',
      v_u_0: encodeURIComponent('<b>Tim & "T"</b>'),
    });
  });

  it('should leave greeting variables blank for a missing person', async () => {
    const variables = await createService().buildVariablesForPerson(
      'workspace',
      null,
    );

    expect(variables.firstName).toBe('');
    expect(variables['name.firstName']).toBe('');
  });
});

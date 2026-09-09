import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { describe, expect, it } from 'vitest';

import { CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

import defaultRole from 'src/default-role';

const permissionFor = (objectUniversalIdentifier: string) =>
  defaultRole.config?.objectPermissions?.find(
    (permission) =>
      permission.objectUniversalIdentifier === objectUniversalIdentifier,
  );

describe('default role', () => {
  it('only grants write access to the CRM records with last-contact fields', () => {
    expect(defaultRole.success).toBe(true);
    expect(defaultRole.config).toMatchObject({
      canReadAllObjectRecords: false,
      canUpdateAllObjectRecords: false,
      canSoftDeleteAllObjectRecords: false,
      canDestroyAllObjectRecords: false,
    });

    for (const objectUniversalIdentifier of [
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
    ]) {
      expect(permissionFor(objectUniversalIdentifier)).toMatchObject({
        canReadObjectRecords: true,
        canUpdateObjectRecords: true,
        canSoftDeleteObjectRecords: false,
        canDestroyObjectRecords: false,
      });
    }
  });

  it('keeps interaction source records read-only', () => {
    for (const objectUniversalIdentifier of [
      CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.message.universalIdentifier,
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.messageParticipant
        .universalIdentifier,
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.calendarEvent.universalIdentifier,
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.calendarEventParticipant
        .universalIdentifier,
    ]) {
      expect(permissionFor(objectUniversalIdentifier)).toMatchObject({
        canReadObjectRecords: true,
        canUpdateObjectRecords: false,
        canSoftDeleteObjectRecords: false,
        canDestroyObjectRecords: false,
      });
    }

    expect(defaultRole.config?.objectPermissions).toHaveLength(8);
  });
});

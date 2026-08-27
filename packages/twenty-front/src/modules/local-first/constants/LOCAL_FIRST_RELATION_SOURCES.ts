export type LocalFirstRelationSource =
  | {
      kind: 'toOne';
      // Column on the owning row holding the target's id.
      foreignKeyColumn: string;
      targetTable: string;
      targetTypeName: string;
    }
  | {
      kind: 'toMany';
      targetTable: string;
      // Column on the target rows pointing back at the owning row.
      targetForeignKeyColumn: string;
      targetTypeName: string;
    };

// How the relations the People view asks for map onto the mirrored tables.
// Twenty models many-to-many through a first-class join object, so
// caredForPets and previousCompanies are one-to-many onto those join tables,
// and the join rows carry their own to-one relations.
//
// Keyed by "<owning table>.<API field name>". This is declared rather than
// derived from metadata because the read path must refuse anything it does not
// explicitly understand.
export const LOCAL_FIRST_RELATION_SOURCES: Record<
  string,
  LocalFirstRelationSource
> = {
  'person.company': {
    kind: 'toOne',
    foreignKeyColumn: 'companyId',
    targetTable: 'company',
    targetTypeName: 'Company',
  },
  'person.caredForPets': {
    kind: 'toMany',
    targetTable: '_petCareAgreement',
    targetForeignKeyColumn: 'caretakerPersonId',
    targetTypeName: 'PetCareAgreement',
  },
  'person.previousCompanies': {
    kind: 'toMany',
    targetTable: '_employmentHistory',
    targetForeignKeyColumn: 'personId',
    targetTypeName: 'EmploymentHistory',
  },
  '_petCareAgreement.pet': {
    kind: 'toOne',
    foreignKeyColumn: 'petId',
    targetTable: '_pet',
    targetTypeName: 'Pet',
  },
  '_employmentHistory.company': {
    kind: 'toOne',
    foreignKeyColumn: 'companyId',
    targetTable: 'company',
    targetTypeName: 'Company',
  },
};

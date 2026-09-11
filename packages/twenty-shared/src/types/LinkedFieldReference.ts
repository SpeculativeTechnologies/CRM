export type LinkedFieldReference = {
  relationFieldMetadataUniversalIdentifier: string;
  sourceFieldMetadataUniversalIdentifier: string;
};

export type LinkedFieldMetadataSettings = {
  linkedField?: LinkedFieldReference;
};

export const mergeCampaignAudiencePersonIds = (
  listPersonIds: string[],
  selectedPersonIds: string[],
): string[] => [...new Set([...listPersonIds, ...selectedPersonIds])];

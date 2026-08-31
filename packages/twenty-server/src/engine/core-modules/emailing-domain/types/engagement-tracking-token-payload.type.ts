export type EngagementTrackingTokenPayload = {
  workspaceId: string;
  campaignId: string;
  messageId?: string;
  personId?: string;
  // Click tokens carry their destination so the redirect endpoint never accepts
  // a target from the query string, which would make it an open redirect.
  destinationUrl?: string;
  issuedAt: number;
};

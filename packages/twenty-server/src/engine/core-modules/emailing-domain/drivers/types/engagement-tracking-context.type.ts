export type EngagementTrackingContext = {
  campaignId: string;
  messageId?: string;
  // Set instead of messageId when the campaign message row is only created
  // after the email leaves, as on the mass-compose path. The hit then resolves
  // the message through the campaign's recipient participant.
  personId?: string;
};

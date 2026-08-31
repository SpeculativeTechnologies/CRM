export type CampaignReplyAttribution = {
  replyHeaderMessageIds: string[];
  senderHandle: string;
};

// A mailbox sync saves messages in batches, so attribution is batched with them
// rather than enqueued per message: a first historical import would otherwise
// queue one job per message in the mailbox.
export type AttributeCampaignReplyJobData = {
  workspaceId: string;
  replies: CampaignReplyAttribution[];
};

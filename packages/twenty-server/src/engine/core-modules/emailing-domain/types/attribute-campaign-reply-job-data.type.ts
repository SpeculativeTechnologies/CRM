export type CampaignReplyAttribution = {
  replyHeaderMessageIds: string[];
  senderHandle: string;
  // A connected-account send stores the Message-ID the composer generated, but
  // the provider assigns its own on the wire, so the reply's In-Reply-To can
  // name an id no campaign message carries. The thread the reply was imported
  // into is what still connects the two. Serialized as ISO because job payloads
  // are JSON.
  messageThreadId?: string;
  receivedAt?: string;
};

// A mailbox sync saves messages in batches, so attribution is batched with them
// rather than enqueued per message: a first historical import would otherwise
// queue one job per message in the mailbox.
export type AttributeCampaignReplyJobData = {
  workspaceId: string;
  replies: CampaignReplyAttribution[];
};

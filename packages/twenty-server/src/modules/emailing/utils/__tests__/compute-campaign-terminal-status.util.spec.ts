import { MessageCampaignStatus } from 'twenty-shared/types';

import {
  computeCampaignTerminalStatus,
  resolveCompletedCampaignStatus,
} from 'src/modules/emailing/utils/compute-campaign-terminal-status.util';

describe('resolveCompletedCampaignStatus', () => {
  it('completes without errors when no recipient failed', () => {
    expect(resolveCompletedCampaignStatus(0)).toBe(MessageCampaignStatus.SENT);
  });

  it('completes with errors when a recipient failed', () => {
    expect(resolveCompletedCampaignStatus(2)).toBe(
      MessageCampaignStatus.SENT_WITH_ERRORS,
    );
  });
});

describe('computeCampaignTerminalStatus', () => {
  it('keeps a campaign in flight while messages are still queued', () => {
    expect(
      computeCampaignTerminalStatus({ queuedCount: 1, failedCount: 0 }),
    ).toBeNull();
    expect(
      computeCampaignTerminalStatus({ queuedCount: 3, failedCount: 2 }),
    ).toBeNull();
  });

  it('completes a campaign once every message left the queue', () => {
    expect(
      computeCampaignTerminalStatus({ queuedCount: 0, failedCount: 0 }),
    ).toBe(MessageCampaignStatus.SENT);
    expect(
      computeCampaignTerminalStatus({ queuedCount: 0, failedCount: 1 }),
    ).toBe(MessageCampaignStatus.SENT_WITH_ERRORS);
  });
});

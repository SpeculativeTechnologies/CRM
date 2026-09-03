import { type Repository } from 'typeorm';

import { LogEmailingDomainDriver } from 'src/engine/core-modules/emailing-domain/drivers/log/services/log-emailing-domain-driver.service';
import { type EmailingDomainSendEmailRequest } from 'src/engine/core-modules/emailing-domain/drivers/types/emailing-domain-send-email-input.type';
import { EngagementTrackingContentService } from 'src/engine/core-modules/emailing-domain/services/engagement-tracking-content.service';
import { type EngagementTrackingTokenService } from 'src/engine/core-modules/emailing-domain/services/engagement-tracking-token.service';
import { UnsubscribeContentService } from 'src/engine/core-modules/emailing-domain/services/unsubscribe-content.service';
import { type UnsubscribeTokenService } from 'src/engine/core-modules/emailing-domain/services/unsubscribe-token.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

const CONFIG: Record<string, unknown> = {
  SERVER_URL: 'https://app.example.com',
  IS_MULTIWORKSPACE_ENABLED: false,
};

const buildRequest = (): EmailingDomainSendEmailRequest =>
  ({
    workspaceId: 'workspace-1',
    domain: 'example.com',
    from: 'sender@example.com',
    to: ['recipient@example.org'],
    subject: 'Hello',
    text: 'Hello',
    html: '<html><body><a href="https://example.com/offer">Offer</a></body></html>',
    engagementTracking: { campaignId: 'campaign-1', messageId: 'message-1' },
  }) as EmailingDomainSendEmailRequest;

describe('LogEmailingDomainDriver engagement tracking', () => {
  let driver: LogEmailingDomainDriver;
  let loggedHtml: string;
  let signedDestinations: (string | undefined)[];

  beforeEach(async () => {
    signedDestinations = [];

    driver = new LogEmailingDomainDriver(
      {
        get: (key: string) => CONFIG[key],
      } as unknown as TwentyConfigService,
      new UnsubscribeContentService({
        sign: () => 'unsubscribe-token',
      } as unknown as UnsubscribeTokenService),
      new EngagementTrackingContentService({
        sign: (payload: { destinationUrl?: string }) => {
          signedDestinations.push(payload.destinationUrl);

          return 'tracking-token';
        },
      } as unknown as EngagementTrackingTokenService),
      {
        findOneBy: async () => ({ subdomain: 'acme' }) as WorkspaceEntity,
      } as unknown as Repository<WorkspaceEntity>,
    );

    const logSpy = jest
      .spyOn(driver['logger'], 'log')
      .mockImplementation(() => undefined);

    // Upstream's log driver now sleeps and randomly throttles to mimic a real
    // provider; neither belongs in a test of the rendered html.
    jest
      .spyOn(
        driver as unknown as { simulateProviderCall: () => Promise<void> },
        'simulateProviderCall',
      )
      .mockResolvedValue(undefined);

    await driver.sendEmail(buildRequest());

    loggedHtml = logSpy.mock.calls.map(([message]) => String(message)).join('');
  });

  it('wraps campaign links for click tracking', () => {
    expect(loggedHtml).toContain('/emailing/track/click?t=tracking-token');
  });

  it('adds the open pixel', () => {
    expect(loggedHtml).toContain('/emailing/track/open?t=tracking-token');
  });

  // One-click unsubscribe has to keep pointing straight at the unsubscribe
  // endpoint, so tracking must be applied before the footer is appended.
  it('leaves the unsubscribe link unwrapped', () => {
    expect(loggedHtml).toContain(
      '/emailing/unsubscribe?t=unsubscribe-token">Unsubscribe</a>',
    );
  });

  it('never signs the unsubscribe url as a click destination', () => {
    expect(signedDestinations).toEqual([
      undefined,
      'https://example.com/offer',
    ]);
  });
});

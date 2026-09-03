import { type EmailingDomainSendEmailInput } from 'src/engine/core-modules/emailing-domain/drivers/types/emailing-domain-send-email-input.type';
import { EngagementTrackingContentService } from 'src/engine/core-modules/emailing-domain/services/engagement-tracking-content.service';
import { type EngagementTrackingTokenService } from 'src/engine/core-modules/emailing-domain/services/engagement-tracking-token.service';

const TRACKING_BASE_URL = 'https://email-prefs.example.com';

const buildEmail = (
  overrides: Partial<EmailingDomainSendEmailInput> = {},
): EmailingDomainSendEmailInput => ({
  workspaceId: 'workspace-1',
  domain: 'example.com',
  sendKind: 'MARKETING',
  from: 'sender@example.com',
  to: ['recipient@example.org'],
  subject: 'Hello',
  text: 'Hello',
  html: '<html><body><a href="https://example.com/offer">Offer</a></body></html>',
  engagementTracking: { campaignId: 'campaign-1', messageId: 'message-1' },
  ...overrides,
});

describe('EngagementTrackingContentService', () => {
  let service: EngagementTrackingContentService;
  let signMock: jest.Mock;

  beforeEach(() => {
    signMock = jest.fn(
      (payload) =>
        `token-${payload.destinationUrl === undefined ? 'open' : 'click'}`,
    );

    service = new EngagementTrackingContentService({
      sign: signMock,
    } as unknown as EngagementTrackingTokenService);
  });

  it('adds a pixel and wraps links when a campaign message is being sent', () => {
    const result = service.addTo(buildEmail(), TRACKING_BASE_URL);

    expect(result.html).toContain(
      `${TRACKING_BASE_URL}/emailing/track/open?t=token-open`,
    );
    expect(result.html).toContain(
      `${TRACKING_BASE_URL}/emailing/track/click?t=token-click`,
    );
    expect(result.html).not.toContain('href="https://example.com/offer"');
  });

  it('signs the click token with the destination it must redirect to', () => {
    service.addTo(buildEmail(), TRACKING_BASE_URL);

    expect(signMock).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      messageId: 'message-1',
      destinationUrl: 'https://example.com/offer',
    });
  });

  it('leaves the open token without a destination', () => {
    service.addTo(buildEmail(), TRACKING_BASE_URL);

    expect(signMock).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      messageId: 'message-1',
    });
  });

  it('leaves transactional email alone when there is no campaign to attribute to', () => {
    const email = buildEmail({ engagementTracking: undefined });

    expect(service.addTo(email, TRACKING_BASE_URL)).toBe(email);
    expect(signMock).not.toHaveBeenCalled();
  });

  it('does nothing without a tracking hostname to serve the endpoints', () => {
    const email = buildEmail();

    expect(service.addTo(email, null)).toBe(email);
    expect(signMock).not.toHaveBeenCalled();
  });

  it('does nothing for a plain text only email', () => {
    const email = buildEmail({ html: undefined });

    expect(service.addTo(email, TRACKING_BASE_URL)).toBe(email);
    expect(signMock).not.toHaveBeenCalled();
  });

  it('does not touch the text part', () => {
    const result = service.addTo(buildEmail(), TRACKING_BASE_URL);

    expect(result.text).toBe('Hello');
  });

  describe('addToHtml', () => {
    const HTML =
      '<html><body><a href="https://example.com/offer">Offer</a></body></html>';

    it('signs a recipient token when the message row does not exist yet', () => {
      const result = service.addToHtml({
        html: HTML,
        workspaceId: 'workspace-1',
        tracking: { campaignId: 'campaign-1', personId: 'person-1' },
        trackingBaseUrl: TRACKING_BASE_URL,
      });

      expect(signMock).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        personId: 'person-1',
      });
      expect(result).toContain(
        `${TRACKING_BASE_URL}/emailing/track/open?t=token-open`,
      );
      expect(result).toContain(
        `${TRACKING_BASE_URL}/emailing/track/click?t=token-click`,
      );
    });

    it('returns the body untouched without a tracking hostname', () => {
      const result = service.addToHtml({
        html: HTML,
        workspaceId: 'workspace-1',
        tracking: { campaignId: 'campaign-1', personId: 'person-1' },
        trackingBaseUrl: null,
      });

      expect(result).toBe(HTML);
      expect(signMock).not.toHaveBeenCalled();
    });
  });
});

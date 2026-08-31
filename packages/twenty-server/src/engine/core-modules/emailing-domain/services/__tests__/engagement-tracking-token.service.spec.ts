import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { type SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { EngagementTrackingTokenService } from 'src/engine/core-modules/emailing-domain/services/engagement-tracking-token.service';

describe('EngagementTrackingTokenService', () => {
  let service: EngagementTrackingTokenService;

  beforeEach(() => {
    service = new EngagementTrackingTokenService({
      encryptVersioned: (plaintext: PlaintextString) => plaintext,
      decryptVersionedOrThrow: (encrypted: string) => encrypted,
    } as unknown as SecretEncryptionService);
  });

  const signAndVerify = (payload: Parameters<typeof service.sign>[0]) =>
    service.verify(service.sign(payload));

  it('round-trips a message token', () => {
    expect(
      signAndVerify({
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        messageId: 'message-1',
      }),
    ).toEqual({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      messageId: 'message-1',
      issuedAt: expect.any(Number),
    });
  });

  it('round-trips a recipient token', () => {
    expect(
      signAndVerify({
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        personId: 'person-1',
      }),
    ).toEqual({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      personId: 'person-1',
      issuedAt: expect.any(Number),
    });
  });

  it('keeps the destination of a click token', () => {
    expect(
      signAndVerify({
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        personId: 'person-1',
        destinationUrl: 'https://example.com/offer',
      })?.destinationUrl,
    ).toBe('https://example.com/offer');
  });

  it('rejects a token that names neither a message nor a recipient', () => {
    expect(
      signAndVerify({ workspaceId: 'workspace-1', campaignId: 'campaign-1' }),
    ).toBeNull();
  });

  it('rejects a token with no campaign', () => {
    expect(
      service.verify(
        Buffer.from(
          JSON.stringify({
            workspaceId: 'workspace-1',
            messageId: 'message-1',
          }),
        ).toString('base64url'),
      ),
    ).toBeNull();
  });

  it('rejects unreadable input', () => {
    expect(service.verify('not-a-token')).toBeNull();
  });
});

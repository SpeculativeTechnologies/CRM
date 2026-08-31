import { Injectable } from '@nestjs/common';

import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { type EngagementTrackingTokenPayload } from 'src/engine/core-modules/emailing-domain/types/engagement-tracking-token-payload.type';

const readOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

@Injectable()
export class EngagementTrackingTokenService {
  constructor(
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  sign(payload: Omit<EngagementTrackingTokenPayload, 'issuedAt'>): string {
    const stampedPayload: EngagementTrackingTokenPayload = {
      ...payload,
      issuedAt: Date.now(),
    };

    return Buffer.from(
      this.secretEncryptionService.encryptVersioned(
        JSON.stringify(stampedPayload) as PlaintextString,
      ),
    ).toString('base64url');
  }

  verify(token: string): EngagementTrackingTokenPayload | null {
    try {
      const decrypted = this.secretEncryptionService.decryptVersionedOrThrow(
        Buffer.from(token, 'base64url').toString('utf8') as EncryptedString,
      );

      const decoded = JSON.parse(decrypted);

      const messageId = readOptionalString(decoded?.messageId);
      const personId = readOptionalString(decoded?.personId);

      // Tokens signed before the mass-compose path existed carry messageId
      // only, so either identifier is enough to name the campaign message.
      if (
        typeof decoded?.workspaceId !== 'string' ||
        typeof decoded?.campaignId !== 'string' ||
        (messageId === undefined && personId === undefined)
      ) {
        return null;
      }

      return {
        workspaceId: decoded.workspaceId,
        campaignId: decoded.campaignId,
        issuedAt: typeof decoded?.issuedAt === 'number' ? decoded.issuedAt : 0,
        ...(messageId === undefined ? {} : { messageId }),
        ...(personId === undefined ? {} : { personId }),
        ...(typeof decoded?.destinationUrl === 'string'
          ? { destinationUrl: decoded.destinationUrl }
          : {}),
      };
    } catch {
      return null;
    }
  }
}

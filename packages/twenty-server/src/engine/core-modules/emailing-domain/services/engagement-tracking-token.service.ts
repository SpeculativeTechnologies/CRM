import { Injectable } from '@nestjs/common';

import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { type EngagementTrackingTokenPayload } from 'src/engine/core-modules/emailing-domain/types/engagement-tracking-token-payload.type';

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

      if (
        typeof decoded?.workspaceId !== 'string' ||
        typeof decoded?.campaignId !== 'string' ||
        typeof decoded?.messageId !== 'string'
      ) {
        return null;
      }

      return {
        workspaceId: decoded.workspaceId,
        campaignId: decoded.campaignId,
        messageId: decoded.messageId,
        issuedAt: typeof decoded?.issuedAt === 'number' ? decoded.issuedAt : 0,
        ...(typeof decoded?.destinationUrl === 'string'
          ? { destinationUrl: decoded.destinationUrl }
          : {}),
      };
    } catch {
      return null;
    }
  }
}

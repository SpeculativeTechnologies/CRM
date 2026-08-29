import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type EmailingDomainSendEmailInput } from 'src/engine/core-modules/emailing-domain/drivers/types/emailing-domain-send-email-input.type';
import { EngagementTrackingTokenService } from 'src/engine/core-modules/emailing-domain/services/engagement-tracking-token.service';
import { addEngagementTrackingToHtml } from 'src/engine/core-modules/emailing-domain/utils/add-engagement-tracking-to-html.util';
import {
  buildClickTrackingUrl,
  buildOpenTrackingUrl,
} from 'src/engine/core-modules/emailing-domain/utils/build-engagement-tracking-urls.util';

@Injectable()
export class EngagementTrackingContentService {
  constructor(
    private readonly engagementTrackingTokenService: EngagementTrackingTokenService,
  ) {}

  // Only the HTML part is instrumented. A pixel cannot exist in plain text, and
  // rewriting bare URLs there would show recipients a redirect they cannot read.
  addTo(
    email: EmailingDomainSendEmailInput,
    trackingBaseUrl: string | null,
  ): EmailingDomainSendEmailInput {
    const tracking = email.engagementTracking;

    if (
      !isNonEmptyString(trackingBaseUrl) ||
      !isDefined(tracking) ||
      !isNonEmptyString(email.html)
    ) {
      return email;
    }

    const signTokenFor = (destinationUrl?: string): string =>
      this.engagementTrackingTokenService.sign({
        workspaceId: email.workspaceId,
        campaignId: tracking.campaignId,
        messageId: tracking.messageId,
        ...(isNonEmptyString(destinationUrl) ? { destinationUrl } : {}),
      });

    return {
      ...email,
      html: addEngagementTrackingToHtml({
        html: email.html,
        openUrl: buildOpenTrackingUrl(trackingBaseUrl, signTokenFor()),
        buildClickUrl: (destinationUrl) =>
          buildClickTrackingUrl(trackingBaseUrl, signTokenFor(destinationUrl)),
      }),
    };
  }
}

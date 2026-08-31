import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type EmailingDomainSendEmailInput } from 'src/engine/core-modules/emailing-domain/drivers/types/emailing-domain-send-email-input.type';
import { type EngagementTrackingContext } from 'src/engine/core-modules/emailing-domain/drivers/types/engagement-tracking-context.type';
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

    return {
      ...email,
      html: this.addToHtml({
        html: email.html,
        workspaceId: email.workspaceId,
        tracking,
        trackingBaseUrl,
      }),
    };
  }

  addToHtml({
    html,
    workspaceId,
    tracking,
    trackingBaseUrl,
  }: {
    html: string;
    workspaceId: string;
    tracking: EngagementTrackingContext;
    trackingBaseUrl: string | null;
  }): string {
    if (!isNonEmptyString(trackingBaseUrl) || !isNonEmptyString(html)) {
      return html;
    }

    const signTokenFor = (destinationUrl?: string): string =>
      this.engagementTrackingTokenService.sign({
        workspaceId,
        campaignId: tracking.campaignId,
        ...(isNonEmptyString(tracking.messageId)
          ? { messageId: tracking.messageId }
          : {}),
        ...(isNonEmptyString(tracking.personId)
          ? { personId: tracking.personId }
          : {}),
        ...(isNonEmptyString(destinationUrl) ? { destinationUrl } : {}),
      });

    return addEngagementTrackingToHtml({
      html,
      openUrl: buildOpenTrackingUrl(trackingBaseUrl, signTokenFor()),
      buildClickUrl: (destinationUrl) =>
        buildClickTrackingUrl(trackingBaseUrl, signTokenFor(destinationUrl)),
    });
  }
}

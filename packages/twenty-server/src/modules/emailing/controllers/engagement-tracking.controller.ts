import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Response } from 'express';
import { ApiPath } from 'twenty-shared/types';

import {
  TRACKING_PIXEL_CONTENT_TYPE,
  TRACKING_PIXEL_GIF,
  TRACKING_TOKEN_FORMAT,
} from 'src/engine/core-modules/emailing-domain/constants/engagement-tracking.constant';
import { EngagementTrackingTokenService } from 'src/engine/core-modules/emailing-domain/services/engagement-tracking-token.service';
import { type EngagementTrackingTokenPayload } from 'src/engine/core-modules/emailing-domain/types/engagement-tracking-token-payload.type';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { MessageEngagementService } from 'src/modules/emailing/services/message-engagement.service';

// Re-checked at redirect time as well as at rewrite time: this is the only
// place a forged or future-broken token could turn into an open redirect.
const REDIRECTABLE_SCHEME_PATTERN = /^https?:\/\//i;

@Controller(`${ApiPath.Emailing}/track`)
@UseGuards(PublicEndpointGuard, NoPermissionGuard)
export class EngagementTrackingController {
  private readonly logger = new Logger(EngagementTrackingController.name);

  constructor(
    private readonly engagementTrackingTokenService: EngagementTrackingTokenService,
    private readonly messageEngagementService: MessageEngagementService,
  ) {}

  // Always answers with the pixel, even for a token we cannot read, so a stale
  // or corrupted link never shows the recipient a broken image.
  @Get('open')
  async handleOpen(
    @Query('t') token: string,
    @Res() response: Response,
  ): Promise<void> {
    const payload = this.readToken(token);

    if (payload !== null) {
      await this.recordSilently(() =>
        this.messageEngagementService.recordOpen({
          workspaceId: payload.workspaceId,
          campaignId: payload.campaignId,
          messageId: payload.messageId,
        }),
      );
    }

    response
      .status(200)
      .setHeader('Content-Type', TRACKING_PIXEL_CONTENT_TYPE)
      .setHeader('Content-Length', TRACKING_PIXEL_GIF.length)
      // Without this a caching proxy answers every later open from its own copy
      // and the recipient's repeat opens never reach us.
      .setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private',
      )
      .setHeader('Pragma', 'no-cache')
      .setHeader('Expires', '0')
      .end(TRACKING_PIXEL_GIF);
  }

  @Get('click')
  async handleClick(
    @Query('t') token: string,
    @Res() response: Response,
  ): Promise<void> {
    const payload = this.readToken(token);

    if (
      payload === null ||
      !isNonEmptyString(payload.destinationUrl) ||
      !REDIRECTABLE_SCHEME_PATTERN.test(payload.destinationUrl)
    ) {
      throw new BadRequestException('Invalid tracking link');
    }

    await this.recordSilently(() =>
      this.messageEngagementService.recordClick({
        workspaceId: payload.workspaceId,
        campaignId: payload.campaignId,
        messageId: payload.messageId,
      }),
    );

    response
      .setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private',
      )
      .redirect(302, payload.destinationUrl);
  }

  private readToken(
    token: string | undefined,
  ): EngagementTrackingTokenPayload | null {
    if (!isNonEmptyString(token) || !TRACKING_TOKEN_FORMAT.test(token)) {
      return null;
    }

    return this.engagementTrackingTokenService.verify(token);
  }

  // Recording is best effort: a failed write must never cost the recipient the
  // image they expected or the page they clicked through to. It is still logged,
  // because tracking that quietly records nothing looks identical to no opens.
  private async recordSilently(record: () => Promise<void>): Promise<void> {
    try {
      await record();
    } catch (error) {
      this.logger.error(
        `Failed to record engagement: ${
          error instanceof Error ? error.stack : String(error)
        }`,
      );
    }
  }
}

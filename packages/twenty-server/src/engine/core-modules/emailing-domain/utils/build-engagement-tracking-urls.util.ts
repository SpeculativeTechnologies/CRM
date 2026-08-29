import { ApiPath } from 'twenty-shared/types';

import {
  CLICK_TRACKING_PATH,
  OPEN_TRACKING_PATH,
  TRACKING_TOKEN_QUERY_PARAM,
} from 'src/engine/core-modules/emailing-domain/constants/engagement-tracking.constant';

const buildTrackingUrl = (
  trackingBaseUrl: string,
  path: string,
  token: string,
): string =>
  `${trackingBaseUrl}/${ApiPath.Emailing}/${path}?${TRACKING_TOKEN_QUERY_PARAM}=${token}`;

export const buildOpenTrackingUrl = (
  trackingBaseUrl: string,
  token: string,
): string => buildTrackingUrl(trackingBaseUrl, OPEN_TRACKING_PATH, token);

export const buildClickTrackingUrl = (
  trackingBaseUrl: string,
  token: string,
): string => buildTrackingUrl(trackingBaseUrl, CLICK_TRACKING_PATH, token);

// 1x1 transparent GIF, the smallest payload that every mail client renders.
export const TRACKING_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export const TRACKING_PIXEL_CONTENT_TYPE = 'image/gif';

export const OPEN_TRACKING_PATH = 'track/open';
export const CLICK_TRACKING_PATH = 'track/click';

export const TRACKING_TOKEN_QUERY_PARAM = 't';

export const TRACKING_TOKEN_FORMAT = /^[A-Za-z0-9_-]{1,4096}$/;

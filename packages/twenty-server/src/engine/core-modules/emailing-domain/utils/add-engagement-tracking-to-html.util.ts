import { escapeHtml } from 'src/engine/core-modules/emailing-domain/utils/escape-html.util';

const QUOTED_ANCHOR_HREF_PATTERN =
  /(<a\b[^>]*?\shref\s*=\s*)("([^"]*)"|'([^']*)')/gi;

const CLOSING_BODY_PATTERN = /<\/body>(?![\s\S]*<\/body>)/i;

const TRACKABLE_SCHEME_PATTERN = /^https?:\/\//i;

// Only &amp; realistically appears inside an href in email HTML, and leaving it
// encoded would corrupt the query string of the destination we redirect to.
const decodeHrefEntities = (href: string): string =>
  href.replace(/&amp;/g, '&');

const buildPixelTag = (openUrl: string): string =>
  `<img src="${escapeHtml(openUrl)}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;border:0" />`;

export const injectOpenTrackingPixel = (
  html: string,
  openUrl: string,
): string => {
  const pixel = buildPixelTag(openUrl);
  const closingBodyIndex = html.search(CLOSING_BODY_PATTERN);

  if (closingBodyIndex === -1) {
    return `${html}${pixel}`;
  }

  return html.slice(0, closingBodyIndex) + pixel + html.slice(closingBodyIndex);
};

export const rewriteHtmlLinksForClickTracking = (
  html: string,
  buildClickUrl: (destinationUrl: string) => string,
): string =>
  html.replace(
    QUOTED_ANCHOR_HREF_PATTERN,
    (match, prefix, _quoted, doubleQuoted, singleQuoted) => {
      const rawHref = doubleQuoted ?? singleQuoted ?? '';
      const destinationUrl = decodeHrefEntities(rawHref).trim();

      if (!TRACKABLE_SCHEME_PATTERN.test(destinationUrl)) {
        return match;
      }

      return `${prefix}"${escapeHtml(buildClickUrl(destinationUrl))}"`;
    },
  );

export const addEngagementTrackingToHtml = ({
  html,
  openUrl,
  buildClickUrl,
}: {
  html: string;
  openUrl: string;
  buildClickUrl: (destinationUrl: string) => string;
}): string =>
  injectOpenTrackingPixel(
    rewriteHtmlLinksForClickTracking(html, buildClickUrl),
    openUrl,
  );

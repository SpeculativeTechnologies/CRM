import {
  addEngagementTrackingToHtml,
  injectOpenTrackingPixel,
  rewriteHtmlLinksForClickTracking,
} from 'src/engine/core-modules/emailing-domain/utils/add-engagement-tracking-to-html.util';

const buildClickUrl = (destinationUrl: string) =>
  `https://track.example.com/click?d=${destinationUrl}`;

describe('injectOpenTrackingPixel', () => {
  it('places the pixel inside the body when there is one', () => {
    const result = injectOpenTrackingPixel(
      '<html><body><p>Hi</p></body></html>',
      'https://track.example.com/open',
    );

    expect(result).toContain(
      '<p>Hi</p><img src="https://track.example.com/open"',
    );
    expect(result.endsWith('</body></html>')).toBe(true);
  });

  it('appends the pixel when the html is a bare fragment', () => {
    const result = injectOpenTrackingPixel(
      '<p>Hi</p>',
      'https://track.example.com/open',
    );

    expect(result.startsWith('<p>Hi</p><img')).toBe(true);
  });

  it('escapes the pixel url so it cannot break out of the attribute', () => {
    const result = injectOpenTrackingPixel(
      '<p>Hi</p>',
      'https://track.example.com/open?a=1&b=2',
    );

    expect(result).toContain('open?a=1&amp;b=2');
    expect(result).not.toContain('open?a=1&b=2');
  });
});

describe('rewriteHtmlLinksForClickTracking', () => {
  it('wraps http and https links', () => {
    const result = rewriteHtmlLinksForClickTracking(
      '<a href="https://example.com/a">A</a><a href="http://example.com/b">B</a>',
      buildClickUrl,
    );

    expect(result).toContain('click?d=https://example.com/a');
    expect(result).toContain('click?d=http://example.com/b');
  });

  it('leaves links a redirect cannot serve untouched', () => {
    const html = [
      '<a href="mailto:a@example.com">Mail</a>',
      '<a href="tel:+15551234">Call</a>',
      '<a href="#section">Jump</a>',
      '<a href="/relative">Relative</a>',
      '<a href="javascript:alert(1)">Bad</a>',
    ].join('');

    expect(rewriteHtmlLinksForClickTracking(html, buildClickUrl)).toBe(html);
  });

  it('decodes entities so the destination keeps its query string', () => {
    const result = rewriteHtmlLinksForClickTracking(
      '<a href="https://example.com/?a=1&amp;b=2">A</a>',
      (destinationUrl) => `https://track.example.com/click?d=${destinationUrl}`,
    );

    expect(result).toContain('d=https://example.com/?a=1&amp;b=2');
  });

  it('preserves other attributes on the anchor', () => {
    const result = rewriteHtmlLinksForClickTracking(
      '<a class="cta" href="https://example.com" target="_blank">A</a>',
      buildClickUrl,
    );

    expect(result).toContain('class="cta"');
    expect(result).toContain('target="_blank"');
  });

  it('handles single quoted hrefs', () => {
    const result = rewriteHtmlLinksForClickTracking(
      "<a href='https://example.com/a'>A</a>",
      buildClickUrl,
    );

    expect(result).toContain(
      'href="https://track.example.com/click?d=https://example.com/a"',
    );
  });
});

describe('addEngagementTrackingToHtml', () => {
  it('rewrites links and adds the pixel in one pass', () => {
    const result = addEngagementTrackingToHtml({
      html: '<html><body><a href="https://example.com">A</a></body></html>',
      openUrl: 'https://track.example.com/open',
      buildClickUrl,
    });

    expect(result).toContain('click?d=https://example.com');
    expect(result).toContain('<img src="https://track.example.com/open"');
  });
});

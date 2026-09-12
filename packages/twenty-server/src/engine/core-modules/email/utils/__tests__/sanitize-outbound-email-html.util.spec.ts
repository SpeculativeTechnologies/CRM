import {
  sanitizeOutboundEmailHtml,
  sanitizeOutboundEmailSubject,
} from 'src/engine/core-modules/email/utils/sanitize-outbound-email-html.util';

describe('outbound email sanitization', () => {
  beforeAll(() => {
    jest.useRealTimers();
  });

  it('should preserve full documents preceded by comments', async () => {
    const doctype =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
    const sanitized = await sanitizeOutboundEmailHtml(
      `<!-- generated -->${doctype}<html><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"><meta name="x-apple-disable-message-reformatting"><style>.hero { color: red; }</style></head><body><p class="hero">Hello</p></body></html>`,
    );

    expect(sanitized.startsWith(`${doctype}<html>`)).toBe(true);
    expect(sanitized).toContain('<head>');
    expect(sanitized).toContain(
      '<meta content="text/html; charset=UTF-8" http-equiv="Content-Type">',
    );
    expect(sanitized).toContain(
      '<meta name="x-apple-disable-message-reformatting">',
    );
    expect(sanitized).toContain('.hero { color: red; }');
    expect(sanitized).toContain('<body>');
  });

  it('should preserve doctypes with repeated whitespace before the HTML name', async () => {
    const doctype = '<!DOCTYPE \n\t html>';
    const sanitized = await sanitizeOutboundEmailHtml(
      `${doctype}<html><body>Hello</body></html>`,
    );

    expect(sanitized.startsWith(`${doctype}<html>`)).toBe(true);
  });

  it('should preserve quoted greater-than signs in doctypes', async () => {
    const doctype = '<!DOCTYPE html SYSTEM "about:legacy-compat?x=>">';
    const sanitized = await sanitizeOutboundEmailHtml(
      `${doctype}<html><body>Hello</body></html>`,
    );

    expect(sanitized.startsWith(`${doctype}<html>`)).toBe(true);
  });

  it('should reject active meta directives', async () => {
    const sanitized = await sanitizeOutboundEmailHtml(
      '<!doctype html><html><head><meta http-equiv="refresh" content="0;url=https://evil.test"></head><body>Hello</body></html>',
    );

    expect(sanitized).not.toContain('http-equiv="refresh"');
  });

  it('should scan repeated leading comments without regex backtracking', async () => {
    const comments = '<!---->'.repeat(2_000);

    const sanitized = await sanitizeOutboundEmailHtml(
      `${comments}<html><body><p>Hello</p></body></html>`,
    );

    expect(sanitized).toContain('<html>');
    expect(sanitized).toContain('<p>Hello</p>');
  });

  it('should not mistake similarly prefixed elements for an HTML document', async () => {
    await expect(
      sanitizeOutboundEmailHtml('<html-preview>Hello</html-preview>'),
    ).resolves.toBe('Hello');
  });

  // The colour a signature or body carries only survives as an inline style,
  // so the sanitizer keeping that declaration is part of the feature rather
  // than an incidental detail.
  it('should preserve the inline colour of text colour marks', async () => {
    const sanitized = await sanitizeOutboundEmailHtml(
      '<p><span style="color:#ce2c31">Regards</span></p>',
    );

    expect(sanitized).toBe('<p><span style="color:#ce2c31">Regards</span></p>');
  });

  it('should still drop scripting around coloured text', async () => {
    const sanitized = await sanitizeOutboundEmailHtml(
      '<p><span style="color:#3a5bc7" onclick="alert(1)">Regards</span><script>alert(2)</script></p>',
    );

    expect(sanitized).toContain('style="color:#3a5bc7"');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('<script>');
  });

  it.each([
    'width:expression(alert(1))',
    'background:url(javascript:alert(1))',
    'background-image:url(https://tracker.example/pixel)',
    'background-image:url(cid:attachment)',
    'behavior:url(https://example.test/code.htc)',
    '-moz-binding:url(https://example.test/code.xml)',
    '@import url(https://example.test/styles.css)',
    'position:fixed;top:0;left:0;z-index:9999',
    'position:absolute;inset:0',
    'display:none;visibility:hidden;opacity:0',
    'content:attr(data-secret);filter:blur(10px)',
    '--color:red;color:var(--color)',
    'width:calc(100% + 20px)',
    'width:e\\78pression(alert(1))',
    'background:u\\72l(javascript:alert(1))',
    'background:/**/url(https://tracker.example/pixel)',
    'background:u&#114;l(javascript:alert(1))',
    'width:&#101;xpression(alert(1))',
  ])('should remove unsafe inline CSS: %s', async (style) => {
    await expect(
      sanitizeOutboundEmailHtml(`<p style="${style}">Hello</p>`),
    ).resolves.toBe('<p>Hello</p>');
  });

  it('should preserve safe declarations alongside rejected CSS', async () => {
    const sanitized = await sanitizeOutboundEmailHtml(
      '<p style="color:red;position:fixed;background-image:url(https://tracker.example/pixel);padding:12px;text-align:center">Hello</p>',
    );

    expect(sanitized).toBe(
      '<p style="color:red;padding:12px;text-align:center">Hello</p>',
    );
  });

  it.each([
    'color:rgba(20,40,60,0.5)',
    'color:hsl(120deg 50% 50%)',
    'background:#ffffff',
    'font:italic 16px/1.5 Arial,sans-serif',
    'font-family:Arial,"Noto Sans"',
    'display:TABLE-CELL',
  ])('should preserve supported CSS values: %s', async (style) => {
    const sanitized = await sanitizeOutboundEmailHtml(
      `<p style='${style}'>Hello</p>`,
    );

    expect(sanitized).toContain(style.replace(/"/g, '&quot;'));
  });

  it('should reject invalid property values and recover after malformed declarations', async () => {
    await expect(
      sanitizeOutboundEmailHtml(
        '<p style="color:12px;font-size:red;broken;display:banana;color:blue;padding:4px">Hello</p>',
      ),
    ).resolves.toBe('<p style="color:blue;padding:4px">Hello</p>');
  });

  it('should preserve campaign table and signature formatting', async () => {
    const sanitized = await sanitizeOutboundEmailHtml(
      '<table style="width:100%;max-width:600px;border-collapse:collapse;table-layout:fixed"><tbody><tr><td style="display:table-cell;background-color:#ffffff;border:1px solid #cccccc;padding:12px 24px;vertical-align:top"><p style="font-family:Arial, sans-serif;font-size:16px;font-weight:700;font-style:italic;line-height:1.5;margin:0 auto;text-align:center;color:rgb(20, 40, 60)">Hello</p><a href="https://example.com" style="display:inline-block;text-decoration:underline;border-radius:4px">Read more</a></td></tr></tbody></table>',
    );

    expect(sanitized).toContain(
      'width:100%;max-width:600px;border-collapse:collapse;table-layout:fixed',
    );
    expect(sanitized).toContain('display:table-cell');
    expect(sanitized).toContain('background-color:#ffffff');
    expect(sanitized).toContain('border:1px solid #cccccc');
    expect(sanitized).toContain('padding:12px 24px;vertical-align:top');
    expect(sanitized).toContain('font-family:Arial,sans-serif');
    expect(sanitized).toContain(
      'font-size:16px;font-weight:700;font-style:italic',
    );
    expect(sanitized).toContain(
      'line-height:1.5;margin:0 auto;text-align:center',
    );
    expect(sanitized).toContain('color:rgb(20,40,60)');
    expect(sanitized).toContain(
      'display:inline-block;text-decoration:underline;border-radius:4px',
    );
    expect(sanitized).toContain('href="https://example.com"');
  });

  it('should handle quoted delimiters and normalize property casing', async () => {
    const sanitized = await sanitizeOutboundEmailHtml(
      '<p style="font-family:\'unsafe;position:fixed\';COLOR:blue !important;padding:4px">Hello</p>',
    );

    expect(sanitized).toBe(
      '<p style="color:blue!important;padding:4px">Hello</p>',
    );
  });

  it('should keep styles isolated across concurrent messages and repeated sanitization', async () => {
    const [safe, unsafe] = await Promise.all([
      sanitizeOutboundEmailHtml('<p style="color:red">Hello</p>'),
      sanitizeOutboundEmailHtml('<p style="position:fixed">Other</p>'),
    ]);

    expect(safe).toBe('<p style="color:red">Hello</p>');
    expect(unsafe).toBe('<p>Other</p>');
    await expect(sanitizeOutboundEmailHtml(safe)).resolves.toBe(safe);
  });

  it('should always sanitize subjects as plain text', async () => {
    await expect(
      sanitizeOutboundEmailSubject(
        '<html><body><strong>Hello</strong><script>alert(1)</script></body></html>',
      ),
    ).resolves.toBe('Hello');
  });

  it('should preserve plain-text subject characters without entity encoding', async () => {
    await expect(
      sanitizeOutboundEmailSubject('Price < 100 & ready'),
    ).resolves.toBe('Price < 100 & ready');
  });

  it('should collapse header control characters', async () => {
    await expect(
      sanitizeOutboundEmailSubject('Hello\r\nBcc: hidden@example.com'),
    ).resolves.toBe('Hello Bcc: hidden@example.com');
  });
});

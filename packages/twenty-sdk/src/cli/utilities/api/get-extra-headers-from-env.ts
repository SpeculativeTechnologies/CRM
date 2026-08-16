// Extra HTTP headers for every CLI API request, from the
// TWENTY_CLI_EXTRA_HEADERS env var as a JSON object, e.g.
// '{"CF-Access-Client-Id": "...", "CF-Access-Client-Secret": "..."}'.
// Lets the CLI reach instances behind an authenticating proxy such as
// Cloudflare Access, which rejects requests missing its service-token headers.
export const getExtraHeadersFromEnv = (): Record<string, string> => {
  const raw = process.env.TWENTY_CLI_EXTRA_HEADERS;

  if (!raw) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'TWENTY_CLI_EXTRA_HEADERS must be a JSON object of header names to string values',
    );
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.values(parsed).some((value) => typeof value !== 'string')
  ) {
    throw new Error(
      'TWENTY_CLI_EXTRA_HEADERS must be a JSON object of header names to string values',
    );
  }

  return parsed as Record<string, string>;
};

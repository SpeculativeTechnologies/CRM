import { getExtraHeadersFromEnv } from '@/cli/utilities/api/get-extra-headers-from-env';

describe('getExtraHeadersFromEnv', () => {
  afterEach(() => {
    delete process.env.TWENTY_CLI_EXTRA_HEADERS;
  });

  it('should return an empty object when the env var is unset', () => {
    expect(getExtraHeadersFromEnv()).toEqual({});
  });

  it('should parse a JSON object of headers', () => {
    process.env.TWENTY_CLI_EXTRA_HEADERS =
      '{"CF-Access-Client-Id": "id", "CF-Access-Client-Secret": "secret"}';

    expect(getExtraHeadersFromEnv()).toEqual({
      'CF-Access-Client-Id': 'id',
      'CF-Access-Client-Secret': 'secret',
    });
  });

  it('should throw on invalid JSON', () => {
    process.env.TWENTY_CLI_EXTRA_HEADERS = 'not-json';

    expect(() => getExtraHeadersFromEnv()).toThrow(
      'TWENTY_CLI_EXTRA_HEADERS must be a JSON object',
    );
  });

  it.each([['"a string"'], ['["array"]'], ['{"num": 1}'], ['null']])(
    'should throw on non-string-record JSON %s',
    (raw) => {
      process.env.TWENTY_CLI_EXTRA_HEADERS = raw;

      expect(() => getExtraHeadersFromEnv()).toThrow(
        'TWENTY_CLI_EXTRA_HEADERS must be a JSON object',
      );
    },
  );
});

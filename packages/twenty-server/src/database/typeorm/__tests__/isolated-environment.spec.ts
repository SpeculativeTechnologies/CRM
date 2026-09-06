import { config } from 'dotenv';

jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('isolated local database configuration', () => {
  const originalEnvironment = process.env;
  const localDatabaseUrl =
    'postgres://postgres:postgres@127.0.0.1:15432/default';
  const dotenvDatabaseUrl = 'postgres://example.invalid/default';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnvironment, PG_DATABASE_URL: localDatabaseUrl };
    jest.mocked(config).mockImplementation(() => {
      process.env.PG_DATABASE_URL = dotenvDatabaseUrl;

      return { parsed: { PG_DATABASE_URL: dotenvDatabaseUrl } };
    });
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it.each([true, false])(
    'should preserve the supervised connection only when dotenv is disabled (%s)',
    async (disableDotenv) => {
      process.env.TWENTY_DISABLE_DOTENV = String(disableDotenv);

      await jest.isolateModulesAsync(async () => {
        const { connectionSource } =
          await import('src/database/typeorm/core/core.datasource');
        const { rawDataSource } =
          await import('src/database/typeorm/raw/raw.datasource');
        const expectedUrl = disableDotenv
          ? localDatabaseUrl
          : dotenvDatabaseUrl;

        expect(connectionSource.options).toMatchObject({ url: expectedUrl });
        expect(rawDataSource.options).toMatchObject({ url: expectedUrl });
        expect(config).toHaveBeenCalledTimes(disableDotenv ? 0 : 2);
      });
    },
  );
});

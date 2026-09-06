import { config } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
if (process.env.TWENTY_DISABLE_DOTENV !== 'true') {
  config({
    path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    override: true,
  });
}

const typeORMRawModuleOptions: DataSourceOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error'],
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
};

export const rawDataSource = new DataSource(typeORMRawModuleOptions);

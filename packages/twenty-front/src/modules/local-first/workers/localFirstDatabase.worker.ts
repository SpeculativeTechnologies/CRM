import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';
import { worker } from '@electric-sql/pglite/worker';

void worker({
  init: async (options) =>
    PGlite.create({
      dataDir: options.dataDir,
      relaxedDurability: false,
      extensions: { live },
    }),
});

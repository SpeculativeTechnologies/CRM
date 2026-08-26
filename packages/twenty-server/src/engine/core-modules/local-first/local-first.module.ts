import { Module } from '@nestjs/common';

import { LocalFirstController } from 'src/engine/core-modules/local-first/controllers/local-first.controller';
import { LocalFirstShapeProxyService } from 'src/engine/core-modules/local-first/services/local-first-shape-proxy.service';

@Module({
  controllers: [LocalFirstController],
  providers: [LocalFirstShapeProxyService],
})
export class LocalFirstModule {}

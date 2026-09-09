import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreCommonApiModule } from 'src/engine/api/common/core-common-api.module';
import { LocalFirstOperationEntity } from 'src/engine/core-modules/local-first/entities/local-first-operation.entity';
import { LocalFirstChangeService } from 'src/engine/core-modules/local-first/services/local-first-change.service';
import { LocalFirstController } from 'src/engine/core-modules/local-first/controllers/local-first.controller';
import { LocalFirstSchemaService } from 'src/engine/core-modules/local-first/services/local-first-schema.service';
import { LocalFirstShapeProxyService } from 'src/engine/core-modules/local-first/services/local-first-shape-proxy.service';

@Module({
  imports: [
    CoreCommonApiModule,
    TypeOrmModule.forFeature([LocalFirstOperationEntity]),
  ],
  controllers: [LocalFirstController],
  providers: [
    LocalFirstShapeProxyService,
    LocalFirstSchemaService,
    LocalFirstChangeService,
  ],
})
export class LocalFirstModule {}

import { Module } from '@nestjs/common';
import { FxService } from './fx.service';
import { FxController } from './fx.controller';

import { FxApiService } from './fx-api.service';

@Module({
  providers: [FxService, FxApiService],
  controllers: [FxController],
  exports: [FxService],
})
export class FxModule {}

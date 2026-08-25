import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { FxModule } from '../fx/fx.module';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [FxModule, FeesModule],
  providers: [QuotesService],
  controllers: [QuotesController],
  exports: [QuotesService],
})
export class QuotesModule {}

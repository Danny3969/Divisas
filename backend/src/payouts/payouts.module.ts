import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { TransfersModule } from '../transfers/transfers.module';
import { CashModule } from '../cash/cash.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [TransfersModule, CashModule, LedgerModule],
  providers: [PayoutsService],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}

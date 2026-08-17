import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TransfersModule } from '../transfers/transfers.module';
import { CashModule } from '../cash/cash.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [TransfersModule, CashModule, LedgerModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}

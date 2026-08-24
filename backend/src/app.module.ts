import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { FxModule } from './fx/fx.module';
import { QuotesModule } from './quotes/quotes.module';
import { TransfersModule } from './transfers/transfers.module';
import { PaymentsModule } from './payments/payments.module';
import { PayoutsModule } from './payouts/payouts.module';
import { CashModule } from './cash/cash.module';
import { LedgerModule } from './ledger/ledger.module';
import { TreasuryModule } from './treasury/treasury.module';
import { AdminModule } from './admin/admin.module';
import { AccountingModule } from './accounting/accounting.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    CustomersModule,
    BeneficiariesModule,
    FxModule,
    QuotesModule,
    TransfersModule,
    PaymentsModule,
    PayoutsModule,
    CashModule,
    LedgerModule,
    TreasuryModule,
    AccountingModule,
    AdminModule,
  ],
})
export class AppModule {}

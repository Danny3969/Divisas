import { PrismaClient, Role, CorridorDirection, CustomerType, DocumentType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== SEED DIVISAS ===');

  // 1. Países y monedas
  const ec = await prisma.country.upsert({
    where: { code: 'EC' },
    update: {},
    create: { code: 'EC', name: 'Ecuador', currency: 'USD' },
  });
  const pe = await prisma.country.upsert({
    where: { code: 'PE' },
    update: {},
    create: { code: 'PE', name: 'Perú', currency: 'PEN' },
  });
  for (const c of [
    { code: 'USD', name: 'Dólar estadounidense' },
    { code: 'PEN', name: 'Sol peruano' },
  ]) {
    await prisma.currency.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  // 2. Oficinas
  const officeEc = await prisma.office.upsert({
    where: { id: 'office-ec' },
    update: {},
    create: { id: 'office-ec', name: 'Oficina Quito', countryId: ec.id, address: 'Quito, Ecuador' },
  });
  const officePe = await prisma.office.upsert({
    where: { id: 'office-pe' },
    update: {},
    create: { id: 'office-pe', name: 'Oficina Lima', countryId: pe.id, address: 'Lima, Perú' },
  });

  // 3. Corredores
  const corridorE2P = await prisma.corridor.upsert({
    where: { direction: CorridorDirection.EC_TO_PE },
    update: {},
    create: {
      fromCountryId: ec.id,
      toCountryId: pe.id,
      fromCurrency: 'USD',
      toCurrency: 'PEN',
      direction: CorridorDirection.EC_TO_PE,
    },
  });
  const corridorP2E = await prisma.corridor.upsert({
    where: { direction: CorridorDirection.PE_TO_EC },
    update: {},
    create: {
      fromCountryId: pe.id,
      toCountryId: ec.id,
      fromCurrency: 'PEN',
      toCurrency: 'USD',
      direction: CorridorDirection.PE_TO_EC,
    },
  });

  // 4. Tasas FX
  await prisma.fxRate.updateMany({ where: { active: true }, data: { active: false } });
  await prisma.fxRate.create({
    data: { corridorId: corridorE2P.id, marketRate: 3.52, sellRate: 3.49, spreadBps: 85 },
  });
  await prisma.fxRate.create({
    data: { corridorId: corridorP2E.id, marketRate: 0.2841, sellRate: 0.2801, spreadBps: 140 },
  });

  // 5. Cuentas de caja con límites de seguridad
  await prisma.cashAccount.upsert({
    where: { code: 'MAIN-EC-01' },
    update: { maxBalance: 3000, requiresSupervisorAbove: 1000 },
    create: {
      code: 'MAIN-EC-01',
      officeId: officeEc.id,
      currency: 'USD',
      maxBalance: 3000,
      requiresSupervisorAbove: 1000,
    },
  });
  await prisma.cashAccount.upsert({
    where: { code: 'MAIN-PE-01' },
    update: { maxBalance: 12000, requiresSupervisorAbove: 4000 },
    create: {
      code: 'MAIN-PE-01',
      officeId: officePe.id,
      currency: 'PEN',
      maxBalance: 12000,
      requiresSupervisorAbove: 4000,
    },
  });

  // 6. Cuentas bancarias oficiales de la empresa
  await prisma.bankAccount.upsert({
    where: { accountNumber: 'EC-PICHINCHA-USD' },
    update: {},
    create: {
      bankName: 'Banco Pichincha',
      bankCode: 'PICHINCHA',
      accountType: 'CHECKING',
      countryId: ec.id,
      accountName: 'Divisas Ecuador S.A. - Cta Corriente USD',
      accountNumber: '2100123456',
      currency: 'USD',
    },
  });
  await prisma.bankAccount.upsert({
    where: { accountNumber: 'EC-GUAYAQUIL-USD' },
    update: {},
    create: {
      bankName: 'Banco Guayaquil',
      bankCode: 'GUAYAQUIL',
      accountType: 'CHECKING',
      countryId: ec.id,
      accountName: 'Divisas Ecuador S.A. - Cta Corriente USD',
      accountNumber: '1100987654',
      currency: 'USD',
    },
  });
  await prisma.bankAccount.upsert({
    where: { accountNumber: 'PE-BCP-PEN' },
    update: {},
    create: {
      bankName: 'BCP Banco de Crédito del Perú',
      bankCode: 'BCP',
      accountType: 'CHECKING',
      cci: '00219100123456789012',
      countryId: pe.id,
      accountName: 'Divisas Perú S.A.C. - Cta Corriente PEN',
      accountNumber: '191-98765432-0-12',
      currency: 'PEN',
    },
  });

  // 7. Cuentas contables (ledger)
  for (const acc of [
    { code: '1010-EC', name: 'Banco Ecuador (USD)', type: 'ASSET', currency: 'USD' },
    { code: '1020-EC', name: 'Caja Ecuador (USD)', type: 'ASSET', currency: 'USD' },
    { code: '2030-EC', name: 'Pasivo remesas Ecuador (USD)', type: 'LIABILITY', currency: 'USD' },
    { code: '1010-PE', name: 'Banco Perú (PEN)', type: 'ASSET', currency: 'PEN' },
    { code: '1020-PE', name: 'Caja Perú (PEN)', type: 'ASSET', currency: 'PEN' },
    { code: '2030-PE', name: 'Pasivo remesas Perú (PEN)', type: 'LIABILITY', currency: 'PEN' },
    { code: '4010', name: 'Ingresos por comisión (USD)', type: 'INCOME', currency: 'USD' },
    { code: '4011', name: 'Ingresos por comisión (PEN)', type: 'INCOME', currency: 'PEN' },
  ]) {
    await prisma.ledgerAccount.upsert({
      where: { code: acc.code },
      update: {},
      create: { ...acc, type: acc.type as any },
    });
  }

  // 8. Usuarios demo
  const passwordHash = await bcrypt.hash('Divisas2026!', 10);
  const users = [
    { email: 'admin@divisas.com', fullName: 'Admin Sistema', role: Role.ADMIN },
    { email: 'cajero.ec@divisas.com', fullName: 'Ana López', role: Role.CASHIER, officeId: officeEc.id },
    { email: 'cajero.pe@divisas.com', fullName: 'Carlos Ruiz', role: Role.CASHIER, officeId: officePe.id },
    { email: 'supervisor@divisas.com', fullName: 'María Gómez', role: Role.SUPERVISOR },
    { email: 'compliance@divisas.com', fullName: 'Jorge Salas', role: Role.COMPLIANCE },
    { email: 'treasury@divisas.com', fullName: 'Lucía Torres', role: Role.TREASURY },
    { email: 'auditor@divisas.com', fullName: 'Pedro Díaz', role: Role.AUDITOR },
    { email: 'juan.perez@example.com', fullName: 'Juan Pérez', role: Role.CUSTOMER },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, fullName: u.fullName, role: u.role, officeId: (u as any).officeId },
    });
  }

  // 9. Cliente demo (Juan Pérez) con KYC aprobado
  const juan = await prisma.user.findUnique({ where: { email: 'juan.perez@example.com' } });
  if (juan) {
    await prisma.customer.upsert({
      where: { userId: juan.id },
      update: {},
      create: {
        userId: juan.id,
        type: CustomerType.PERSON,
        fullName: 'Juan Pérez',
        documentType: DocumentType.CEDULA,
        documentNumber: '1700000001',
        countryId: ec.id,
        email: 'juan.perez@example.com',
        phone: '+593900000001',
        kycStatus: 'APPROVED',
        riskScore: 5,
      },
    });
  }

  // 10. Beneficiario demo (María Pérez, Perú)
  const customerJuan = await prisma.customer.findUnique({ where: { userId: juan?.id ?? '' } });
  if (customerJuan) {
    const maria = await prisma.beneficiary.upsert({
      where: { id: 'ben-maria' },
      update: {},
      create: {
        id: 'ben-maria',
        customerId: customerJuan.id,
        fullName: 'María Pérez',
        documentType: DocumentType.DNI,
        documentNumber: '40000001',
        countryId: pe.id,
        phone: '+51900000001',
      },
    });
    await prisma.beneficiaryAccount.upsert({
      where: { id: 'acc-maria-bcp' },
      update: {},
      create: {
        id: 'acc-maria-bcp',
        beneficiaryId: maria.id,
        bankName: 'BCP',
        accountNumber: '191234567890123456',
        accountType: 'ahorros',
        currency: 'PEN',
        isDefault: true,
      },
    });
  }

  console.log('=== SEED COMPLETADO ===');
  console.log('Usuarios demo (password: Divisas2026!):');
  for (const u of users) console.log(`  ${u.email}  ->  ${u.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

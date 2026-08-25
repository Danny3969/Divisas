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

  // 2. Oficinas (Ecuador y Perú)
  const officeEc = await prisma.office.upsert({
    where: { id: 'office-ec' },
    update: { name: 'Ecuador' },
    create: { id: 'office-ec', name: 'Ecuador', countryId: ec.id, address: 'Ecuador' },
  });
  const officePe = await prisma.office.upsert({
    where: { id: 'office-pe' },
    update: { name: 'Perú' },
    create: { id: 'office-pe', name: 'Perú', countryId: pe.id, address: 'Perú' },
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
    where: { accountNumber: '2100123456' },
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
    where: { accountNumber: '1100987654' },
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
    where: { accountNumber: '191-98765432-0-12' },
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
    // 1000 - Activos (Ecuador USD)
    { code: '1010-EC', name: 'Banco Pichincha (USD)', type: 'ASSET', currency: 'USD' },
    { code: '1011-EC', name: 'Banco Guayaquil (USD)', type: 'ASSET', currency: 'USD' },
    { code: '1020-EC', name: 'Caja Efectivo Ecuador (USD)', type: 'ASSET', currency: 'USD' },
    { code: '1030-EC', name: 'IVA Crédito Tributario 15% (USD)', type: 'ASSET', currency: 'USD' },

    // 1000 - Activos (Perú PEN)
    { code: '1010-PE', name: 'Banco BCP (PEN)', type: 'ASSET', currency: 'PEN' },
    { code: '1020-PE', name: 'Caja Efectivo Perú (PEN)', type: 'ASSET', currency: 'PEN' },
    { code: '1030-PE', name: 'IGV Crédito Fiscal 18% (PEN)', type: 'ASSET', currency: 'PEN' },

    // 2000 - Pasivos
    { code: '2030-EC', name: 'Pasivo remesas por pagar Ecuador (USD)', type: 'LIABILITY', currency: 'USD' },
    { code: '2030-PE', name: 'Pasivo remesas por pagar Perú (PEN)', type: 'LIABILITY', currency: 'PEN' },
    { code: '2040-EC', name: 'Cuentas por pagar proveedores (USD)', type: 'LIABILITY', currency: 'USD' },
    { code: '2040-PE', name: 'Cuentas por pagar proveedores (PEN)', type: 'LIABILITY', currency: 'PEN' },

    // 3000 - Patrimonio
    { code: '3010', name: 'Capital Social / Aportes de Socios', type: 'EQUITY', currency: 'USD' },
    { code: '3020', name: 'Retiros de Utilidades / Dividendos', type: 'EQUITY', currency: 'USD' },

    // 4000 - Ingresos
    { code: '4010', name: 'Ingresos por comisiones de giros (USD)', type: 'INCOME', currency: 'USD' },
    { code: '4011', name: 'Ingresos por comisiones de giros (PEN)', type: 'INCOME', currency: 'PEN' },
    { code: '4020', name: 'Ganancia por diferencial cambiario (FX Spread)', type: 'INCOME', currency: 'USD' },

    // 5000 - Gastos Operativos
    { code: '5010', name: 'Alquiler y Arriendos', type: 'EXPENSE', currency: 'USD' },
    { code: '5020', name: 'Servicios Básicos (Luz, Agua, Internet, Teléfono)', type: 'EXPENSE', currency: 'USD' },
    { code: '5030', name: 'Sueldos y Nómina de Personal', type: 'EXPENSE', currency: 'USD' },
    { code: '5040', name: 'Comisiones Bancarias y Pasarelas', type: 'EXPENSE', currency: 'USD' },
    { code: '5050', name: 'Software, Servidores y Hosting', type: 'EXPENSE', currency: 'USD' },
    { code: '5060', name: 'Suministros de Oficina y Papelería', type: 'EXPENSE', currency: 'USD' },
    { code: '5070', name: 'Publicidad y Marketing', type: 'EXPENSE', currency: 'USD' },
    { code: '5080', name: 'Impuestos y Tasas Municipales', type: 'EXPENSE', currency: 'USD' },
    { code: '5090', name: 'Gastos Operativos Varios', type: 'EXPENSE', currency: 'USD' },
  ]) {
    await prisma.ledgerAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name, type: acc.type as any, currency: acc.currency },
      create: { ...acc, type: acc.type as any },
    });
  }

  // 8. Usuarios demo
  const passwordHash = await bcrypt.hash('Valex2026!', 10);
  const users = [
    // VALEX emails
    { email: 'admin@valex.com', fullName: 'Admin General VALEX', role: Role.ADMIN },
    { email: 'admin@divisas.com', fullName: 'Admin Sistema', role: Role.ADMIN },
    { email: 'cajero.ec@valex.com', fullName: 'Ana López (Ecuador)', role: Role.CASHIER, officeId: officeEc.id },
    { email: 'cajero.ec@divisas.com', fullName: 'Ana López (EC)', role: Role.CASHIER, officeId: officeEc.id },
    { email: 'cajero.pe@valex.com', fullName: 'Carlos Ruiz (Perú)', role: Role.CASHIER, officeId: officePe.id },
    { email: 'cajero.pe@divisas.com', fullName: 'Carlos Ruiz (PE)', role: Role.CASHIER, officeId: officePe.id },
    { email: 'supervisor@valex.com', fullName: 'María Gómez (Supervisor)', role: Role.SUPERVISOR },
    { email: 'supervisor@divisas.com', fullName: 'María Gómez', role: Role.SUPERVISOR },
    { email: 'compliance@valex.com', fullName: 'Jorge Salas (Compliance)', role: Role.COMPLIANCE },
    { email: 'compliance@divisas.com', fullName: 'Jorge Salas', role: Role.COMPLIANCE },
    { email: 'treasury@valex.com', fullName: 'Lucía Torres (Tesorería)', role: Role.TREASURY },
    { email: 'treasury@divisas.com', fullName: 'Lucía Torres', role: Role.TREASURY },
    { email: 'auditor@valex.com', fullName: 'Pedro Díaz (Auditor)', role: Role.AUDITOR },
    { email: 'auditor@divisas.com', fullName: 'Pedro Díaz', role: Role.AUDITOR },
    { email: 'cliente.ec@valex.com', fullName: 'Juan Pérez (Cliente EC)', role: Role.CUSTOMER },
    { email: 'cliente.pe@valex.com', fullName: 'Rosa Flores (Cliente PE)', role: Role.CUSTOMER },
    { email: 'juan.perez@example.com', fullName: 'Juan Pérez', role: Role.CUSTOMER },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        officeId: (u as any).officeId,
      },
      create: {
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        officeId: (u as any).officeId,
      },
    });
  }

  // 9. Clientes demo con KYC aprobado
  const clienteEc = await prisma.user.findUnique({ where: { email: 'cliente.ec@valex.com' } });
  if (clienteEc) {
    await prisma.customer.upsert({
      where: { userId: clienteEc.id },
      update: { kycStatus: 'APPROVED' },
      create: {
        userId: clienteEc.id,
        type: CustomerType.PERSON,
        fullName: 'Juan Pérez (Cliente EC)',
        documentType: DocumentType.CEDULA,
        documentNumber: '1104567890',
        countryId: ec.id,
        email: 'cliente.ec@valex.com',
        phone: '+593991234567',
        kycStatus: 'APPROVED',
        riskScore: 5,
      },
    });
  }

  const clientePe = await prisma.user.findUnique({ where: { email: 'cliente.pe@valex.com' } });
  if (clientePe) {
    await prisma.customer.upsert({
      where: { userId: clientePe.id },
      update: { kycStatus: 'APPROVED' },
      create: {
        userId: clientePe.id,
        type: CustomerType.PERSON,
        fullName: 'Rosa Flores (Cliente PE)',
        documentType: DocumentType.DNI,
        documentNumber: '45678901',
        countryId: pe.id,
        email: 'cliente.pe@valex.com',
        phone: '+51987654321',
        kycStatus: 'APPROVED',
        riskScore: 5,
      },
    });
  }

  // 10. Beneficiario demo (María Pérez, Perú)
  const customerJuan = await prisma.customer.findUnique({ where: { userId: clienteEc?.id ?? '' } });
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

  // 11. Proveedores iniciales
  for (const sup of [
    { name: 'CNT Ecuador (Internet & Telefonía)', taxId: '1768152560001', countryId: ec.id, category: 'UTILITIES', phone: '+59323731700', email: 'atencion@cnt.gob.ec', bankName: 'Banco Pichincha' },
    { name: 'Claro Perú (Telecomunicaciones)', taxId: '20467534026', countryId: pe.id, category: 'UTILITIES', phone: '+5116131000', email: 'corporativo@claro.com.pe', bankName: 'BCP' },
    { name: 'Inmobiliaria Quito Centro (Arriendo Local)', taxId: '1791234567001', countryId: ec.id, category: 'RENT', phone: '+593998765432', email: 'arriendos@quitoinm.com', bankName: 'Banco Pichincha' },
  ]) {
    const existing = await prisma.supplier.findFirst({ where: { name: sup.name } });
    if (!existing) {
      await prisma.supplier.create({ data: sup });
    }
  }

  // 12. Trabajadores iniciales de nómina
  for (const emp of [
    { fullName: 'Ana María López', documentType: DocumentType.CEDULA, documentNumber: '1712345678', countryId: ec.id, position: 'Cajera Principal Quito', baseSalary: 550, salaryCurrency: 'USD', bankName: 'Banco Pichincha', bankAccountNumber: '2100889977' },
    { fullName: 'Carlos Alberto Ruiz', documentType: DocumentType.DNI, documentNumber: '45678912', countryId: pe.id, position: 'Cajero Principal Lima', baseSalary: 1800, salaryCurrency: 'PEN', bankName: 'BCP', bankAccountNumber: '191-44556677-0-11' },
  ]) {
    await prisma.employee.upsert({
      where: { documentType_documentNumber: { documentType: emp.documentType, documentNumber: emp.documentNumber } },
      update: {},
      create: { ...emp, baseSalary: new (require('@prisma/client/runtime/library').Decimal)(emp.baseSalary) },
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

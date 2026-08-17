import { test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.API_URL ?? "http://localhost:3000/api";

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

let tokens = {};
let customer, beneficiary, account, quote, transfer, payment, payout;
const stamp = Date.now().toString().slice(-6);

before(async () => {
  const login = await req("POST", "/auth/login", { email: "cajero.ec@divisas.com", password: "Divisas2026!" });
  if (!login.ok) throw new Error("API no disponible: no se pudo autenticar cajero");
  tokens.cajero = login.data.accessToken;
  const c = await req("POST", "/auth/login", { email: "compliance@divisas.com", password: "Divisas2026!" });
  tokens.compliance = c.data.accessToken;
  const t = await req("POST", "/auth/login", { email: "treasury@divisas.com", password: "Divisas2026!" });
  tokens.treasury = t.data.accessToken;
});

test("flujo BANK end-to-end: cliente → KYC → beneficiario → transferencia → pago → payout", async () => {
  const countries = (await req("GET", "/fx/countries", null, tokens.cajero)).data;
  const ec = countries.find((c) => c.code === "EC").id;
  const pe = countries.find((c) => c.code === "PE").id;

  const created = await req("POST", "/customers", {
    type: "PERSON",
    fullName: `E2E Bank ${stamp}`,
    documentType: "CEDULA",
    documentNumber: `17${stamp}01`,
    countryId: ec,
    phone: "0999000099",
  }, tokens.cajero);
  assert.ok(created.ok, `crear cliente: ${JSON.stringify(created.data)}`);
  customer = created.data;

  const kyc = await req("POST", `/customers/${customer.id}/kyc`, { decision: "APPROVE", riskScore: 5 }, tokens.compliance);
  assert.equal(kyc.status, 201, "aprobar KYC con decision=APPROVE");
  assert.equal(kyc.data.kycStatus, "APPROVED");

  const ben = await req("POST", "/beneficiaries", {
    customerId: customer.id,
    fullName: `E2E Benef ${stamp}`,
    documentType: "DNI",
    documentNumber: `40${stamp}02`,
    countryId: pe,
  }, tokens.cajero);
  assert.ok(ben.ok, `crear beneficiario: ${JSON.stringify(ben.data)}`);
  beneficiary = ben.data;

  const acc = await req("POST", `/beneficiaries/${beneficiary.id}/accounts`, {
    bankName: "BCP", accountNumber: `19123456${stamp}`, accountType: "ahorros", currency: "PEN",
  }, tokens.cajero);
  assert.ok(acc.ok, "crear cuenta bancaria del beneficiario");
  account = acc.data;

  const corridors = (await req("GET", "/fx/corridors", null, tokens.cajero)).data;
  const corr = corridors.find((c) => c.active && c.direction === "EC_TO_PE");
  const q = await req("POST", "/quotes", {
    corridorId: corr.id, sendAmount: 250, sendCurrency: corr.fromCurrency, senderCustomerId: customer.id,
  }, tokens.cajero);
  assert.ok(q.ok, `cotizar: ${JSON.stringify(q.data)}`);
  quote = q.data;

  const tr = await req("POST", "/transfers", {
    quoteId: quote.id,
    senderCustomerId: customer.id,
    beneficiaryId: beneficiary.id,
    payoutMethod: "BANK",
    paymentMethod: "BANK_TRANSFER",
    payoutAccountId: account.id,
  }, tokens.cajero);
  assert.ok(tr.ok, `crear transferencia: ${JSON.stringify(tr.data)}`);
  transfer = tr.data;
  assert.equal(transfer.status, "CONFIRMED");
  assert.match(transfer.reference, /^TRX-/);
  assert.equal(transfer.payoutMethod, "BANK");

  const pay = await req("POST", "/payments/bank", {
    transferId: transfer.id,
    amount: Number(transfer.sendAmount),
    currency: transfer.sendCurrency,
    bankName: "Banco Pichincha",
    transactionRef: `TXE2E-${stamp}`,
  }, tokens.cajero);
  assert.ok(pay.ok, `registrar pago bancario: ${JSON.stringify(pay.data)}`);
  payment = pay.data;
  assert.equal(payment.status, "PENDING");

  const conf = await req("POST", `/payments/bank/${payment.id}/confirm`, { detail: "E2E" }, tokens.treasury);
  assert.equal(conf.status, 201, `confirmar pago: ${JSON.stringify(conf.data)}`);
  assert.equal(conf.data.status, "SETTLEMENT_PENDING");

  const po = await req("POST", "/payouts/bank", { transferId: transfer.id }, tokens.treasury);
  assert.ok(po.ok, `payout bancario: ${JSON.stringify(po.data)}`);
  payout = po.data;
  assert.equal(payout.status, "COMPLETED");

  const detail = (await req("GET", `/transfers/${transfer.id}`, null, tokens.cajero)).data;
  assert.equal(detail.status, "COMPLETED");
  assert.equal(detail.withdrawalUsed, false, "pago bancario no usa código de retiro");
});

test("el ledger de doble partida queda balanceado para la operación BANK", async () => {
  assert.ok(transfer, "requiere el test anterior");
  const entries = (await req("GET", `/ledger/entries?transferId=${transfer.id}`, null, tokens.treasury)).data;
  assert.ok(entries.length >= 5, `asientos esperados (>=5), hay ${entries.length}`);
  const debit = entries.filter((e) => e.side === "DEBIT").reduce((a, e) => a + Number(e.amount), 0);
  const credit = entries.filter((e) => e.side === "CREDIT").reduce((a, e) => a + Number(e.amount), 0);
  assert.equal(debit, credit, `D=${debit} C=${credit} deben ser iguales`);
  const fee = entries.find((e) => e.account.code === "4010" || e.account.code === "4011");
  assert.ok(fee, "debe registrarse la comisión");
});

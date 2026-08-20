/**
 * scripts/import-legacy-data.ts
 *
 * Idempotent import of historical financial data from legacy Excel files.
 * Source files expected in /legacy-data/:
 *   - TF - Expense Tracker.xlsx   → Expense register
 *   - Income.xlsx                  → Historical income records
 *
 * Usage:  npm run import-legacy
 *
 * Safe to re-run: uses expenseId (expenses) and importId (income) as unique keys.
 * Existing rows are skipped. A summary table is printed on completion.
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDateSafe(raw: unknown): Date {
  if (!raw) return new Date();
  if (raw instanceof Date) return isNaN(raw.getTime()) ? new Date() : raw;
  if (typeof raw === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const s = String(raw).trim();
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toIntCents(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return 0;
  return Math.round(n * 100); // convert LKR → cents
}

function normaliseStr(raw: unknown): string {
  return raw ? String(raw).trim() : '';
}

function mapPaymentMethod(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('bank') || s.includes('transfer')) return 'BANK_TRANSFER';
  if (s.includes('card')) return 'CARD';
  if (s.includes('cheque') || s.includes('check')) return 'CHEQUE';
  if (s.includes('online')) return 'ONLINE';
  if (s.includes('cash')) return 'CASH';
  return 'OTHER_PAYMENT';
}

function mapDepartment(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('wedding') || s.includes('operation')) return 'WEDDING_OPERATIONS';
  if (s.includes('sales')) return 'SALES';
  if (s.includes('finance') || s.includes('account')) return 'FINANCE';
  if (s.includes('owner') || s.includes('designer')) return 'OWNER_DESIGNER';
  if (s.includes('admin')) return 'ADMIN';
  if (s.includes('marketing')) return 'MARKETING';
  return 'OTHER_DEPT';
}

function mapPaymentStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('unpaid') || s.includes('un-paid')) return 'UNPAID';
  if (s.includes('partial')) return 'PARTIALLY_PAID';
  if (s.includes('reimburse') && s.includes('to')) return 'TO_REIMBURSE';
  if (s.includes('reimburse')) return 'REIMBURSED';
  return 'PAID';
}

function mapApprovalStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('pending')) return 'PENDING';
  if (s.includes('reject')) return 'REJECTED';
  return 'APPROVED';
}

// ─── Import Expenses ─────────────────────────────────────────────────────────

async function importExpenses(filePath: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const stats = { imported: 0, skipped: 0, errors: [] as string[] };

  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ File not found: ${filePath} — skipping expense import.`);
    return stats;
  }

  const workbook = XLSX.readFile(filePath);

  // Try to find the "Expense Register" sheet or fall back to first sheet
  const sheetName =
    workbook.SheetNames.find(
      (n) => n.toLowerCase().includes('expense') || n.toLowerCase().includes('register')
    ) ?? workbook.SheetNames[0];

  console.log(`  📄 Reading sheet: "${sheetName}" from ${path.basename(filePath)}`);
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    console.warn('  ⚠ No rows found in expense sheet.');
    return stats;
  }

  // Print detected column names
  const sampleKeys = Object.keys(rows[0]);
  console.log(`  🔑 Detected columns: ${sampleKeys.join(', ')}`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    try {
      // Flexible column matching — try multiple possible header names
      const expenseIdRaw =
        normaliseStr(row['Expense ID'] ?? row['ID'] ?? row['expense_id'] ?? row['Ref'] ?? '');
      const dateRaw = row['Date'] ?? row['date'] ?? row['Expense Date'] ?? '';
      const descRaw = normaliseStr(
        row['Description'] ?? row['description'] ?? row['Particulars'] ?? row['Memo'] ?? ''
      );
      const categoryRaw = normaliseStr(
        row['Category'] ?? row['category'] ?? row['Type'] ?? row['Expense Type'] ?? 'Other'
      );
      const amountRaw = row['Amount'] ?? row['amount'] ?? row['Total'] ?? row['Cost'] ?? 0;
      const taxRaw = row['Tax'] ?? row['VAT'] ?? row['tax_vat'] ?? 0;
      const bookingIdRaw = normaliseStr(
        row['Wedding ID'] ?? row['Booking ID'] ?? row['booking_id'] ?? ''
      );
      const clientRaw = normaliseStr(
        row['Client Name'] ?? row['Client'] ?? row['Customer'] ?? row['client_name'] ?? ''
      );
      const supplierRaw = normaliseStr(
        row['Supplier'] ?? row['Vendor'] ?? row['supplier_name'] ?? ''
      );
      const supplierContactRaw = normaliseStr(
        row['Supplier Contact'] ?? row['Contact'] ?? row['supplier_contact'] ?? ''
      );
      const deptRaw = normaliseStr(
        row['Department'] ?? row['department'] ?? row['Dept'] ?? ''
      );
      const paymentMethodRaw = normaliseStr(
        row['Payment Method'] ?? row['Payment Mode'] ?? row['payment_method'] ?? 'Cash'
      );
      const paymentStatusRaw = normaliseStr(
        row['Payment Status'] ?? row['Status'] ?? row['payment_status'] ?? 'Paid'
      );
      const approvalStatusRaw = normaliseStr(
        row['Approval Status'] ?? row['Approval'] ?? row['approval_status'] ?? 'Approved'
      );
      const paidByRaw = normaliseStr(
        row['Paid By'] ?? row['paid_by'] ?? row['Payer'] ?? ''
      );
      const notesRaw = normaliseStr(
        row['Notes'] ?? row['Remarks'] ?? row['notes'] ?? ''
      );

      // Skip completely empty rows
      if (!descRaw && !amountRaw && !categoryRaw) continue;

      const amountCents = toIntCents(amountRaw);
      const taxCents = toIntCents(taxRaw);
      const totalCents = amountCents + taxCents;

      // Build a stable expenseId — use provided ID or generate from row fingerprint
      const stableExpenseId =
        expenseIdRaw ||
        `LEGACY-EXP-${normaliseStr(dateRaw).replace(/[^0-9]/g, '')}-${i.toString().padStart(4, '0')}`;

      // Check idempotency — skip if already imported
      const existing = await prisma.expense.findUnique({
        where: { expenseId: stableExpenseId },
        select: { id: true },
      });

      if (existing) {
        stats.skipped++;
        continue;
      }

      await prisma.expense.create({
        data: {
          expenseId: stableExpenseId,
          date: toDateSafe(dateRaw),
          bookingId: bookingIdRaw || null,
          clientName: clientRaw || null,
          description: descRaw || `Row ${rowNum}`,
          category: categoryRaw,
          supplierName: supplierRaw || null,
          supplierContact: supplierContactRaw || null,
          department: mapDepartment(deptRaw) as any,
          paymentMethod: mapPaymentMethod(paymentMethodRaw) as any,
          amount: amountCents,
          taxVat: taxCents,
          totalAmount: totalCents,
          paidByName: paidByRaw || null,
          paymentStatus: mapPaymentStatus(paymentStatusRaw) as any,
          approvalStatus: mapApprovalStatus(approvalStatusRaw) as any,
          notes: notesRaw || null,
          importedFrom: path.basename(filePath),
        },
      });

      stats.imported++;
    } catch (err) {
      const msg = `Row ${rowNum}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
    }
  }

  return stats;
}

// ─── Import Income ───────────────────────────────────────────────────────────

async function importIncome(filePath: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const stats = { imported: 0, skipped: 0, errors: [] as string[] };

  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ File not found: ${filePath} — skipping income import.`);
    return stats;
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  console.log(`  📄 Reading sheet: "${sheetName}" from ${path.basename(filePath)}`);

  const sheet = workbook.Sheets[sheetName];
  // Use raw array rows since this file has a two-bank ledger layout, not standard headers
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

  // The file layout (0-indexed columns):
  // Left block  (Sampath Bank): col0=Date, col1=ClientName, col2=PaymentType, col3=Amount
  // Right block (People's Bank): col6=Date, col7=ClientName, col8=PaymentType, col9=Amount
  // Rows 0-2 are headers, data starts at row 3 (0-indexed)

  const dataRows = rawRows.slice(3); // skip header rows

  interface IncomeEntry { date: Date; clientName: string; paymentType: string; amount: number; bank: string; idx: number; }
  const entries: IncomeEntry[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    // Left block: Sampath Bank
    const ldRaw = row[0];
    const lClient = normaliseStr(row[1]);
    const lType = normaliseStr(row[2]);
    const lAmt = row[3];
    if (lClient && lAmt) {
      entries.push({ date: toDateSafe(ldRaw), clientName: lClient, paymentType: lType, amount: toIntCents(lAmt), bank: 'Sampath Bank', idx: i });
    }

    // Right block: People's Bank
    const rdRaw = row[6];
    const rClient = normaliseStr(row[7]);
    const rType = normaliseStr(row[8]);
    const rAmt = row[9];
    if (rClient && rAmt) {
      entries.push({ date: toDateSafe(rdRaw), clientName: rClient, paymentType: rType, amount: toIntCents(rAmt), bank: "People's Bank", idx: i });
    }
  }

  console.log(`  📊 Parsed ${entries.length} income entries across 2 banks.`);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const importId = `LEGACY-INC-${entry.bank.replace(/[^a-zA-Z]/g, '')}-${entry.clientName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${entry.amount}-${i.toString().padStart(4, '0')}`;

      const existing = await prisma.historicalIncome.findUnique({
        where: { importId },
        select: { id: true },
      });

      if (existing) {
        stats.skipped++;
        continue;
      }

      await prisma.historicalIncome.create({
        data: {
          importId,
          date: entry.date,
          bookingRef: null,
          clientName: entry.clientName,
          description: `${entry.paymentType || 'Payment'} — ${entry.bank}`,
          amount: entry.amount,
          paymentType: entry.paymentType || null,
          receivedVia: entry.bank,
          importedFrom: path.basename(filePath),
        },
      });

      stats.imported++;
    } catch (err) {
      const msg = `Entry ${i}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
    }
  }

  return stats;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const legacyDir = path.join(projectRoot, 'legacy-data');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║      Thambaravila Flora ERP — Legacy Data Importer       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`📁 Source directory: ${legacyDir}\n`);

  // ── 1. Expenses ──────────────────────────────────────────────────────────
  console.log('━━━ [1/2] Expense Register Import ━━━');
  const expensePath = path.join(legacyDir, 'TF - Expense Tracker.xlsx');
  const expenseStats = await importExpenses(expensePath);

  // ── 2. Income ────────────────────────────────────────────────────────────
  console.log('\n━━━ [2/2] Income Records Import ━━━');
  const incomePath = path.join(legacyDir, 'Income.xlsx');
  const incomeStats = await importIncome(incomePath);

  // ── Summary Table ────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                     Import Summary                       ║');
  console.log('╠═══════════════════════════╦════════════╦════════════╦════╣');
  console.log('║ Source                    ║  Imported  ║  Skipped   ║ Err║');
  console.log('╠═══════════════════════════╬════════════╬════════════╬════╣');

  const fmtRow = (label: string, stats: { imported: number; skipped: number; errors: string[] }) => {
    const l = label.padEnd(25);
    const imp = String(stats.imported).padStart(10);
    const skp = String(stats.skipped).padStart(10);
    const err = String(stats.errors.length).padStart(4);
    return `║ ${l} ║${imp} ║${skp} ║${err}║`;
  };

  console.log(fmtRow('Expense Tracker', expenseStats));
  console.log(fmtRow('Income Records', incomeStats));
  console.log('╚═══════════════════════════╩════════════╩════════════╩════╝');

  const totalImported = expenseStats.imported + incomeStats.imported;
  const totalSkipped = expenseStats.skipped + incomeStats.skipped;
  const totalErrors = expenseStats.errors.length + incomeStats.errors.length;

  console.log(`\n✅ Total imported: ${totalImported}  |  ⏭ Skipped: ${totalSkipped}  |  ❌ Errors: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log('\n⚠ Error details:');
    [...expenseStats.errors, ...incomeStats.errors].forEach((e, i) => {
      console.log(`  ${i + 1}. ${e}`);
    });
  }

  console.log('\n🎉 Import complete. Run again to verify idempotency (all rows should show as Skipped).\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Fatal error during import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

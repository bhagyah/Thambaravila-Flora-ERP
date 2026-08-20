import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

// Styles helpers
const headerFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' }, // slate-800
};
const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const currencyFmt = '#,##0.00';

function lkr(cents: number): number {
  return cents / 100;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleName = (session.user as any)?.role?.name ?? '';
  if (roleName !== 'Owner' && roleName !== 'Accountant') {
    return NextResponse.json({ error: 'Forbidden — Accountant or Owner role required.' }, { status: 403 });
  }

  try {
    // ── Fetch data ───────────────────────────────────────────────────────────
    const [expenses, historicalIncomes, paymentStages] = await Promise.all([
      prisma.expense.findMany({ orderBy: { date: 'desc' } }),
      prisma.historicalIncome.findMany({ orderBy: { date: 'desc' } }),
      prisma.paymentStage.findMany({
        where: { status: 'PAID' },
        include: { booking: { include: { customer: true } } },
        orderBy: { paidDate: 'desc' },
      }),
    ]);

    // ── Build workbook ───────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Thambaravila Flora ERP';
    workbook.created = new Date();

    // ────────────────────────────────────────────────────────────────────────
    // SHEET 1: Expense Register
    // ────────────────────────────────────────────────────────────────────────
    const expSheet = workbook.addWorksheet('Expense Register');
    expSheet.properties.tabColor = { argb: 'FFE11D48' }; // rose

    expSheet.columns = [
      { header: 'Expense ID', key: 'expenseId', width: 24 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Client', key: 'clientName', width: 24 },
      { header: 'Booking Ref', key: 'bookingId', width: 14 },
      { header: 'Supplier', key: 'supplierName', width: 24 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Payment Method', key: 'paymentMethod', width: 18 },
      { header: 'Amount (LKR)', key: 'amount', width: 16, style: { numFmt: currencyFmt } },
      { header: 'Tax/VAT (LKR)', key: 'taxVat', width: 16, style: { numFmt: currencyFmt } },
      { header: 'Total (LKR)', key: 'totalAmount', width: 16, style: { numFmt: currencyFmt } },
      { header: 'Paid By', key: 'paidByName', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 16 },
      { header: 'Approval Status', key: 'approvalStatus', width: 16 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Source', key: 'importedFrom', width: 28 },
    ];

    // Style header row
    const expHeaderRow = expSheet.getRow(1);
    expHeaderRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } };
    });
    expHeaderRow.height = 20;

    // Add data rows
    expenses.forEach((exp, i) => {
      const row = expSheet.addRow({
        expenseId: exp.expenseId ?? exp.id,
        date: new Date(exp.date).toLocaleDateString('en-GB'),
        category: exp.category,
        description: exp.description,
        clientName: exp.clientName ?? '',
        bookingId: exp.bookingId ?? '',
        supplierName: exp.supplierName ?? '',
        department: (exp.department ?? '').replace(/_/g, ' '),
        paymentMethod: (exp.paymentMethod ?? '').replace(/_/g, ' '),
        amount: lkr(exp.amount),
        taxVat: lkr(exp.taxVat),
        totalAmount: lkr(exp.totalAmount || exp.amount),
        paidByName: exp.paidByName ?? '',
        paymentStatus: (exp.paymentStatus ?? '').replace(/_/g, ' '),
        approvalStatus: (exp.approvalStatus ?? '').replace(/_/g, ' '),
        notes: exp.notes ?? '',
        importedFrom: exp.importedFrom ?? 'Live System',
      });
      // Zebra striping
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        });
      }
    });

    // Total row
    expSheet.addRow({});
    const expTotalRow = expSheet.addRow({
      description: 'TOTAL',
      amount: lkr(expenses.reduce((s, e) => s + e.amount, 0)),
      taxVat: lkr(expenses.reduce((s, e) => s + e.taxVat, 0)),
      totalAmount: lkr(expenses.reduce((s, e) => s + (e.totalAmount || e.amount), 0)),
    });
    expTotalRow.font = { bold: true, color: { argb: 'FFFBBF24' } };
    expTotalRow.getCell('description').alignment = { horizontal: 'right' };

    // ────────────────────────────────────────────────────────────────────────
    // SHEET 2: Income Records (Historical + Live)
    // ────────────────────────────────────────────────────────────────────────
    const incSheet = workbook.addWorksheet('Income Records');
    incSheet.properties.tabColor = { argb: 'FF10B981' }; // emerald

    incSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Booking Ref', key: 'bookingRef', width: 16 },
      { header: 'Client Name', key: 'clientName', width: 28 },
      { header: 'Description', key: 'description', width: 38 },
      { header: 'Payment Type', key: 'paymentType', width: 18 },
      { header: 'Received Via', key: 'receivedVia', width: 18 },
      { header: 'Amount (LKR)', key: 'amount', width: 16, style: { numFmt: currencyFmt } },
      { header: 'Source', key: 'source', width: 22 },
    ];

    const incHeaderRow = incSheet.getRow(1);
    incHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    incHeaderRow.height = 20;

    // Section A: Historical imports
    if (historicalIncomes.length > 0) {
      const sectionRow = incSheet.addRow({ date: '── Historical Import ──' });
      sectionRow.font = { italic: true, color: { argb: 'FF94A3B8' }, bold: true };
      historicalIncomes.forEach((inc, i) => {
        const row = incSheet.addRow({
          date: new Date(inc.date).toLocaleDateString('en-GB'),
          bookingRef: inc.bookingRef ?? '',
          clientName: inc.clientName ?? '',
          description: inc.description ?? '',
          paymentType: inc.paymentType ?? '',
          receivedVia: inc.receivedVia ?? '',
          amount: lkr(inc.amount),
          source: inc.importedFrom ?? 'Legacy Import',
        });
        if (i % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
          });
        }
      });
    }

    // Section B: Live confirmed payments
    if (paymentStages.length > 0) {
      incSheet.addRow({});
      const sectionRow = incSheet.addRow({ date: '── Live Confirmed Payments ──' });
      sectionRow.font = { italic: true, color: { argb: 'FF6EE7B7' }, bold: true };
      paymentStages.forEach((ps, i) => {
        const row = incSheet.addRow({
          date: ps.paidDate ? new Date(ps.paidDate).toLocaleDateString('en-GB') : '',
          bookingRef: ps.bookingId,
          clientName: ps.booking?.customer?.name ?? '',
          description: `${ps.stageType} payment`,
          paymentType: ps.stageType,
          receivedVia: '',
          amount: lkr(ps.amountPaid),
          source: 'Live System',
        });
        if (i % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
          });
        }
      });
    }

    // Income totals
    incSheet.addRow({});
    const liveIncomeTotal = paymentStages.reduce((s, ps) => s + ps.amountPaid, 0);
    const historicalTotal = historicalIncomes.reduce((s, h) => s + h.amount, 0);
    const incTotalRow = incSheet.addRow({
      date: 'TOTAL INCOME',
      amount: lkr(liveIncomeTotal + historicalTotal),
    });
    incTotalRow.font = { bold: true, color: { argb: 'FF34D399' } };

    // ────────────────────────────────────────────────────────────────────────
    // SHEET 3: P&L Summary
    // ────────────────────────────────────────────────────────────────────────
    const plSheet = workbook.addWorksheet('P&L Summary');
    plSheet.properties.tabColor = { argb: 'FF6366F1' }; // indigo

    plSheet.getColumn(1).width = 32;
    plSheet.getColumn(2).width = 20;
    plSheet.getColumn(2).numFmt = currencyFmt;

    const addPlRow = (label: string, value: number | string, bold = false, color = 'FFFFFFFF') => {
      const row = plSheet.addRow([label, typeof value === 'number' ? value : '']);
      if (typeof value === 'string') row.getCell(2).value = value;
      row.font = { bold, color: { argb: color }, size: bold ? 11 : 10 };
      return row;
    };

    // Title
    const titleRow = plSheet.addRow(['Thambaravila Flora — Profit & Loss Summary']);
    titleRow.font = { bold: true, size: 14, color: { argb: 'FF818CF8' } };
    plSheet.addRow(['Generated: ' + new Date().toLocaleString('en-GB')]);
    plSheet.addRow([]);

    addPlRow('REVENUE', '', true, 'FF34D399');
    const liveRevTotal = liveIncomeTotal;
    addPlRow('  Live Confirmed Payments', lkr(liveRevTotal), false, 'FF86EFAC');
    addPlRow('  Historical Income (Imported)', lkr(historicalTotal), false, 'FF86EFAC');
    const totalRevRow = addPlRow('Total Revenue', lkr(liveRevTotal + historicalTotal), true, 'FF34D399');
    totalRevRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    totalRevRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };

    plSheet.addRow([]);

    addPlRow('EXPENSES', '', true, 'FFFB7185');
    // Group by category
    const categoryMap: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryMap[e.category] = (categoryMap[e.category] ?? 0) + e.amount;
    });
    Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, total]) => {
        addPlRow(`  ${cat}`, lkr(total), false, 'FFFCA5A5');
      });

    const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || e.amount), 0);
    const totalExpRow = addPlRow('Total Expenses', lkr(totalExpenses), true, 'FFFB7185');
    totalExpRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C0519' } };
    totalExpRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C0519' } };

    plSheet.addRow([]);

    const netProfit = (liveRevTotal + historicalTotal) - totalExpenses;
    const netRow = addPlRow('NET PROFIT / (LOSS)', lkr(netProfit), true, netProfit >= 0 ? 'FF34D399' : 'FFFB7185');
    netRow.height = 22;
    netRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netProfit >= 0 ? 'FF064E3B' : 'FF4C0519' } };
    netRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netProfit >= 0 ? 'FF064E3B' : 'FF4C0519' } };

    const margin = liveRevTotal + historicalTotal > 0
      ? ((netProfit / (liveRevTotal + historicalTotal)) * 100).toFixed(1)
      : '0.0';
    addPlRow('Profit Margin', `${margin}%`, false, 'FF818CF8');

    // ── Stream response ──────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const now = new Date();
    const dateSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="TF-Flora-Financial-Report-${dateSuffix}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}

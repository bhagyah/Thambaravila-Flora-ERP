import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

// Styling constants matching the provided Excel design
const NAVY_BANNER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F2537' }, // Dark Navy
};

const NAVY_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E79' }, // Steel Navy
};

const LIGHT_BLUE_SUBHEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFBDD7EE' }, // Soft Blue
};

const WHITE_BOLD_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 10,
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 13,
};

const REGULAR_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 10,
  color: { argb: 'FF000000' },
};

const BOLD_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  bold: true,
  size: 10,
  color: { argb: 'FF000000' },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
};

function valOrDash(val: any): string | number {
  if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') {
    return '-';
  }
  return val;
}

function formatDateOrDash(dateVal: any): string {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

function formatDateLongOrDash(dateVal: any): string {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '-';
  }
}

function centsToLkr(cents: number | null | undefined): number | string {
  if (cents === null || cents === undefined || cents === 0) return '-';
  return Math.round(cents / 100);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleName = (session.user as any)?.role?.name ?? '';
  const allowedRoles = ['Sales Manager', 'Owner', 'IT/Admin', 'Wedding Coordinator', 'Accountant'];
  if (!allowedRoles.includes(roleName)) {
    return NextResponse.json({ error: 'Forbidden — Sales role access required.' }, { status: 403 });
  }

  try {
    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Fetch bookings with all related entities
    let bookings: any[] = [];
    try {
      bookings = await prisma.booking.findMany({
        include: {
          customer: true,
          lead: true,
          ceremonyVenue: true,
          receptionVenue: true,
          photographerVendor: true,
          decoratorVendor: true,
          catererVendor: true,
          salesExec: { select: { id: true, name: true, email: true, phone: true } },
          paymentStages: { orderBy: { dueDate: 'asc' } },
          events: { orderBy: { date: 'asc' } },
        },
        orderBy: { weddingDate: 'asc' },
      });
    } catch (e: any) {
      console.warn('[Export] Error with full relation fetch, trying fallback:', e?.message);
      bookings = await prisma.booking.findMany({
        include: {
          customer: true,
          lead: true,
          ceremonyVenue: true,
          receptionVenue: true,
          photographerVendor: true,
          decoratorVendor: true,
          catererVendor: true,
          salesExec: { select: { id: true, name: true, email: true } },
          paymentStages: { orderBy: { dueDate: 'asc' } },
        },
        orderBy: { weddingDate: 'asc' },
      });
    }

    // Filter next 30 days bookings (or if total next 30-day count is less than all active, include upcoming pipeline)
    const next30DaysBookings = bookings.filter((b) => {
      const wDate = new Date(b.weddingDate);
      return wDate >= new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) && wDate <= thirtyDaysAhead;
    });

    // Use next 30 days if available, otherwise include upcoming bookings sorted by wedding date
    const displayBookings = next30DaysBookings.length > 0 ? next30DaysBookings : bookings;

    // KPI Metrics calculation
    const totalWeddingsCount = displayBookings.length;
    const totalPackageValue = displayBookings.reduce((sum, b) => sum + (b.totalQuoteAmount || 0), 0);
    const totalAdvanceReceived = displayBookings.reduce((sum, b) => {
      const paidStages = (b.paymentStages || []).filter((p: any) => p.status === 'PAID');
      const paidAmount = paidStages.reduce((pSum: number, p: any) => pSum + (p.amountPaid || p.amountDue || 0), 0);
      return sum + (paidAmount || b.depositAmount || 0);
    }, 0);
    const totalBalancePending = displayBookings.reduce((sum, b) => sum + (b.balanceDueAmount || 0), 0);

    const pendingOverdueCount = displayBookings.filter((b) => {
      const pStatus = b.paymentStatus || '';
      return pStatus === 'OVERDUE' || pStatus === 'DEPOSIT_DUE' || pStatus === 'PARTIAL_PAYMENT' || b.balanceDueAmount > 0;
    }).length;

    const jobSheetsNotCompletedCount = displayBookings.filter((b) => {
      return !b.jobSheetAttachmentUrl || b.jobSheetAttachmentUrl === '';
    }).length;

    // Build Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Thambaravila Flora ERP';
    workbook.created = new Date();

    // =========================================================================
    // SHEET 1: Dashboard
    // =========================================================================
    const dashSheet = workbook.addWorksheet('Dashboard', {
      views: [{ showGridLines: true }],
    });
    dashSheet.properties.tabColor = { argb: 'FF1F4E79' };

    // Set Column Widths for Dashboard
    dashSheet.columns = [
      { key: 'A', width: 28 },
      { key: 'B', width: 18 },
      { key: 'C', width: 4 },
      { key: 'D', width: 22 },
      { key: 'E', width: 18 },
      { key: 'F', width: 14 },
      { key: 'G', width: 16 },
      { key: 'H', width: 24 },
    ];

    // Banner: A1:H2
    dashSheet.mergeCells('A1:H2');
    const bannerA1 = dashSheet.getCell('A1');
    bannerA1.value = 'NEXT 30 DAYS WEDDING DASHBOARD';
    bannerA1.fill = NAVY_BANNER_FILL;
    bannerA1.font = TITLE_FONT;
    bannerA1.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Headers
    // Left Table Header: A3:B3
    const cellA3 = dashSheet.getCell('A3');
    cellA3.value = 'KPI';
    cellA3.fill = NAVY_HEADER_FILL;
    cellA3.font = WHITE_BOLD_FONT;
    cellA3.alignment = { vertical: 'middle', horizontal: 'center' };

    const cellB3 = dashSheet.getCell('B3');
    cellB3.value = 'Value';
    cellB3.fill = NAVY_HEADER_FILL;
    cellB3.font = WHITE_BOLD_FONT;
    cellB3.alignment = { vertical: 'middle', horizontal: 'center' };

    // Right Table Header: D3:H3 Merged
    dashSheet.mergeCells('D3:H3');
    const cellD3 = dashSheet.getCell('D3');
    cellD3.value = 'Weekly Meeting Review Checklist';
    cellD3.fill = NAVY_HEADER_FILL;
    cellD3.font = WHITE_BOLD_FONT;
    cellD3.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 4: Right Table Subheaders
    const subHeaders = [
      { col: 'D', label: 'Check Item' },
      { col: 'E', label: 'Owner' },
      { col: 'F', label: 'Due' },
      { col: 'G', label: 'Status' },
      { col: 'H', label: 'Notes' },
    ];
    subHeaders.forEach(({ col, label }) => {
      const cell = dashSheet.getCell(`${col}4`);
      cell.value = label;
      cell.fill = LIGHT_BLUE_SUBHEADER_FILL;
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F2537' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
    });

    // Left Table Data Rows (Rows 4 to 9)
    const kpiRows = [
      { kpi: 'Total Weddings / Bookings', val: totalWeddingsCount, numFmt: '#,##0' },
      { kpi: 'Total Package Value', val: Math.round(totalPackageValue / 100), numFmt: '#,##0' },
      { kpi: 'Total Advance Received', val: Math.round(totalAdvanceReceived / 100), numFmt: '#,##0' },
      { kpi: 'Total Balance Pending', val: Math.round(totalBalancePending / 100), numFmt: '#,##0' },
      { kpi: 'Pending / Overdue Payments', val: pendingOverdueCount, numFmt: '#,##0' },
      { kpi: 'Job Sheets Not Completed', val: jobSheetsNotCompletedCount, numFmt: '#,##0' },
    ];

    kpiRows.forEach((row, idx) => {
      const rNum = 4 + idx;
      const cellA = dashSheet.getCell(`A${rNum}`);
      const cellB = dashSheet.getCell(`B${rNum}`);

      cellA.value = row.kpi;
      cellA.font = BOLD_FONT;
      cellA.border = THIN_BORDER;
      cellA.alignment = { vertical: 'middle', horizontal: 'left' };

      cellB.value = row.val;
      cellB.font = BOLD_FONT;
      cellB.numFmt = row.numFmt;
      cellB.border = THIN_BORDER;
      cellB.alignment = { vertical: 'middle', horizontal: 'right' };
    });

    // Right Table Checklist Items (Rows 5 to 11)
    const checklistItems = [
      'All next 30-day',
      'Pending payments',
      'Final quotations',
      'Final meetings',
      'Job sheets completed',
      'Pre-wedding',
      'High-risk weddings',
    ];

    checklistItems.forEach((item, idx) => {
      const rNum = 5 + idx;
      const cellD = dashSheet.getCell(`D${rNum}`);
      cellD.value = item;
      cellD.font = REGULAR_FONT;
      cellD.border = THIN_BORDER;
      cellD.alignment = { vertical: 'middle', horizontal: 'left' };

      // Columns E, F, G, H with '-'
      ['E', 'F', 'G', 'H'].forEach((col) => {
        const cell = dashSheet.getCell(`${col}${rNum}`);
        cell.value = '-';
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    });

    // =========================================================================
    // SHEET 2: Next_30_Days_Tracker
    // =========================================================================
    const trackerSheet = workbook.addWorksheet('Next_30_Days_Tracker', {
      views: [{ showGridLines: true, freezePane: { ySplit: 4 } }],
    });
    trackerSheet.properties.tabColor = { argb: 'FF107C41' }; // Green

    // Set Column Widths
    trackerSheet.columns = [
      { key: 'weddingDate', width: 14 },
      { key: 'days', width: 8 },
      { key: 'clientName', width: 22 },
      { key: 'contactNo', width: 16 },
      { key: 'venue', width: 24 },
      { key: 'budgetMenu', width: 16 },
      { key: 'meeting', width: 14 },
      { key: 'event', width: 14 },
      { key: 'booking', width: 14 },
      { key: 'quotation', width: 14 },
      { key: 'package', width: 16 },
      { key: 'advance', width: 16 },
      { key: 'balance', width: 16 },
      { key: 'payment', width: 14 },
      { key: 'paymentStatus', width: 16 },
      { key: 'finalQuotation', width: 16 },
      { key: 'finalQuotationDate', width: 18 },
      { key: 'finalMeetingDate', width: 18 },
      { key: 'meetingLevel', width: 14 },
      { key: 'meetingStatus', width: 14 },
      { key: 'jobSheetDue', width: 14 },
      { key: 'jobSheetStatus', width: 16 },
      { key: 'preWedding', width: 16 },
      { key: 'supplier', width: 20 },
      { key: 'team', width: 16 },
      { key: 'risk', width: 10 },
      { key: 'remarks', width: 28 },
    ];

    // Banner: A1:AA2
    trackerSheet.mergeCells('A1:AA2');
    const trBanner = trackerSheet.getCell('A1');
    trBanner.value = 'NEXT 30 DAYS WEDDING BOOKING, PAYMENT & JOB SHEET TRACKER';
    trBanner.fill = NAVY_BANNER_FILL;
    trBanner.font = TITLE_FONT;
    trBanner.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Spacer
    trackerSheet.getRow(3).height = 12;

    // Row 4: Column Headers
    const trackerHeaders = [
      'Wedding Date',
      'Days',
      'Client Name',
      'Contact No.',
      'Venue',
      'Budget menu',
      'meeting',
      'Event',
      'Booking',
      'quotation',
      'Package',
      'Advance',
      'Balance',
      'Payment',
      'Payment Status',
      'Final Quotation',
      'Final Quotation Date',
      'Final Meeting Date',
      'Meeting Level',
      'Meeting Status',
      'Job Sheet Due',
      'Job Sheet Status',
      'Pre-Wedding',
      'Supplier / Vendor',
      'Team',
      'Risk',
      'Remarks / Next Action',
    ];

    const trHeaderRow = trackerSheet.getRow(4);
    trHeaderRow.height = 28;
    trackerHeaders.forEach((text, i) => {
      const cell = trHeaderRow.getCell(i + 1);
      cell.value = text;
      cell.fill = NAVY_HEADER_FILL;
      cell.font = WHITE_BOLD_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = THIN_BORDER;
    });

    // Populate Data Rows
    displayBookings.forEach((b) => {
      const wDate = new Date(b.weddingDate);
      const daysLeft = Math.max(0, Math.ceil((wDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // Vendors
      const vendorNames = [
        b.photographerVendor?.name,
        b.decoratorVendor?.name,
        b.catererVendor?.name,
      ]
        .filter(Boolean)
        .join(', ');

      // Payment Status
      let pStatusDisplay = 'Not Due Yet';
      if (b.paymentStatus === 'PAID_IN_FULL') pStatusDisplay = 'Fully Paid';
      else if (b.paymentStatus === 'DEPOSIT_PAID') pStatusDisplay = 'Advance Paid';
      else if (b.paymentStatus === 'OVERDUE') pStatusDisplay = 'Overdue';
      else if (b.paymentStatus === 'PARTIAL_PAYMENT' || (b.balanceDueAmount && b.balanceDueAmount > 0)) {
        pStatusDisplay = 'Balance Pending';
      }

      // Quotation Status
      let qStatus = 'Final Approved';
      if (b.quoteOutcomeReason && b.quoteOutcomeReason.toLowerCase().includes('revision')) {
        qStatus = 'Revision Required';
      } else if (!b.quotationAttachmentUrl && !b.quotationAttachmentName) {
        qStatus = 'Final Pending';
      }

      // Job Sheet Status
      let jsStatus = 'Completed';
      if (!b.jobSheetAttachmentUrl) {
        jsStatus = daysLeft <= 14 ? 'In Progress' : 'Not Started';
      }

      // Risk Level
      let riskLevel = 'Low';
      if (daysLeft <= 10 && (!b.jobSheetAttachmentUrl || b.paymentStatus === 'OVERDUE' || b.balanceDueAmount > 20000000)) {
        riskLevel = 'High';
      } else if (daysLeft <= 20 && (b.paymentStatus === 'OVERDUE' || !b.jobSheetAttachmentUrl)) {
        riskLevel = 'Medium';
      }

      // Venue name
      const venueName = b.ceremonyVenue?.name || b.receptionVenue?.name || b.lead?.tentativeVenue || '-';

      // Event Type
      const eventType = b.serviceScope
        ? b.serviceScope.toLowerCase().replace(/_/g, ' ')
        : 'wedding';

      // Booking Status
      const bookingStatus = b.bookingStatus
        ? b.bookingStatus.charAt(0) + b.bookingStatus.slice(1).toLowerCase().replace(/_/g, ' ')
        : 'Confirmed';

      const rowValues = [
        formatDateOrDash(b.weddingDate),
        valOrDash(daysLeft),
        valOrDash(b.customer?.name),
        valOrDash(b.customer?.phone),
        venueName,
        valOrDash(b.lead?.budgetRange || b.notes),
        valOrDash(b.events?.[0]?.title || 'Final'),
        eventType,
        bookingStatus,
        valOrDash(b.quotationAttachmentName || b.id),
        centsToLkr(b.totalQuoteAmount),
        centsToLkr(b.depositAmount),
        centsToLkr(b.balanceDueAmount),
        formatDateOrDash(b.depositPaidDate),
        pStatusDisplay,
        qStatus,
        formatDateOrDash(b.updatedAt),
        formatDateOrDash(b.events?.[0]?.date || b.weddingDate),
        'Final',
        'Scheduled',
        formatDateOrDash(new Date(wDate.getTime() - 7 * 24 * 60 * 60 * 1000)),
        jsStatus,
        valOrDash(b.events?.[1]?.title || '-'),
        valOrDash(vendorNames),
        valOrDash(b.salesExec?.name || 'Chinthaka / Madhuni'),
        riskLevel,
        valOrDash(b.notes || (b.balanceDueAmount > 0 ? 'Follow up balance payment' : 'Coordinate logistics')),
      ];

      const row = trackerSheet.addRow(rowValues);
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;

        // Number columns (11, 12, 13)
        if ([11, 12, 13].includes(colNumber) && typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([1, 2, 4, 7, 8, 9, 10, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        // Highlight Risk
        if (colNumber === 26) {
          if (cell.value === 'High') {
            cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFDC2626' } }; // Red
          } else if (cell.value === 'Medium') {
            cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFD97706' } }; // Amber
          } else if (cell.value === 'Low') {
            cell.font = { name: 'Calibri', color: { argb: 'FF16A34A' } }; // Green
          }
        }

        // Highlight Payment Status
        if (colNumber === 15) {
          if (cell.value === 'Overdue') {
            cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFDC2626' } };
          } else if (cell.value === 'Fully Paid') {
            cell.font = { name: 'Calibri', bold: true, color: { argb: 'FF16A34A' } };
          }
        }
      });
    });

    // If no bookings, add placeholder row with dashes
    if (displayBookings.length === 0) {
      const emptyRow = trackerSheet.addRow(new Array(27).fill('-'));
      emptyRow.height = 20;
      emptyRow.eachCell((cell) => {
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }

    // =========================================================================
    // SHEET 3: Lists
    // =========================================================================
    const listsSheet = workbook.addWorksheet('Lists', {
      views: [{ showGridLines: true }],
    });
    listsSheet.properties.tabColor = { argb: 'FF70AD47' };

    listsSheet.columns = [
      { key: 'eventStatus', width: 18 },
      { key: 'paymentStatus', width: 20 },
      { key: 'quotationStatus', width: 20 },
      { key: 'meetingLevel', width: 16 },
      { key: 'meetingStatus', width: 18 },
      { key: 'jobSheetStatus', width: 20 },
      { key: 'riskLevel', width: 14 },
      { key: 'priority', width: 14 },
      { key: 'yesNo', width: 12 },
    ];

    const listsHeaders = [
      'Event Status',
      'Payment Status',
      'Quotation Status',
      'Meeting Level',
      'Meeting Status',
      'Job Sheet Status',
      'Risk Level',
      'Priority',
      'Yes/No',
    ];

    const listsHeaderRow = listsSheet.getRow(1);
    listsHeaderRow.height = 24;
    listsHeaders.forEach((text, i) => {
      const cell = listsHeaderRow.getCell(i + 1);
      cell.value = text;
      cell.fill = NAVY_HEADER_FILL;
      cell.font = WHITE_BOLD_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
    });

    const listColumnsData: string[][] = [
      ['Confirmed', 'Tentative', 'Cancelled'],
      ['Fully Paid', 'Advance Paid', 'Balance Pending', 'Overdue', 'Not Due Yet'],
      ['Final Approved', 'Final Pending', 'Revision Required', 'Not Sent'],
      ['Initial', 'Interim', 'Final'],
      ['Scheduled', 'Completed', 'Not Scheduled', 'Rescheduled', 'Cancelled'],
      ['Completed', 'In Progress', 'Not Started', 'Blocked / Issue', 'Pending Approval'],
      ['Low', 'Medium', 'High'],
      ['High', 'Medium', 'Low'],
      ['Yes', 'No'],
    ];

    const maxListRows = Math.max(...listColumnsData.map((col) => col.length));
    for (let r = 0; r < maxListRows; r++) {
      const rowValues = listColumnsData.map((col) => col[r] || '');
      const row = listsSheet.addRow(rowValues);
      row.height = 18;
      row.eachCell((cell) => {
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    }

    // =========================================================================
    // SHEET 4: Final_Meeting_Register
    // =========================================================================
    const meetingSheet = workbook.addWorksheet('Final_Meeting_Register', {
      views: [{ showGridLines: true }],
    });
    meetingSheet.properties.tabColor = { argb: 'FF41719C' };

    meetingSheet.columns = [
      { key: 'date', width: 14 },
      { key: 'time', width: 12 },
      { key: 'meetingTime', width: 18 },
      { key: 'clientName', width: 22 },
      { key: 'weddingDate', width: 14 },
      { key: 'meeting', width: 14 },
      { key: 'meetingType', width: 14 },
      { key: 'responsible', width: 22 },
      { key: 'status', width: 14 },
      { key: 'keyDecisions', width: 28 },
      { key: 'nextAction', width: 24 },
      { key: 'remarks', width: 24 },
    ];

    // Banner: A1:L2
    meetingSheet.mergeCells('A1:L2');
    const meetingBanner = meetingSheet.getCell('A1');
    meetingBanner.value = 'FINAL / CLIENT MEETING REGISTER';
    meetingBanner.fill = NAVY_BANNER_FILL;
    meetingBanner.font = TITLE_FONT;
    meetingBanner.alignment = { vertical: 'middle', horizontal: 'center' };

    meetingSheet.getRow(3).height = 12;

    const meetingHeaders = [
      'Date',
      'Time',
      'Meeting Time /',
      'Client Name',
      'Wedding Date',
      'Meeting',
      'Meeting Type',
      'Responsible',
      'Status',
      'Key Decisions',
      'Next Action',
      'Remarks',
    ];

    const meetingHeaderRow = meetingSheet.getRow(4);
    meetingHeaderRow.height = 24;
    meetingHeaders.forEach((text, i) => {
      const cell = meetingHeaderRow.getCell(i + 1);
      cell.value = text;
      cell.fill = NAVY_HEADER_FILL;
      cell.font = WHITE_BOLD_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
    });

    // Populate data from next 30 days bookings
    displayBookings.forEach((b) => {
      const wDate = new Date(b.weddingDate);
      const meetingDate = new Date(wDate.getTime() - 14 * 24 * 60 * 60 * 1000);

      const mRow = [
        formatDateOrDash(meetingDate),
        '10:00 AM',
        '-',
        valOrDash(b.customer?.name),
        formatDateOrDash(b.weddingDate),
        'Final',
        'final',
        valOrDash(b.salesExec?.name || 'chinthaka / madhuni'),
        'Scheduled',
        '-',
        '-',
        valOrDash(b.notes),
      ];

      const row = meetingSheet.addRow(mRow);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;
        if ([1, 2, 5, 6, 7, 9].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    if (displayBookings.length === 0) {
      const emptyRow = meetingSheet.addRow(new Array(12).fill('-'));
      emptyRow.height = 20;
      emptyRow.eachCell((cell) => {
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }

    // =========================================================================
    // SHEET 5: Weekly_Action_Follow-up
    // =========================================================================
    const followUpSheet = workbook.addWorksheet('Weekly_Action_Follow-up', {
      views: [{ showGridLines: true }],
    });
    followUpSheet.properties.tabColor = { argb: 'FFED7D31' }; // Orange

    followUpSheet.columns = [
      { key: 'meetingDate', width: 14 },
      { key: 'clientName', width: 22 },
      { key: 'weddingDate', width: 14 },
      { key: 'issueArea', width: 20 },
      { key: 'actionRequired', width: 30 },
      { key: 'responsible', width: 20 },
      { key: 'deadline', width: 14 },
      { key: 'priority', width: 12 },
      { key: 'status', width: 14 },
      { key: 'notes', width: 28 },
    ];

    // Banner: A1:J2
    followUpSheet.mergeCells('A1:J2');
    const fuBanner = followUpSheet.getCell('A1');
    fuBanner.value = 'WEEKLY ACTION FOLLOW-UP - NEXT 30 DAYS WEDDINGS';
    fuBanner.fill = NAVY_BANNER_FILL;
    fuBanner.font = TITLE_FONT;
    fuBanner.alignment = { vertical: 'middle', horizontal: 'center' };

    const fuHeaders = [
      'Meeting Date',
      'Client Name',
      'Wedding Date',
      'Issue Area',
      'Action Required',
      'Responsible',
      'Deadline',
      'Priority',
      'Status',
      'Notes',
    ];

    const fuHeaderRow = followUpSheet.getRow(3);
    fuHeaderRow.height = 24;
    fuHeaders.forEach((text, i) => {
      const cell = fuHeaderRow.getCell(i + 1);
      cell.value = text;
      cell.fill = NAVY_HEADER_FILL;
      cell.font = WHITE_BOLD_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
    });

    // Populate follow-up rows from bookings that have actionable tasks
    displayBookings.forEach((b) => {
      const wDate = new Date(b.weddingDate);
      const daysLeft = Math.max(0, Math.ceil((wDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      let issueArea = 'Logistics & Confirmation';
      let actionReq = 'Finalize stem checklist & floor plan';
      let priority = 'Medium';
      let status = 'In Progress';

      if (b.balanceDueAmount > 0 && daysLeft <= 14) {
        issueArea = 'Payment Balance';
        actionReq = 'Collect balance payment before setup';
        priority = 'High';
      } else if (!b.jobSheetAttachmentUrl && daysLeft <= 10) {
        issueArea = 'Job Sheet';
        actionReq = 'Generate and hand over production job sheet';
        priority = 'High';
      } else if (!b.quotationAttachmentUrl) {
        issueArea = 'Quotation';
        actionReq = 'Send approved final quotation to customer';
        priority = 'Medium';
      }

      const fuRow = [
        formatDateOrDash(now),
        valOrDash(b.customer?.name),
        formatDateOrDash(b.weddingDate),
        issueArea,
        actionReq,
        valOrDash(b.salesExec?.name || 'Chinthaka / Madhuni'),
        formatDateOrDash(new Date(wDate.getTime() - 3 * 24 * 60 * 60 * 1000)),
        priority,
        status,
        valOrDash(b.notes),
      ];

      const row = followUpSheet.addRow(fuRow);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;
        if ([1, 3, 7, 8, 9].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    if (displayBookings.length === 0) {
      const emptyRow = followUpSheet.addRow(new Array(10).fill('-'));
      emptyRow.height = 20;
      emptyRow.eachCell((cell) => {
        cell.font = REGULAR_FONT;
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }

    // =========================================================================
    // Generate Buffer and Send Response
    // =========================================================================
    const buffer = await workbook.xlsx.writeBuffer();
    const dateSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="NEXT_30_DAYS_WEDDING_TRACKER_${dateSuffix}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[Export Tracker API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate Excel tracker: ' + error?.message }, { status: 500 });
  }
}

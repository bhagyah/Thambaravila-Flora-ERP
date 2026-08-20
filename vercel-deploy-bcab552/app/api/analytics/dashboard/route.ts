import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { parseLkrToCents } from '@/lib/utils/money';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '1m'; // 1d, 1w, 1m, 1y, custom
  const customStart = searchParams.get('startDate');
  const customEnd = searchParams.get('endDate');

  try {
    const roleName = session.user?.role?.name || 'Owner';

    // 1. Calculate Current Period & Prior Comparison Period Date Windows
    const now = new Date();
    let filterStart: Date;
    let filterEnd: Date = now;

    let prevStart: Date;
    let prevEnd: Date;
    let comparisonLabel = 'vs Previous Month';

    if (range === '1d') {
      filterStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      prevEnd = filterStart;
      comparisonLabel = 'vs Yesterday';
    } else if (range === '1w') {
      filterStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      prevEnd = filterStart;
      comparisonLabel = 'vs Previous Week';
    } else if (range === '1y') {
      filterStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
      prevEnd = filterStart;
      comparisonLabel = 'vs Previous Year';
    } else if (range === 'custom' && customStart && customEnd) {
      filterStart = new Date(customStart);
      filterEnd = new Date(customEnd + 'T23:59:59');
      const durationMs = Math.max(24 * 60 * 60 * 1000, filterEnd.getTime() - filterStart.getTime());
      prevStart = new Date(filterStart.getTime() - durationMs);
      prevEnd = filterStart;
      comparisonLabel = 'vs Prior Period';
    } else {
      filterStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      prevEnd = filterStart;
      comparisonLabel = 'vs Previous Month';
    }

    // 2. Fetch Current Period Leads
    const leads = await prisma.lead.findMany({
      where: { createdAt: { gte: filterStart, lte: filterEnd } },
      include: { customer: true, bookings: true },
      orderBy: { createdAt: 'desc' },
    });

    const directWonBookings = await prisma.booking.findMany({
      where: {
        leadId: null,
        bookingStatus: { in: ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'] },
      },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });

    const wonLeadIds = new Set(
      leads
        .filter((lead) =>
          lead.bookings.some((booking) =>
            ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(booking.bookingStatus)
          )
        )
        .map((lead) => lead.id)
    );
    let totalLeads = leads.length + directWonBookings.length;
    let wonLeads = wonLeadIds.size + directWonBookings.length;
    let conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const prevLeads = await prisma.lead.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      include: { bookings: { select: { id: true } } },
    });

    const prevTotalLeads = prevLeads.length;
    const prevWonLeads = prevLeads.filter((l) => l.stage === 'WON' || l.converted).length;
    let prevConversionRate = prevTotalLeads > 0 ? Math.round((prevWonLeads / prevTotalLeads) * 100) : 0;

    let leadsChangePct = 0;
    if (prevTotalLeads > 0) {
      leadsChangePct = Math.round(((totalLeads - prevTotalLeads) / prevTotalLeads) * 100);
    } else if (totalLeads > 0) {
      leadsChangePct = 100;
    }

    let conversionChangePct = conversionRate - prevConversionRate;

    // Leads by Stage
    const stageCounts: Record<string, number> = {
      NEW_INQUIRY: 0,
      CONTACTED: 0,
      SITE_VISIT_SCHEDULED: 0,
      PROPOSAL_SENT: 0,
      NEGOTIATION: 0,
      WON: 0,
      LOST: 0,
    };
    leads.forEach((l) => {
      const stage = wonLeadIds.has(l.id) ? 'WON' : l.stage === 'WON' ? 'NEGOTIATION' : l.stage;
      if (stageCounts[stage] !== undefined) stageCounts[stage]++;
      else stageCounts[stage] = 1;
    });
    stageCounts.WON += directWonBookings.length;

    let leadStagesData = Object.entries(stageCounts).map(([stage, count]) => ({
      label: stage.replace(/_/g, ' '),
      count,
      percent: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
    }));

    // Leads by Source
    const sourceCounts: Record<string, number> = {};
    leads.forEach((l) => {
      const src = l.leadSource ? l.leadSource.replace(/_/g, ' ') : 'DIRECT';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    if (directWonBookings.length > 0) {
      sourceCounts.DIRECT_BOOKING = directWonBookings.length;
    }

    const leadSourcesData = Object.entries(sourceCounts).map(([source, count]) => ({
      label: source,
      count,
      percent: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
    }));

    // 3. Bookings & Financial Analytics
    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: filterStart, lte: filterEnd } },
      include: {
        paymentStages: true,
        ceremonyVenue: true,
        photographerVendor: true,
        decoratorVendor: true,
        catererVendor: true,
        customer: true,
      },
      orderBy: { weddingDate: 'asc' },
    });

    // Open receivables must remain visible for Accountant even when the
    // booking was created before the selected dashboard comparison period.
    const receivableBookings =
      roleName === 'Accountant'
        ? await prisma.booking.findMany({
            where: {
              bookingStatus: { in: ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'] },
              confirmationStatus: { not: 'NOT_CONFIRMED' },
            },
            select: { paymentStages: true },
          })
        : bookings;

    const leadOnlyPipelineCount = leads.filter((lead) => lead.bookings.length === 0).length;
    const wonBookingCount = bookings.filter((booking) =>
      ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(booking.bookingStatus)
    ).length;

    // Full sales pipeline = all Event Bookings plus leads not yet converted
    // to bookings. Cancelled and quote-declined bookings remain denominator
    // failures; only stage 4-6 bookings count as wins.
    totalLeads = bookings.length + leadOnlyPipelineCount;
    wonLeads = wonBookingCount;
    conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    conversionChangePct = conversionRate - prevConversionRate;

    stageCounts.NEW_INQUIRY = 0;
    stageCounts.CONTACTED = 0;
    stageCounts.SITE_VISIT_SCHEDULED = 0;
    stageCounts.PROPOSAL_SENT = 0;
    stageCounts.NEGOTIATION = 0;
    stageCounts.WON = 0;
    stageCounts.LOST = 0;

    leads
      .filter((lead) => lead.bookings.length === 0)
      .forEach((lead) => {
        const stage = lead.stage === 'WON' ? 'NEGOTIATION' : lead.stage;
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });
    bookings.forEach((booking) => {
      if (['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(booking.bookingStatus)) {
        stageCounts.WON += 1;
      } else if (booking.bookingStatus === 'CANCELLED' || booking.confirmationStatus === 'NOT_CONFIRMED') {
        stageCounts.LOST += 1;
      } else if (booking.bookingStatus === 'INQUIRY') {
        stageCounts.NEW_INQUIRY += 1;
      } else {
        stageCounts.NEGOTIATION += 1;
      }
    });
    leadStagesData = Object.entries(stageCounts).map(([stage, count]) => ({
      label: stage.replace(/_/g, ' '),
      count,
      percent: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
    }));

    const totalBookings = bookings.length;
    const totalContractValue = bookings.reduce((sum, b) => sum + b.totalQuoteAmount, 0);

    let totalCollectedRevenue = 0;
    let totalPendingReceivables = 0;
    let overdueCount = 0;

    const paymentStageCounts = {
      ADVANCE: { total: 0, paid: 0 },
      FLOWER: { total: 0, paid: 0 },
      FINAL: { total: 0, paid: 0 },
    };

    bookings.forEach((b) => {
      b.paymentStages.forEach((s) => {
        if (s.status === 'PAID') {
          totalCollectedRevenue += s.amountPaid;
        } else {
          totalPendingReceivables += s.amountDue - s.amountPaid;
        }
        if (s.status === 'OVERDUE') overdueCount++;

        const type = s.stageType as 'ADVANCE' | 'FLOWER' | 'FINAL';
        if (paymentStageCounts[type]) {
          paymentStageCounts[type].total += s.amountDue;
          paymentStageCounts[type].paid += s.amountPaid;
        }
      });
    });

    if (roleName === 'Accountant') {
      totalPendingReceivables = receivableBookings.reduce(
        (sum, booking) =>
          sum +
          booking.paymentStages.reduce(
            (stageSum, stage) => stageSum + (stage.status === 'PAID' ? 0 : stage.amountDue - stage.amountPaid),
            0
          ),
        0
      );
    }

    // Expenses & Net Balance
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: filterStart, lte: filterEnd } },
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netBalance = totalCollectedRevenue - totalExpenses;

    // Prior Bookings & Revenue Comparison
    const prevBookings = await prisma.booking.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      include: { paymentStages: true },
    });

    const prevBookingsCount = prevBookings.length;
    const prevLeadOnlyPipelineCount = prevLeads.filter((lead) => lead.bookings.length === 0).length;
    const prevWonBookingCount = prevBookings.filter((booking) =>
      ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(booking.bookingStatus)
    ).length;
    const prevPipelineCount = prevBookings.length + prevLeadOnlyPipelineCount;
    prevConversionRate = prevPipelineCount > 0 ? Math.round((prevWonBookingCount / prevPipelineCount) * 100) : 0;
    conversionChangePct = conversionRate - prevConversionRate;
    let prevRevenue = 0;
    prevBookings.forEach((b) => {
      b.paymentStages.forEach((s) => {
        if (s.status === 'PAID') prevRevenue += s.amountPaid;
      });
    });

    let bookingsChangePct = 0;
    if (prevBookingsCount > 0) {
      bookingsChangePct = Math.round(((totalBookings - prevBookingsCount) / prevBookingsCount) * 100);
    } else if (totalBookings > 0) {
      bookingsChangePct = 100;
    }

    let revenueChangePct = 0;
    if (prevRevenue > 0) {
      revenueChangePct = Math.round(((totalCollectedRevenue - prevRevenue) / prevRevenue) * 100);
    } else if (totalCollectedRevenue > 0) {
      revenueChangePct = 100;
    }

    // Sparklines
    const computeSparkline = (currentVal: number, prevVal: number) => {
      if (currentVal === 0 && prevVal === 0) return [0, 0, 0, 0, 0, 0];
      if (currentVal === 0 && prevVal > 0) {
        return [prevVal, Math.round(prevVal * 0.75), Math.round(prevVal * 0.5), Math.round(prevVal * 0.25), 0, 0];
      }
      if (currentVal > prevVal) {
        return [
          prevVal,
          Math.round(prevVal + (currentVal - prevVal) * 0.2),
          Math.round(prevVal + (currentVal - prevVal) * 0.5),
          Math.round(prevVal + (currentVal - prevVal) * 0.8),
          currentVal,
          currentVal,
        ];
      }
      if (currentVal < prevVal) {
        return [
          prevVal,
          Math.round(prevVal - (prevVal - currentVal) * 0.3),
          Math.round(prevVal - (prevVal - currentVal) * 0.6),
          Math.round(prevVal - (prevVal - currentVal) * 0.8),
          currentVal,
          currentVal,
        ];
      }
      return [currentVal, currentVal, currentVal, currentVal, currentVal, currentVal];
    };

    const leadsSparkline = computeSparkline(totalLeads, prevTotalLeads);
    const conversionSparkline = computeSparkline(conversionRate, prevConversionRate);
    const bookingsSparkline = computeSparkline(totalBookings, prevBookingsCount);
    const revenueSparkline = computeSparkline(
      totalContractValue / 100,
      prevBookings.reduce((sum, b) => sum + b.totalQuoteAmount, 0) / 100
    );

    // 4. TIMEFRAME-AWARE DYNAMIC TREND CURVE COMPUTATION
    const allPaidStages = await prisma.paymentStage.findMany({
      where: { status: 'PAID' },
    });
    const allExpenses = await prisma.expense.findMany();

    let trendData: Array<{ month: string; revenue: number; expenses: number; netProfit: number }> = [];

    if (range === '1d') {
      // 24 Hours broken into 6 hour buckets
      const hourBuckets = [
        { label: '00:00', startH: 0, endH: 4 },
        { label: '04:00', startH: 4, endH: 8 },
        { label: '08:00', startH: 8, endH: 12 },
        { label: '12:00', startH: 12, endH: 16 },
        { label: '16:00', startH: 16, endH: 20 },
        { label: '20:00', startH: 20, endH: 24 },
      ];

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      trendData = hourBuckets.map((bucket) => {
        const revCents = allPaidStages
          .filter((s) => {
            if (!s.paidDate) return false;
            const d = new Date(s.paidDate);
            return d >= todayStart && d.getHours() >= bucket.startH && d.getHours() < bucket.endH;
          })
          .reduce((sum, s) => sum + s.amountPaid, 0);

        const expCents = allExpenses
          .filter((e) => {
            const d = new Date(e.date);
            return d >= todayStart && d.getHours() >= bucket.startH && d.getHours() < bucket.endH;
          })
          .reduce((sum, e) => sum + e.amount, 0);

        const revenue = Math.round(revCents / 100);
        const expAmt = Math.round(expCents / 100);
        return { month: bucket.label, revenue, expenses: expAmt, netProfit: revenue - expAmt };
      });
    } else if (range === '1w') {
      // 7 Days of the Week
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayBuckets: { label: string; date: Date }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dayBuckets.push({
          label: daysOfWeek[d.getDay()],
          date: d,
        });
      }

      trendData = dayBuckets.map((bucket) => {
        const dayStr = bucket.date.toDateString();

        const revCents = allPaidStages
          .filter((s) => s.paidDate && new Date(s.paidDate).toDateString() === dayStr)
          .reduce((sum, s) => sum + s.amountPaid, 0);

        const expCents = allExpenses
          .filter((e) => new Date(e.date).toDateString() === dayStr)
          .reduce((sum, e) => sum + e.amount, 0);

        const revenue = Math.round(revCents / 100);
        const expAmt = Math.round(expCents / 100);
        return { month: bucket.label, revenue, expenses: expAmt, netProfit: revenue - expAmt };
      });
    } else if (range === '1y') {
      // 12 Months of the Year
      const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthBuckets: { label: string; monthIdx: number; year: number }[] = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthBuckets.push({
          label: allMonths[d.getMonth()],
          monthIdx: d.getMonth(),
          year: d.getFullYear(),
        });
      }

      trendData = monthBuckets.map((bucket) => {
        const revCents = allPaidStages
          .filter((s) => {
            if (!s.paidDate) return false;
            const d = new Date(s.paidDate);
            return d.getMonth() === bucket.monthIdx && d.getFullYear() === bucket.year;
          })
          .reduce((sum, s) => sum + s.amountPaid, 0);

        const expCents = allExpenses
          .filter((e) => {
            const d = new Date(e.date);
            return d.getMonth() === bucket.monthIdx && d.getFullYear() === bucket.year;
          })
          .reduce((sum, e) => sum + e.amount, 0);

        const revenue = Math.round(revCents / 100);
        const expAmt = Math.round(expCents / 100);
        return { month: bucket.label, revenue, expenses: expAmt, netProfit: revenue - expAmt };
      });
    } else if (range === 'custom' && customStart && customEnd) {
      // Custom Date Range spanning N days
      const cStart = new Date(customStart);
      const cEnd = new Date(customEnd + 'T23:59:59');
      const durationMs = Math.max(24 * 60 * 60 * 1000, cEnd.getTime() - cStart.getTime());
      const stepMs = durationMs / 5;

      const intervalBuckets: { label: string; start: Date; end: Date }[] = [];
      for (let i = 0; i < 6; i++) {
        const bStart = new Date(cStart.getTime() + i * stepMs);
        const bEnd = new Date(cStart.getTime() + (i + 1) * stepMs);
        intervalBuckets.push({
          label: `${bStart.getDate()}/${bStart.getMonth() + 1}`,
          start: bStart,
          end: bEnd,
        });
      }

      trendData = intervalBuckets.map((bucket) => {
        const revCents = allPaidStages
          .filter((s) => {
            if (!s.paidDate) return false;
            const d = new Date(s.paidDate);
            return d >= bucket.start && d <= bucket.end;
          })
          .reduce((sum, s) => sum + s.amountPaid, 0);

        const expCents = allExpenses
          .filter((e) => {
            const d = new Date(e.date);
            return d >= bucket.start && d <= bucket.end;
          })
          .reduce((sum, e) => sum + e.amount, 0);

        const revenue = Math.round(revCents / 100);
        const expAmt = Math.round(expCents / 100);
        return { month: bucket.label, revenue, expenses: expAmt, netProfit: revenue - expAmt };
      });
    } else {
      // Monthly 1m (Default 6-month rolling window)
      const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthBuckets: { label: string; monthIdx: number; year: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthBuckets.push({
          label: allMonths[d.getMonth()],
          monthIdx: d.getMonth(),
          year: d.getFullYear(),
        });
      }

      trendData = monthBuckets.map((bucket) => {
        const revCents = allPaidStages
          .filter((s) => {
            if (!s.paidDate) return false;
            const d = new Date(s.paidDate);
            return d.getMonth() === bucket.monthIdx && d.getFullYear() === bucket.year;
          })
          .reduce((sum, s) => sum + s.amountPaid, 0);

        const expCents = allExpenses
          .filter((e) => {
            const d = new Date(e.date);
            return d.getMonth() === bucket.monthIdx && d.getFullYear() === bucket.year;
          })
          .reduce((sum, e) => sum + e.amount, 0);

        const revenue = Math.round(revCents / 100);
        const expAmt = Math.round(expCents / 100);
        return { month: bucket.label, revenue, expenses: expAmt, netProfit: revenue - expAmt };
      });
    }

    // 5. Venues & Vendors Analytics
    const venues = await prisma.venue.findMany({ include: { ceremonyBookings: true } });
    const topVenues = venues
      .map((v) => ({
        name: v.name,
        city: v.cityArea,
        capacity: v.maxCapacity || 0,
        bookingsCount: v.ceremonyBookings.length,
      }))
      .sort((a, b) => b.bookingsCount - a.bookingsCount)
      .slice(0, 5);

    const vendors = await prisma.vendor.findMany();
    const topVendors = vendors
      .map((v) => ({
        name: v.name,
        category: v.category,
        rating: v.reliabilityRating || 5,
      }))
      .slice(0, 5);

    // System Activity
    const usersCount = await prisma.user.count({ where: { isActive: true } });
    const auditLogsCount = await prisma.auditLog.count();
    const activeSessionsCount = await prisma.workSession.count({ where: { endTime: null } });

    // Table Previews
    const latestBookings = await prisma.booking.findMany({
      include: { customer: true, paymentStages: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const latestLeads = await prisma.lead.findMany({
      include: {
        customer: true,
        bookings: { select: { bookingStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Master Target Config
    let systemTargetConfig = await prisma.systemTargetConfig.findUnique({
      where: { id: 'default' },
    });
    const masterYearlyTarget = systemTargetConfig?.yearlyTarget || 60000000;
    const masterMonthlyTarget = Math.round(masterYearlyTarget / 12);
    const masterWeeklyTarget = Math.round(masterYearlyTarget / 52);
    const masterDailyTarget = Math.round(masterYearlyTarget / 365);

    let targetAmount = masterMonthlyTarget;
    let timeframeLabel = 'Monthly Target';

    if (range === '1d') {
      targetAmount = masterDailyTarget;
      timeframeLabel = 'Daily Target';
    } else if (range === '1w') {
      targetAmount = masterWeeklyTarget;
      timeframeLabel = 'Weekly Target';
    } else if (range === '1y') {
      targetAmount = masterYearlyTarget;
      timeframeLabel = 'Yearly Target';
    } else if (range === 'custom' && customStart && customEnd) {
      const durationMs = Math.max(24 * 60 * 60 * 1000, filterEnd.getTime() - filterStart.getTime());
      const days = Math.ceil(durationMs / (24 * 60 * 60 * 1000));
      targetAmount = Math.round(days * masterDailyTarget);
      timeframeLabel = `Custom Target (${days} Days)`;
    }

    const achievedAmount = totalCollectedRevenue / 100;
    const remainingAmount = Math.max(0, targetAmount - achievedAmount);
    const progressPct = targetAmount > 0 ? Math.min(100, Math.round((achievedAmount / targetAmount) * 100)) : 0;

    const targetInfo = {
      timeframeLabel,
      targetAmount,
      achievedAmount,
      remainingAmount,
      progressPct,
      yearlyTarget: masterYearlyTarget,
      monthlyTarget: masterMonthlyTarget,
      weeklyTarget: masterWeeklyTarget,
      dailyTarget: masterDailyTarget,
    };

    return NextResponse.json({
      role: roleName,
      range,
      comparisonLabel,
      targetInfo,
      deltas: {
        leadsChangePct,
        conversionChangePct,
        bookingsChangePct,
        revenueChangePct,
      },
      sparklines: {
        leads: leadsSparkline,
        conversion: conversionSparkline,
        bookings: bookingsSparkline,
        revenue: revenueSparkline,
      },
      kpis: {
        totalLeads,
        wonLeads,
        conversionRate,
        totalBookings,
        totalContractValue: totalContractValue / 100,
        totalCollectedRevenue: totalCollectedRevenue / 100,
        totalPendingReceivables: totalPendingReceivables / 100,
        totalExpenses: totalExpenses / 100,
        netBalance: netBalance / 100,
        overdueCount,
        usersCount,
        auditLogsCount,
        activeSessionsCount,
      },
      charts: {
        leadStages: leadStagesData,
        leadSources: leadSourcesData,
        monthlyTrend: trendData,
        paymentStages: [
          { stage: 'Advance (30%)', total: paymentStageCounts.ADVANCE.total / 100, paid: paymentStageCounts.ADVANCE.paid / 100 },
          { stage: 'Flower (40%)', total: paymentStageCounts.FLOWER.total / 100, paid: paymentStageCounts.FLOWER.paid / 100 },
          { stage: 'Final (30%)', total: paymentStageCounts.FINAL.total / 100, paid: paymentStageCounts.FINAL.paid / 100 },
        ],
        topVenues,
        topVendors,
      },
      recentBookings: latestBookings.map((b) => ({
        id: b.id,
        customerName: b.customer.name,
        weddingDate: b.weddingDate.toISOString(),
        packageType: b.packageType,
        totalQuoteAmount: b.totalQuoteAmount / 100,
        paymentStatus: b.paymentStatus,
        bookingStatus: b.bookingStatus,
      })),
      recentLeads: [
        ...latestLeads.map((l) => {
          const isWon = l.bookings.some((booking) =>
            ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(booking.bookingStatus)
          );
          return {
          id: l.id,
          customerName: l.customer.name,
          source: l.leadSource,
          stage: isWon ? 'WON' : l.stage === 'WON' ? 'NEGOTIATION' : l.stage,
          budget: l.budgetRange ? (parseLkrToCents(l.budgetRange) || 0) / 100 : 0,
          converted: isWon,
          };
        }),
        ...directWonBookings.slice(0, 5).map((booking) => ({
          id: booking.id,
          customerName: booking.customer.name,
          source: 'DIRECT_BOOKING',
          stage: 'WON',
          budget: booking.totalQuoteAmount / 100,
          converted: true,
        })),
      ].slice(0, 5),
    });
  } catch (error) {
    console.error('Error computing dashboard analytics:', error);
    return NextResponse.json({ error: 'Failed to compute dashboard analytics' }, { status: 500 });
  }
}

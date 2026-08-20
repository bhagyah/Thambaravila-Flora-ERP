import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

const DEFAULT_YEARLY_TARGET = 60000000; // 60 Million LKR default

// GET /api/targets/config — Fetch master target config with automatic timeframe breakdowns
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let config = await prisma.systemTargetConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      config = await prisma.systemTargetConfig.create({
        data: {
          id: 'default',
          yearlyTarget: DEFAULT_YEARLY_TARGET,
          updatedById: session.user.id,
          updatedByName: session.user.name || 'System Default',
        },
      });
    }

    const yearlyTarget = config.yearlyTarget || DEFAULT_YEARLY_TARGET;
    const monthlyTarget = Math.round(yearlyTarget / 12);
    const weeklyTarget = Math.round(yearlyTarget / 52);
    const dailyTarget = Math.round(yearlyTarget / 365);

    return NextResponse.json({
      config: {
        ...config,
        yearlyTarget,
        monthlyTarget,
        weeklyTarget,
        dailyTarget,
      },
    });
  } catch (error) {
    console.error('Error fetching system target config:', error);
    return NextResponse.json({ error: 'Failed to fetch target config' }, { status: 500 });
  }
}

// PUT /api/targets/config — Update master target configuration (Owner only)
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleName = session.user.role?.name || '';
  if (roleName !== 'Owner') {
    return NextResponse.json(
      { error: 'Forbidden: Only the Owner account can set or adjust master business targets.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    let { yearlyTarget, monthlyTarget } = body;

    // Convert monthly target to yearly master target if monthly is explicitly provided
    if (monthlyTarget != null && (yearlyTarget == null || Number(yearlyTarget) <= 0)) {
      yearlyTarget = Number(monthlyTarget) * 12;
    }

    const numYearlyTarget = Math.max(100000, Math.round(Number(yearlyTarget) || DEFAULT_YEARLY_TARGET));

    const config = await prisma.systemTargetConfig.upsert({
      where: { id: 'default' },
      update: {
        yearlyTarget: numYearlyTarget,
        updatedById: session.user.id,
        updatedByName: session.user.name || 'Owner',
      },
      create: {
        id: 'default',
        yearlyTarget: numYearlyTarget,
        updatedById: session.user.id,
        updatedByName: session.user.name || 'Owner',
      },
    });

    const monthlyCalc = Math.round(numYearlyTarget / 12);
    const weeklyCalc = Math.round(numYearlyTarget / 52);
    const dailyCalc = Math.round(numYearlyTarget / 365);

    await createAuditLog({
      userId: session.user.id,
      action: 'SYSTEM_TARGET_UPDATED',
      entityType: 'system_target_config',
      entityId: 'default',
      details: {
        yearlyTarget: numYearlyTarget,
        monthlyTarget: monthlyCalc,
        weeklyTarget: weeklyCalc,
        dailyTarget: dailyCalc,
        updatedBy: session.user.name,
      },
    });

    return NextResponse.json({
      config: {
        ...config,
        yearlyTarget: numYearlyTarget,
        monthlyTarget: monthlyCalc,
        weeklyTarget: weeklyCalc,
        dailyTarget: dailyCalc,
      },
      message: 'Business revenue targets updated successfully.',
    });
  } catch (error) {
    console.error('Error updating system target config:', error);
    return NextResponse.json({ error: 'Failed to update target config' }, { status: 500 });
  }
}

import type { ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface DashboardKpis {
  totalLeads: number;
  wonLeads: number;
  conversionRate: number;
  totalBookings: number;
  totalContractValue: number;
  totalCollectedRevenue: number;
  totalPendingReceivables: number;
  totalExpenses: number;
  netBalance: number;
  overdueCount: number;
  usersCount: number;
  auditLogsCount: number;
  activeSessionsCount: number;
}

export interface TrendItem {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface AnalyticsResponse {
  role?: string;
  range?: string;
  comparisonLabel?: string;
  targetInfo?: {
    timeframeLabel: string;
    targetAmount: number;
    achievedAmount: number;
    remainingAmount: number;
    progressPct: number;
  };
  deltas?: {
    leadsChangePct: number;
    conversionChangePct: number;
    bookingsChangePct: number;
    revenueChangePct: number;
  };
  kpis: DashboardKpis;
  charts: {
    monthlyTrend: TrendItem[];
  };
  recentBookings: Array<{
    id: string;
    customerName: string;
    weddingDate: string;
    packageType: string;
    totalQuoteAmount: number;
    paymentStatus: string;
    bookingStatus: string;
  }>;
}

export interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  totalAmount?: number | null;
  date: string;
  paymentMethod?: string | null;
  paidByName?: string | null;
}

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export interface TransactionItem {
  id: string;
  title: string;
  cardNumber: string;
  date: string;
  amount: number;
  kind: 'credit' | 'debit';
  subtitle: string;
  icon: ReactNode;
}


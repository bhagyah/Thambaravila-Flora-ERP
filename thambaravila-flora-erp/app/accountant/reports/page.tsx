'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatLKR } from '@/lib/utils/formatters';

interface CustomerBreakdown {
  name: string;
  customerId: string;
  total: number; // in cents
  paid: number;  // in cents
  due: number;   // in cents
}

interface BookingItem {
  id: string;
  totalQuoteAmount: number;
  balanceDueAmount?: number | null;
  bookingStatus: string;
  customer?: {
    name?: string | null;
    customerId?: string | null;
    customer_id?: string | null;
  } | null;
  paymentStages?: Array<{
    amountDue: number;
    amountPaid: number;
    status: string;
  }>;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0); // in cents
  const [grossContractedValue, setGrossContractedValue] = useState(0); // in cents
  const [totalExpenses, setTotalExpenses] = useState(0); // in cents
  const [receivables, setReceivables] = useState(0); // in cents
  const [customerBreakdown, setCustomerBreakdown] = useState<CustomerBreakdown[]>([]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const bookingsRes = await fetch('/api/bookings');
      if (bookingsRes.ok) {
        const bookings: BookingItem[] = await bookingsRes.json();
        let rev = 0;
        let rec = 0;
        let grossQuote = 0;
        const custMap: Record<string, CustomerBreakdown> = {};

        bookings
          .filter((booking) => booking.bookingStatus !== 'CANCELLED')
          .forEach((booking) => {
          const cId = booking.customer?.customerId || booking.customer?.customer_id || booking.id;
          if (!custMap[cId]) {
            custMap[cId] = {
              name: booking.customer?.name || 'Client',
              customerId: cId,
              total: 0,
              paid: 0,
              due: 0,
            };
          }

          const qAmount = booking.totalQuoteAmount || 0;
          grossQuote += qAmount;
          custMap[cId].total += qAmount;

          if (booking.paymentStages && booking.paymentStages.length > 0) {
            booking.paymentStages.forEach((s) => {
              const paid = s.amountPaid || 0;
              const due = (s.amountDue || 0) - paid;
              rev += paid;
              custMap[cId].paid += paid;
              rec += due > 0 ? due : 0;
              custMap[cId].due += due > 0 ? due : 0;
            });
          } else {
            const fallbackDue = Math.max(0, booking.balanceDueAmount ?? qAmount);
            rec += fallbackDue;
            custMap[cId].due += fallbackDue;
          }
        });

        setGrossContractedValue(grossQuote);
        setTotalRevenue(rev);
        setReceivables(rec);
        setCustomerBreakdown(Object.values(custMap));
      }

      const expRes = await fetch('/api/expenses');
      if (expRes.ok) {
        const data = await expRes.json();
        setTotalExpenses(data.totalAmount || 0);
      }
    } catch (e) {
      console.error('Failed to load financial statement:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const roleName = session.user?.role?.name || '';
  const isAllowed = roleName === 'Owner' || roleName === 'Accountant';

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <h2 className="text-2xl font-black text-rose-500">Access Restricted</h2>
          <p className="text-slate-400 text-xs mt-2">P&L statements and financial reports are restricted to Owner and Accountant roles.</p>
        </div>
      </div>
    );
  }

  const netProfit = totalRevenue - totalExpenses;
  const profitMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';



  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 print:bg-white print:text-slate-950 print:p-0">
      <div className="max-w-5xl mx-auto space-y-6 print:max-w-none print:space-y-4">
        {/* Navigation & Actions Bar (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <Link href="/accountant/financials" className="text-xs text-slate-400 hover:text-blue-400 transition font-semibold">
                ← Financial Dashboard
              </Link>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-emerald-400">Official P&amp;L Statement</span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight mt-1">
              Profit &amp; Loss Statement &amp; Receivables Audit
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg transition flex items-center space-x-2"
            >
              <span>🖨️</span>
              <span>Print Official Financial Statement</span>
            </button>
          </div>
        </div>

        {/* Printable Executive Statement Container */}
        <div className="bg-slate-900 border border-slate-800 p-8 sm:p-12 rounded-3xl shadow-2xl space-y-8 print:bg-white print:text-slate-950 print:border-none print:shadow-none print:p-0">
          {/* Statement Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-700 print:border-slate-950 pb-6">
            <div>
              <span className="text-xs font-bold text-emerald-400 print:text-emerald-700 uppercase tracking-widest block">
                Official Financial Statement
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-100 print:text-slate-950 tracking-tight mt-0.5">
                Thambaravila Flora ERP
              </h2>
              <p className="text-slate-400 print:text-slate-600 text-xs mt-1 font-medium">
                Profit &amp; Loss Statement, Cost Structure &amp; Receivables Risk Matrix
              </p>
            </div>

            <div className="text-right text-xs text-slate-400 print:text-slate-600 space-y-1 font-mono">
              <div><strong>Statement Date:</strong> {new Date().toLocaleDateString('en-GB')}</div>
              <div><strong>Prepared By:</strong> {session.user.name} ({session.user.role.name})</div>
              <div><strong>Currency:</strong> Sri Lankan Rupee (LKR)</div>
            </div>
          </div>

          {/* Section 1: Income Statement (P&L) */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 print:text-emerald-700 border-b border-slate-800 print:border-slate-300 pb-2 flex items-center justify-between">
              <span>1. Income Statement (Profit &amp; Loss Summary)</span>
              <span className="font-mono text-[10px] text-slate-400">Margin: {profitMarginPercent}%</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-200 print:text-slate-900">
                <tbody className="divide-y divide-slate-800/80 print:divide-slate-200 font-medium">
                  <tr>
                    <td className="py-3 font-semibold text-slate-300 print:text-slate-700">Gross Contracted Value (Total Event Quotes)</td>
                    <td className="py-3 text-right font-bold text-slate-100 print:text-slate-900 font-mono">
                      {formatLKR(grossContractedValue)}
                    </td>
                  </tr>

                  <tr className="bg-emerald-950/20 print:bg-emerald-50">
                    <td className="py-3 font-bold text-emerald-300 print:text-emerald-900">Gross Cash Inflow (Confirmed Payments Received)</td>
                    <td className="py-3 text-right font-black text-emerald-400 print:text-emerald-700 font-mono">
                      + {formatLKR(totalRevenue)}
                    </td>
                  </tr>

                  <tr className="bg-rose-950/20 print:bg-rose-50">
                    <td className="py-3 font-bold text-rose-300 print:text-rose-900">Less: Total Operational Expenses (Outflow)</td>
                    <td className="py-3 text-right font-black text-rose-400 print:text-rose-700 font-mono">
                      - {formatLKR(totalExpenses)}
                    </td>
                  </tr>

                  <tr className="bg-slate-950 print:bg-slate-100 text-sm font-black border-t-2 border-slate-700 print:border-slate-950">
                    <td className="py-4 px-3 text-slate-100 print:text-slate-950">Net Operating Income (Net Profit)</td>
                    <td className={`py-4 px-3 text-right font-mono ${netProfit >= 0 ? 'text-teal-300 print:text-teal-800' : 'text-rose-400 print:text-rose-800'}`}>
                      {formatLKR(netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Accounts Receivable Ageing & Risk Matrix */}
          <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center border-b border-slate-800 print:border-slate-300 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 print:text-amber-700">
                2. Accounts Receivable &amp; Client Ledger Summary
              </h3>
              <span className="text-xs font-mono font-bold text-amber-400">
                Total Due: {formatLKR(receivables)}
              </span>
            </div>

            {customerBreakdown.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-6">No customer accounts on record.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300 print:text-slate-900">
                  <thead className="bg-slate-950 print:bg-slate-100 text-slate-400 print:text-slate-700 font-bold uppercase text-[10px] border-b border-slate-800 print:border-slate-300">
                    <tr>
                      <th className="p-3">Client ID</th>
                      <th className="p-3">Client Name</th>
                      <th className="p-3 text-right">Total Quoted</th>
                      <th className="p-3 text-right">Confirmed Paid</th>
                      <th className="p-3 text-right">Outstanding Due</th>
                      <th className="p-3 text-center">Collection Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 print:divide-slate-200">
                    {customerBreakdown.map((c) => {
                      const paidRatio = c.total > 0 ? c.paid / c.total : 0;
                      const riskLevel = paidRatio >= 0.7 ? 'LOW_RISK' : paidRatio >= 0.3 ? 'MEDIUM_RISK' : 'HIGH_RISK';

                      return (
                        <tr key={c.customerId} className="hover:bg-slate-800/40 print:hover:bg-transparent transition">
                          <td className="p-3 font-mono font-bold text-blue-400 print:text-slate-900">{c.customerId}</td>
                          <td className="p-3 font-semibold text-slate-100 print:text-slate-900">{c.name}</td>
                          <td className="p-3 text-right font-mono text-slate-300 print:text-slate-800">{formatLKR(c.total)}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400 print:text-emerald-700">{formatLKR(c.paid)}</td>
                          <td className="p-3 text-right font-mono font-extrabold text-amber-400 print:text-amber-800">{formatLKR(c.due)}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                                riskLevel === 'LOW_RISK'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : riskLevel === 'MEDIUM_RISK'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {riskLevel.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-950 print:bg-slate-100 font-bold border-t-2 border-slate-700 print:border-slate-950">
                    <tr>
                      <td colSpan={4} className="p-3 text-slate-100 print:text-slate-950 uppercase text-[11px]">Total Outstanding Accounts Receivable</td>
                      <td className="p-3 text-right font-mono text-sm text-amber-400 print:text-amber-800 font-black">{formatLKR(receivables)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Official Signatures & Audit Approval Block */}
          <div className="pt-10 grid grid-cols-2 gap-12 text-center text-xs text-slate-400 print:text-slate-700">
            <div className="border-t border-slate-700 print:border-slate-400 pt-3">
              <div className="font-bold text-slate-200 print:text-slate-900">{session.user.name}</div>
              <div className="text-[10px] text-slate-400 print:text-slate-600 uppercase">Accountant Signature &amp; Date</div>
            </div>

            <div className="border-t border-slate-700 print:border-slate-400 pt-3">
              <div className="font-bold text-slate-200 print:text-slate-900">Executive Management</div>
              <div className="text-[10px] text-slate-400 print:text-slate-600 uppercase">Owner Sign-off &amp; Company Stamp</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

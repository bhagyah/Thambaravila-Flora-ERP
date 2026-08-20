'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function CustomerPortalPage() {
  const params = useParams();
  const enquiryId = params?.enquiryId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (enquiryId) {
      fetchPaymentSummary();
    }
  }, [enquiryId]);

  const fetchPaymentSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/payments/summary/${enquiryId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center font-medium animate-pulse">Loading Customer Portal...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-teal-400">Portal Link Invalid</h2>
          <p className="text-slate-400 text-sm">Could not find booking record for ID: {enquiryId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-mono font-bold rounded-full">
            OFFICIAL CLIENT PORTAL
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Thambaravila Flora</h1>
          <p className="text-slate-400 text-sm">Wedding Floristry & Bespoke Event Decor</p>
        </div>

        {/* Booking Summary Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="text-xs uppercase font-bold text-slate-500">Customer Reference</span>
              <div className="text-2xl font-bold text-white mt-1">{data.customerName || 'Valued Client'}</div>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-bold text-slate-500">Pipeline Status</span>
              <div className="mt-1">
                <span className="px-3 py-1 bg-teal-500/20 text-teal-300 font-bold text-xs rounded-full border border-teal-500/30">
                  {data.status || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Progress */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-semibold">Total Event Quote</span>
              <span className="text-xl font-bold text-white">
                LKR {((data.totalQuoteAmount || 0) / 100).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-semibold">Total Paid to Date</span>
              <span className="text-xl font-bold text-emerald-400">
                LKR {((data.totalPaidAmount || 0) / 100).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Milestones Breakdown */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Milestones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.paymentStages?.map((stage: any) => (
                <div
                  key={stage.id}
                  className={`p-4 rounded-xl border ${
                    stage.status === 'PAID'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>{stage.stageType}</span>
                    <span>{stage.status}</span>
                  </div>
                  <div className="text-lg font-black text-white">
                    LKR {(stage.amountDue / 100).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Due: {new Date(stage.dueDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500">
          For inquiries or custom changes, please contact your assigned Thambaravila Flora Event Coordinator.
        </div>
      </div>
    </div>
  );
}

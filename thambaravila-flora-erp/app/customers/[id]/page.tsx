'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatLKR } from '@/lib/utils/formatters';

interface Lead {
  id: string;
  stage: string;
  leadSource: string;
  tentativeWeddingDate: string | null;
  tentativeVenue: string | null;
  estimatedGuestCount: number | null;
  budgetRange: string | null;
  converted: boolean;
  assignedSalesExec?: { name: string; role?: { name: string } } | null;
}

interface PaymentStage {
  id: string;
  stageType: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
}

interface Booking {
  id: string;
  weddingDate: string;
  dayOfWeek: string;
  packageType: string;
  totalQuoteAmount: number;
  depositAmount: number;
  balanceDueAmount: number;
  paymentStatus: string;
  bookingStatus: string;
  ceremonyVenue?: { name: string } | null;
  receptionVenue?: { name: string } | null;
  salesExec?: { name: string; role?: { name: string } } | null;
  paymentStages: PaymentStage[];
}

interface CustomerDetail {
  id: string;
  customerId: string;
  customer_id?: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  source: string;
  nicNumber?: string | null;
  nic_number?: string | null;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  socialHandle?: string | null;
  social_handle?: string | null;
  additionalNotes?: string | null;
  additional_notes?: string | null;
  assignedSalesManager?: {
    id: string;
    name: string;
    email?: string;
    role?: { id: string; name: string };
  } | null;
  sales_manager_name?: string | null;
  leads?: Lead[];
  bookings?: Booking[];
}

export default function CustomerDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Additional Notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccessMsg, setNotesSuccessMsg] = useState('');

  // Auto Create Lead Modal state
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);

  useEffect(() => {
    if (session && customerId) {
      fetchCustomerDetail();
    }
  }, [session, customerId]);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        const cust = data.customer || data;
        setCustomer(cust);
        setNotes(cust.additionalNotes || cust.additional_notes || '');
      }
    } catch (e) {
      console.error('Failed to fetch customer detail:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotes(true);
    setNotesSuccessMsg('');
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalNotes: notes }),
      });
      if (res.ok) {
        setNotesSuccessMsg('✓ Customer notes saved successfully!');
        setTimeout(() => setNotesSuccessMsg(''), 2500);
      }
    } catch (err) {
      console.error('Failed to save customer notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    const reason = prompt(
      `Submit Customer Deletion Request for Owner Approval:\n\nPlease enter the reason for deleting customer "${customer.name}" and all associated bookings/balances:`
    );

    if (reason === null) return;
    if (!reason.trim()) {
      alert('A deletion reason is required to submit for Owner Approval.');
      return;
    }

    try {
      const res = await fetch('/api/customers/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Deletion request for Client "${customer.name}" submitted to Owner for Approval.`);
        router.push('/customers');
      } else {
        alert(data.error || 'Failed to submit deletion request');
      }
    } catch (e) {
      alert('Error submitting deletion request');
    }
  };

  if (!session || loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3 bg-slate-950 text-slate-100">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-semibold text-xs animate-pulse">Loading Client Dossier...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-slate-950 text-slate-100 min-h-screen">
        <h2 className="text-2xl font-bold text-slate-100">Customer Profile Not Found</h2>
        <Link href="/customers" className="mt-4 inline-block text-blue-400 font-semibold hover:underline text-sm">
          ← Return to Customers Directory
        </Link>
      </div>
    );
  }

  const roleName = session.user?.role?.name || '';
  const canSeeFinancials = ['Owner', 'Accountant', 'Sales Manager'].includes(roleName);

  const displayCustomerId = customer.customerId || customer.customer_id || 'TF-CUST';
  const managerObj = customer.assignedSalesManager;
  const rawManagerName = managerObj?.name || customer.sales_manager_name || (customer as any).sales_manager_name;
  const rawManagerRole = managerObj?.role?.name || (customer as any).sales_manager_role;

  // Fallback to active logged in session user if legacy record has no manager assigned
  const managerName = rawManagerName || session.user?.name || 'System Admin';
  const managerRole = rawManagerRole || session.user?.role?.name || 'Owner';

  const nic = customer.nicNumber || customer.nic_number || null;
  const dob = customer.dateOfBirth || customer.date_of_birth || null;
  const social = customer.socialHandle || customer.social_handle || null;
  const leads = customer.leads || [];
  const bookings = customer.bookings || [];

  // Calculate totals
  const totalQuoteAmount = bookings.reduce((sum, b) => sum + (b.totalQuoteAmount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            {/* Customer Avatar Circle */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-lg border border-blue-400/30 flex-shrink-0">
              {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Link href="/customers" className="text-xs text-slate-400 hover:text-blue-400 transition font-semibold">
                  ← Customers
                </Link>
                <span className="text-slate-600">•</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {displayCustomerId}
                </span>
                {customer.source && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Source: {customer.source}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
                {customer.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400 font-medium">
                <span className="flex items-center space-x-1 text-slate-300">
                  <span>📞</span>
                  <span>{customer.phone}</span>
                </span>
                {customer.email && (
                  <span className="flex items-center space-x-1 text-slate-300">
                    <span>✉️</span>
                    <span>{customer.email}</span>
                  </span>
                )}
                {social && (
                  <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 text-[11px] font-bold flex items-center space-x-1">
                    <span>📸</span>
                    <span>{social}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Automated Create Lead & Delete Profile */}
          <div className="flex flex-wrap items-center gap-3 z-10">
            <button
              onClick={() => setShowCreateLeadModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg transition flex items-center space-x-2"
            >
              <span>⚡</span>
              <span>+ Create Lead (Automated)</span>
            </button>
            <button
              onClick={handleDeleteCustomer}
              className="px-4 py-2.5 bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 hover:text-white font-bold border border-rose-800/60 rounded-xl text-xs shadow-lg transition flex items-center space-x-1.5"
              title="Delete Customer Profile & Associated Balances"
            >
              <span>🗑️</span>
              <span>Delete Profile</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <span>📥</span>
              <span>Lead Inquiries</span>
            </div>
            <div className="text-2xl font-black text-slate-100">{leads.length}</div>
            <div className="text-[10px] text-slate-500 font-medium">Pre-conversion pipeline</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <span>💍</span>
              <span>Confirmed Events</span>
            </div>
            <div className="text-2xl font-black text-emerald-400">{bookings.length}</div>
            <div className="text-[10px] text-emerald-500/80 font-medium">Active event contracts</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <span>💰</span>
              <span>Total Contract Value</span>
            </div>
            <div className="text-xl font-extrabold text-blue-400">{formatLKR(totalQuoteAmount)}</div>
            <div className="text-[10px] text-slate-500 font-medium">Combined booking value</div>
          </div>

          {/* Assigned Staff & Role Highlight Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-2xl p-4 shadow-lg space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center space-x-1.5">
              <span>👤</span>
              <span>Assigned Staff &amp; Role</span>
            </div>
            <div className="text-base font-extrabold text-slate-100 truncate">
              {managerName}
            </div>
            <div className="text-[11px] font-bold text-indigo-400 flex items-center space-x-1">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 uppercase text-[9px]">
                {managerRole}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Profile Information & Requirements Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Cols: Full Client Dossier Attributes */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>📋</span>
                <span>Client Identification Profile</span>
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 font-medium">ID / NIC Number:</span>
                <span className="font-mono font-extrabold text-slate-100">{nic || 'Not Specified'}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 font-medium">Birthday (DOB):</span>
                <span className="font-extrabold text-slate-100">
                  {dob ? `🎂 ${new Date(dob).toLocaleDateString('en-GB')} ${customer.gender ? `(${customer.gender})` : ''}` : 'Not Specified'}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 font-medium">Social Profile:</span>
                <span className="font-bold text-purple-300">{social || 'Not Specified'}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 font-medium">Assigned Role:</span>
                <span className="font-bold text-indigo-300">{managerRole} ({managerName})</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium block">Residential Address:</span>
                <span className="font-semibold text-slate-200 block">{customer.address || 'No address on record'}</span>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Save Text / Additional Notes & Requirements */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>📝</span>
                  <span>Additional Notes &amp; Customer Requirements</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Save custom instructions, flower choices, family requests, or special wedding requirements.
                </p>
              </div>
            </div>

            {notesSuccessMsg && (
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-xl text-xs font-bold animate-in fade-in">
                {notesSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveNotes} className="flex-1 flex flex-col space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Type additional client notes here (e.g. prefers pastel pink roses, family contact details, venue access timing...)"
                className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium leading-relaxed"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingNotes}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-extrabold rounded-xl text-xs shadow transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <span>💾</span>
                  <span>{savingNotes ? 'Saving Notes...' : 'Save Notes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Leads Pipeline History */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>📥</span>
              <span>Pre-Conversion Lead Inquiries ({leads.length})</span>
            </h2>

            <button
              onClick={() => setShowCreateLeadModal(true)}
              className="text-xs font-bold text-emerald-400 hover:underline flex items-center space-x-1"
            >
              <span>+ Create Lead</span>
            </button>
          </div>

          {leads.length === 0 ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center text-slate-400 text-xs font-medium">
              No pre-conversion lead inquiries recorded for this customer yet.
            </div>
          ) : (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Lead ID</th>
                      <th className="p-3">Channel Source</th>
                      <th className="p-3">Tentative Date</th>
                      <th className="p-3">Tentative Venue</th>
                      <th className="p-3">Budget Range</th>
                      <th className="p-3">Sales Exec &amp; Role</th>
                      <th className="p-3">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/60 transition">
                        <td className="p-3 font-bold text-blue-400 font-mono">{l.id}</td>
                        <td className="p-3 font-semibold">{l.leadSource.replace(/_/g, ' ')}</td>
                        <td className="p-3">{l.tentativeWeddingDate ? new Date(l.tentativeWeddingDate).toLocaleDateString('en-GB') : 'TBD'}</td>
                        <td className="p-3 font-medium text-slate-200">{l.tentativeVenue || 'TBD'}</td>
                        <td className="p-3 font-extrabold text-emerald-400">{formatLKR(l.budgetRange, false)}</td>
                        <td className="p-3 text-slate-400 font-medium">
                          {l.assignedSalesExec ? `${l.assignedSalesExec.name} (${l.assignedSalesExec.role?.name || 'Sales'})` : 'Unassigned'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${l.stage === 'WON' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                            {l.stage.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Event Bookings & Financial Breakdown */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <span>💍</span>
            <span>Confirmed Event Bookings ({bookings.length})</span>
          </h2>

          {bookings.length === 0 ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center text-slate-400 text-xs font-medium">
              No confirmed event bookings for this customer yet.
            </div>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden space-y-4 p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-sm font-black text-slate-100">
                      Booking ID: <span className="text-blue-400 font-mono">{booking.id}</span> ({booking.packageType.replace(/_/g, ' ')})
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Wedding Date: <span className="font-semibold text-slate-200">{new Date(booking.weddingDate).toLocaleDateString('en-GB')}</span> ({booking.dayOfWeek}) • Managed by: <span className="font-semibold text-indigo-300">{booking.salesExec ? `${booking.salesExec.name} (${booking.salesExec.role?.name || 'Staff'})` : 'Staff'}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30">
                      {booking.paymentStatus.replace(/_/g, ' ')}
                    </span>

                    {canSeeFinancials && (
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Total Contract</div>
                        <div className="text-base font-extrabold text-emerald-400">
                          {formatLKR(booking.totalQuoteAmount)}
                        </div>
                      </div>
                    )}

                    <Link href={`/bookings/${booking.id}`} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition">
                      View Details →
                    </Link>
                  </div>
                </div>

                {/* Payment Stage Timeline */}
                {canSeeFinancials && booking.paymentStages && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Payment Stage Timeline
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {booking.paymentStages.map((stg) => (
                        <div
                          key={stg.id}
                          className={`p-3.5 rounded-xl border ${
                            stg.status === 'PAID'
                              ? 'bg-emerald-950/40 border-emerald-500/30'
                              : stg.status === 'OVERDUE'
                              ? 'bg-rose-950/40 border-rose-500/30'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-200">{stg.stageType}</span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                stg.status === 'PAID'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : stg.status === 'OVERDUE'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {stg.status}
                            </span>
                          </div>
                          <div className="text-sm font-extrabold text-slate-100">
                            Due: {formatLKR(stg.amountDue)}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Deadline: {new Date(stg.dueDate).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── AUTOMATED CREATE LEAD MODAL ────────────────────────────────────── */}
      {showCreateLeadModal && (
        <AutomatedCreateLeadModal
          customer={customer}
          onClose={() => setShowCreateLeadModal(false)}
          onSuccess={() => {
            setShowCreateLeadModal(false);
            fetchCustomerDetail();
          }}
        />
      )}
    </div>
  );
}

// Automated Lead Creator Modal Component
function AutomatedCreateLeadModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: CustomerDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    customerId: customer.id,
    tentativeWeddingDate: '2026-11-15',
    tentativeVenue: 'Shangri-La Colombo',
    estimatedGuestCount: '400',
    budgetRange: '1500000',
    leadSource: 'INSTAGRAM_DM',
    stage: 'NEW_INQUIRY',
    interestNotes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create lead');
      }
    } catch (error) {
      setError('An error occurred while creating lead.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-lg font-black text-slate-100 flex items-center space-x-2">
              <span>⚡</span>
              <span>Automated Lead Creation</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically pre-filled for <strong className="text-slate-200">{customer.name}</strong> ({customer.customerId || customer.customer_id})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 text-red-300 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* Customer (Disabled/Pre-filled) */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">Target Customer Profile</label>
            <input
              type="text"
              disabled
              value={`${customer.name} (${customer.customerId || customer.customer_id}) - ${customer.phone}`}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-400 font-bold"
            />
          </div>

          {/* Wedding Date & Venue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Tentative Wedding Date</label>
              <input
                type="date"
                required
                value={formData.tentativeWeddingDate}
                onChange={(e) => setFormData({ ...formData, tentativeWeddingDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Tentative Venue</label>
              <input
                type="text"
                required
                placeholder="e.g. Shangri-La Colombo"
                value={formData.tentativeVenue}
                onChange={(e) => setFormData({ ...formData, tentativeVenue: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Guests & Budget Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Estimated Guests</label>
              <input
                type="number"
                placeholder="e.g. 400"
                value={formData.estimatedGuestCount}
                onChange={(e) => setFormData({ ...formData, estimatedGuestCount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Estimated Budget Range (LKR)</label>
              <input
                type="number"
                placeholder="e.g. 1500000"
                value={formData.budgetRange}
                onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Lead Source & Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Lead Channel Source</label>
              <select
                value={formData.leadSource}
                onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="INSTAGRAM_DM">Instagram DM</option>
                <option value="FACEBOOK_PAGE">Facebook Page</option>
                <option value="WHATSAPP">WhatsApp Inquiry</option>
                <option value="PHONE">Direct Call</option>
                <option value="WALK_IN">Walk-in</option>
                <option value="REFERRAL">Client Referral</option>
                <option value="WEBSITE">Website Form</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Pipeline Stage</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="NEW_INQUIRY">New Inquiry</option>
                <option value="CONTACTED">Contacted</option>
                <option value="SITE_VISIT_SCHEDULED">Site Visit Scheduled</option>
                <option value="PROPOSAL_SENT">Proposal Sent</option>
                <option value="NEGOTIATION">Negotiation</option>
                <option value="WON">Won (Convert to Booking Automatically)</option>
              </select>
            </div>
          </div>

          {/* Submit / Cancel */}
          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 rounded-xl transition shadow disabled:opacity-50"
            >
              {loading ? 'Creating Lead...' : '⚡ Create Lead & Track'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

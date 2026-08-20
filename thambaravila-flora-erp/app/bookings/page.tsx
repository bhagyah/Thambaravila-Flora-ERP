'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { formatLKR } from '@/lib/utils/formatters';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Venue {
  id: string;
  name: string;
  cityArea: string;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
}

interface Booking {
  id: string;
  customerId: string;
  customer: Customer;
  weddingDate: string;
  dayOfWeek: string;
  ceremonyVenue?: Venue | null;
  receptionVenue?: Venue | null;
  packageType: string;
  serviceScope: string;
  totalQuoteAmount: number;
  depositPercent: number;
  depositAmount: number;
  depositPaidDate: string | null;
  balanceDueAmount: number;
  balanceDueDate: string | null;
  paymentStatus: string;
  bookingStatus: string;
  confirmationStatus: 'PENDING' | 'CONFIRMED' | 'NOT_CONFIRMED';
  quotationAttachmentUrl?: string | null;
  quotationAttachmentName?: string | null;
  jobSheetAttachmentUrl?: string | null;
  jobSheetAttachmentName?: string | null;
  quoteOutcomeReason?: string | null;
  daysUntilWedding: number;
  photographerVendor?: Vendor | null;
  decoratorVendor?: Vendor | null;
  catererVendor?: Vendor | null;
}

export default function BookingsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role?.name || '';
  const canCreateBooking = userRole === 'Owner' || userRole === 'Sales Manager';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookingStatus, setSelectedBookingStatus] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [pendingStages, setPendingStages] = useState<Record<string, string>>({});
  const [reopenStages, setReopenStages] = useState<Record<string, string>>({});
  const [deletingBooking, setDeletingBooking] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [saveBookingError, setSaveBookingError] = useState('');

  const handleDeleteSubmit = async () => {
    if (!deletingBooking || !deleteReason.trim()) return;
    try {
      setIsDeleting(true);
      const res = await fetch('/api/bookings/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: deletingBooking.id,
          reason: deleteReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Deletion request submitted for Owner approval');
        setDeletingBooking(null);
        setDeleteReason('');
        fetchBookings();
      } else {
        alert(data.error || 'Failed to submit deletion request');
      }
    } catch (err) {
      alert('Error processing deletion request');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeclineQuote = async (booking: Booking) => {
    const reason = window.prompt('Reason for declining this quote?', booking.quoteOutcomeReason || 'Client does not want to proceed');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DECLINE_QUOTE',
          bookingStatus: 'CANCELLED',
          confirmationStatus: 'NOT_CONFIRMED',
          quoteOutcomeReason: reason.trim() || 'Quote declined',
        }),
      });

      if (res.ok) {
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to decline quote');
      }
    } catch (e) {
      alert('Failed to decline quote');
    }
  };

  const handleReopenQuote = async (booking: Booking, targetStageKey: string = 'IN_DESIGN') => {
    const stageNames: Record<string, string> = {
      INQUIRY: '1. Initial Meeting & Consultation',
      IN_DESIGN: '2. Design & Quote Stage',
      CONFIRMED: '3. Approved & Confirmed',
      IN_PRODUCTION: '4. Flower Prep',
      DELIVERED: '5. On-Site Setup',
      COMPLETED: '6. Event Completed',
    };

    if (!window.confirm(`Reopen quotation for ${booking.customer.name} (${booking.id}) and move to "${stageNames[targetStageKey] || targetStageKey}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REOPEN_QUOTE',
          bookingStatus: targetStageKey,
          confirmationStatus: ['CONFIRMED', 'IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(targetStageKey) ? 'CONFIRMED' : 'PENDING',
        }),
      });

      if (res.ok) {
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reopen quote');
      }
    } catch (e) {
      alert('Failed to reopen quote');
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    weddingDate: new Date().toISOString().split('T')[0],
    ceremonyVenueId: '',
    receptionVenueId: '',
    ceremonyTime: '10:00 AM',
    receptionTime: '06:30 PM',
    floristSetupTime: '06:00 AM',
    guestCount: '300',
    packageType: 'CLASSIC_ELEGANCE',
    serviceScope: 'FULL_WEDDING_PACKAGE',
    colourTheme: 'Rose Gold & Cream',
    totalQuoteAmount: '250000',
    depositPercent: '30',
    bookingStatus: 'INQUIRY',
    photographerVendorId: '',
    decoratorVendorId: '',
    catererVendorId: '',
    notes: '',
  });

  const packageTypes = [
    { value: 'ESSENTIAL_BLOOM', label: 'Essential Bloom' },
    { value: 'CLASSIC_ELEGANCE', label: 'Classic Elegance' },
    { value: 'PREMIUM_BLOOM_PACKAGE', label: 'Premium Bloom Package' },
    { value: 'SIGNATURE_LUXURY', label: 'Signature Luxury' },
    { value: 'BESPOKE_CUSTOM', label: 'Bespoke / Custom' },
  ];

  const serviceScopes = [
    { value: 'CEREMONY_ONLY', label: 'Ceremony Only' },
    { value: 'RECEPTION_ONLY', label: 'Reception Only' },
    { value: 'CEREMONY_RECEPTION', label: 'Ceremony + Reception' },
    { value: 'HOME_GOING', label: 'Home-going' },
    { value: 'ENGAGEMENT', label: 'Engagement' },
    { value: 'FULL_WEDDING_PACKAGE', label: 'Full Wedding Package' },
  ];

  const paymentStatuses = [
    'NOT_STARTED', 'DEPOSIT_DUE', 'DEPOSIT_PAID', 'PARTIAL_PAYMENT', 'PAID_IN_FULL', 'OVERDUE'
  ];

  const bookingStatuses = [
    'INQUIRY', 'CONFIRMED', 'IN_DESIGN', 'IN_PRODUCTION', 'DELIVERED', 'COMPLETED', 'CANCELLED'
  ];

  useEffect(() => {
    if (session) {
      fetchBookings();
      fetchDropdowns();
    }
  }, [session]);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (e) {
      console.error('Failed to load bookings', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [cRes, vRes, venRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/venues'),
        fetch('/api/vendors'),
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        const list = cData.customers || cData;
        setCustomers(list);
        if (list.length > 0) setFormData(p => ({ ...p, customerId: list[0].id }));
      }

      if (vRes.ok) {
        const vData = await vRes.json();
        setVenues(vData);
      }

      if (venRes.ok) {
        const venData = await venRes.json();
        setVendors(venData.vendors || venData);
      }
    } catch (e) {
      console.error('Failed to load dropdown options', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBooking(true);
    setSaveBookingError('');

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        fetchBookings();
        return;
      }

      const data = await res.json().catch(() => null);
      setSaveBookingError(data?.error || 'Failed to create booking.');
    } catch (e) {
      console.error('Failed to create booking', e);
      setSaveBookingError('Failed to create booking. Check the server connection and try again.');
    } finally {
      setIsSavingBooking(false);
    }
  };

  const filteredBookings = bookings.filter(b => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
                          b.id.toLowerCase().includes(searchLower) ||
                          (b.customer?.name && b.customer.name.toLowerCase().includes(searchLower)) ||
                          (b.ceremonyVenue?.name && b.ceremonyVenue.name.toLowerCase().includes(searchLower));
    const matchesBooking = selectedBookingStatus === 'ALL' || b.bookingStatus === selectedBookingStatus;
    const matchesPayment = selectedPaymentStatus === 'ALL' || b.paymentStatus === selectedPaymentStatus;
    return matchesSearch && matchesBooking && matchesPayment;
  });



  const getPaymentBadgeClass = (status: string) => {
    switch (status) {
      case 'PAID_IN_FULL': return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'PARTIAL_PAYMENT': return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
      case 'DEPOSIT_PAID': return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'DEPOSIT_DUE': return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'OVERDUE': return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/95 border border-slate-700 p-6 rounded-xl shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-slate-50 tracking-wide">Event Bookings</h1>
            <p className="text-slate-300 text-sm mt-1">
              Post-conversion wedding bookings, venue assignments, deposit breakdown, and payment status rollups.
            </p>
          </div>

          {canCreateBooking && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-lg shadow transition flex items-center justify-center space-x-2"
            >
              <span>+ Create Direct Booking</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search booking ID, client name, venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900/95 border border-slate-700 px-4 py-2.5 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-400"
          />

          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="bg-slate-900/95 border border-slate-700 px-4 py-2.5 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-400"
          >
            <option value="ALL">All Payment Statuses</option>
            {paymentStatuses.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={selectedBookingStatus}
            onChange={(e) => setSelectedBookingStatus(e.target.value)}
            className="bg-slate-900/95 border border-slate-700 px-4 py-2.5 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-400"
          >
            <option value="ALL">All Booking Statuses</option>
            {bookingStatuses.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-400 flex items-center justify-between">
            <span>Confirmed Bookings:</span>
            <span className="font-bold text-teal-400">{filteredBookings.length}</span>
          </div>
        </div>

        {/* Booking Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading event bookings...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-12 text-center text-slate-300">
            No bookings found. Convert a Lead from the Lead Pipeline or create a direct booking!
          </div>
        ) : (
          <div className="bg-slate-900/95 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-100">
                <thead className="bg-slate-950/90 text-slate-300 font-semibold border-b border-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Booking ID</th>
                    <th className="p-3.5">Client Name</th>
                    <th className="p-3.5">Wedding Date</th>
                    <th className="p-3.5">Day</th>
                    <th className="p-3.5">Ceremony Venue</th>
                    <th className="p-3.5">Package</th>
                    <th className="p-3.5">Total Quote</th>
                    <th className="p-3.5">Deposit (30%)</th>
                    <th className="p-3.5">Balance Due</th>
                    <th className="p-3.5">Payment Status</th>
                    <th className="p-3.5">Job Stage</th>
                    <th className="p-3.5">Days Away</th>
                    <th className="p-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/55 transition">
                      <td className="p-3.5 font-bold text-teal-300">{b.id}</td>
                      <td className="p-3.5 font-semibold text-slate-50">{b.customer.name}</td>
                      <td className="p-3.5 text-slate-200">{new Date(b.weddingDate).toLocaleDateString()}</td>
                      <td className="p-3.5 text-slate-300">{b.dayOfWeek}</td>
                      <td className="p-3.5 text-slate-200">{b.ceremonyVenue?.name || 'TBD'}</td>
                      <td className="p-3.5 font-medium text-slate-100">{b.packageType.replace('_', ' ')}</td>
                      <td className="p-3.5 font-bold text-slate-100">{formatLKR(b.totalQuoteAmount)}</td>
                      <td className="p-3.5 font-semibold text-emerald-300">{formatLKR(b.depositAmount)}</td>
                      <td className="p-3.5 font-semibold text-amber-300">{formatLKR(b.balanceDueAmount)}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getPaymentBadgeClass(b.paymentStatus)}`}>
                          {b.paymentStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {b.bookingStatus === 'CANCELLED' ? (
                          <div className="flex flex-col gap-1.5 min-w-[170px]">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-950/80 text-rose-300 border border-rose-800 text-center">
                              ✕ Quote Declined
                            </span>
                            <select
                              value={reopenStages[b.id] || 'IN_DESIGN'}
                              onChange={(e) => setReopenStages(prev => ({ ...prev, [b.id]: e.target.value }))}
                              className="bg-slate-950 border border-slate-700 rounded-lg text-[10px] font-bold p-1 text-slate-100 focus:outline-none focus:border-amber-500"
                            >
                              <option value="INQUIRY">1. Initial Meeting</option>
                              <option value="IN_DESIGN">2. Design &amp; Quote</option>
                              <option value="CONFIRMED">3. Approved &amp; Confirmed</option>
                              <option value="IN_PRODUCTION">4. Flower Prep</option>
                              <option value="DELIVERED">5. On-Site Setup</option>
                              <option value="COMPLETED">6. Event Completed</option>
                            </select>
                            <button
                              onClick={() => handleReopenQuote(b, reopenStages[b.id] || 'IN_DESIGN')}
                              className="py-1 px-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold text-[10px] rounded-md shadow transition flex items-center justify-center space-x-1"
                            >
                              <span>🔄</span>
                              <span>Reopen to Selected Stage</span>
                            </button>
                          </div>
                        ) : (
                          (() => {
                            const stagesList = ['INQUIRY', 'IN_DESIGN', 'CONFIRMED', 'IN_PRODUCTION', 'DELIVERED', 'COMPLETED'];
                            const currentIdx = stagesList.indexOf(b.bookingStatus);
                            const activeVal = pendingStages[b.id] || b.bookingStatus;
                            const isPending = pendingStages[b.id] && pendingStages[b.id] !== b.bookingStatus;

                            return (
                              <div className="flex flex-col gap-1 min-w-[170px]">
                                <select
                                  value={activeVal}
                                  onChange={(e) => setPendingStages(prev => ({ ...prev, [b.id]: e.target.value }))}
                                  className={`bg-slate-950 border rounded-lg text-[11px] font-extrabold p-1 focus:outline-none ${
                                    isPending ? 'border-amber-400 text-amber-200 ring-1 ring-amber-400/50' : 'border-slate-700 text-slate-100'
                                  }`}
                                >
                                  <option value="INQUIRY" disabled={userRole !== 'Owner' && Math.abs(0 - currentIdx) > 1}>
                                    1. Initial Meeting {userRole !== 'Owner' && Math.abs(0 - currentIdx) > 1 ? '🔒' : ''}
                                  </option>
                                  <option value="IN_DESIGN" disabled={userRole !== 'Owner' && Math.abs(1 - currentIdx) > 1}>
                                    2. Design &amp; Quote {userRole !== 'Owner' && Math.abs(1 - currentIdx) > 1 ? '🔒' : ''}
                                  </option>
                                  <option value="CONFIRMED" disabled={userRole !== 'Owner' && Math.abs(2 - currentIdx) > 1}>
                                    3. Approved &amp; Confirmed {userRole !== 'Owner' && Math.abs(2 - currentIdx) > 1 ? '🔒' : ''}
                                  </option>
                                  <option value="IN_PRODUCTION" disabled={userRole !== 'Owner' && Math.abs(3 - currentIdx) > 1}>
                                    4. Flower Prep {userRole !== 'Owner' && Math.abs(3 - currentIdx) > 1 ? '🔒' : ''}
                                  </option>
                                  <option value="DELIVERED" disabled={userRole !== 'Owner' && Math.abs(4 - currentIdx) > 1}>
                                    5. On-Site Setup {userRole !== 'Owner' && Math.abs(4 - currentIdx) > 1 ? '🔒' : ''}
                                  </option>
                                  <option value="COMPLETED" disabled={userRole !== 'Owner' && Math.abs(5 - currentIdx) > 1}>
                                    6. Event Completed {userRole !== 'Owner' && Math.abs(5 - currentIdx) > 1 ? '🔒' : ''}
                                  </option>
                                </select>

                                <div className="flex flex-wrap gap-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      b.confirmationStatus === 'CONFIRMED'
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                        : b.confirmationStatus === 'NOT_CONFIRMED'
                                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    }`}
                                  >
                                    {b.confirmationStatus === 'CONFIRMED'
                                      ? 'Confirmed'
                                      : b.confirmationStatus === 'NOT_CONFIRMED'
                                      ? 'Not confirmed'
                                      : 'Pending'}
                                  </span>
                                </div>

                                {isPending && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={async () => {
                                        const newStage = pendingStages[b.id];
                                        try {
                                          const res = await fetch(`/api/bookings/${b.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ bookingStatus: newStage }),
                                          });
                                          if (res.ok) {
                                            fetchBookings();
                                            setPendingStages(prev => {
                                              const copy = { ...prev };
                                              delete copy[b.id];
                                              return copy;
                                            });
                                          } else {
                                            const d = await res.json();
                                            alert(d.error || 'Failed to update stage');
                                          }
                                        } catch (err) {
                                          alert('Failed to update stage');
                                        }
                                      }}
                                      className="flex-1 py-0.5 text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow"
                                    >
                                      ✓ Approve
                                    </button>
                                    <button
                                      onClick={() => {
                                        setPendingStages(prev => {
                                          const copy = { ...prev };
                                          delete copy[b.id];
                                          return copy;
                                        });
                                      }}
                                      className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`font-semibold ${b.daysUntilWedding < 14 ? 'text-rose-300' : 'text-slate-200'}`}>
                          {b.daysUntilWedding > 0 ? `${b.daysUntilWedding} Days` : 'Passed'}
                        </span>
                      </td>
                      <td className="p-3.5 space-y-1 text-center">
                        <Link href={`/bookings/${b.id}`} className="inline-block px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-200 font-semibold rounded text-[11px] border border-slate-700">
                          View Details →
                        </Link>
                        {b.quotationAttachmentUrl && (
                          <a
                            href={b.quotationAttachmentUrl}
                            download={b.quotationAttachmentName || `${b.id}-quotation.pdf`}
                            className="inline-block px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 font-semibold rounded text-[11px] border border-emerald-700/50"
                          >
                            View Quotation
                          </a>
                        )}
                        {b.bookingStatus === 'CANCELLED' ? (
                          <button
                            onClick={() => handleReopenQuote(b)}
                            className="inline-block px-2.5 py-1 bg-amber-950/70 hover:bg-amber-900 text-amber-200 font-semibold rounded text-[11px] border border-amber-700/50"
                          >
                            🔄 Reopen Quote
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeclineQuote(b)}
                            className="inline-block px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-200 font-semibold rounded text-[11px] border border-rose-700/50"
                          >
                            Mark Quote Declined
                          </button>
                        )}
                        <div>
                          {(b as any).hasPendingDeletion ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-500/30">
                              ⏳ Deletion Pending
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setDeletingBooking(b);
                                setDeleteReason('');
                              }}
                              className="px-2 py-0.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 font-semibold rounded text-[10px] border border-rose-700/50"
                              title="Delete Booking"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Booking Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <h2 className="text-lg font-bold text-slate-50">Create Event Booking</h2>
                <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {saveBookingError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-200">
                    {saveBookingError}
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Customer *</label>
                  <select
                    required
                    value={formData.customerId}
                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Wedding Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.weddingDate}
                      onChange={e => setFormData({ ...formData, weddingDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Total Quote Amount (LKR) *</label>
                    <input
                      type="number"
                      required
                      value={formData.totalQuoteAmount}
                      onChange={e => setFormData({ ...formData, totalQuoteAmount: e.target.value })}
                      placeholder="250000"
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">Enter rupees only. Example: 50000000 for LKR 50,000,000.</p>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Package Type *</label>
                    <select
                      value={formData.packageType}
                      onChange={e => setFormData({ ...formData, packageType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    >
                      {packageTypes.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Service Scope *</label>
                    <select
                      value={formData.serviceScope}
                      onChange={e => setFormData({ ...formData, serviceScope: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    >
                      {serviceScopes.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Ceremony Venue (Dropdown)</label>
                    <select
                      value={formData.ceremonyVenueId}
                      onChange={e => setFormData({ ...formData, ceremonyVenueId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    >
                      <option value="">Select Partner Venue...</option>
                      {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.cityArea})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Reception Venue (Dropdown)</label>
                    <select
                      value={formData.receptionVenueId}
                      onChange={e => setFormData({ ...formData, receptionVenueId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    >
                      <option value="">Select Partner Venue...</option>
                      {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.cityArea})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Photographer Vendor</label>
                    <select
                      value={formData.photographerVendorId}
                      onChange={e => setFormData({ ...formData, photographerVendorId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    >
                      <option value="">Select Vendor...</option>
                      {vendors.filter(v => v.category === 'Photographer' || v.category === 'Other').map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Decorator Vendor</label>
                    <select
                      value={formData.decoratorVendorId}
                      onChange={e => setFormData({ ...formData, decoratorVendorId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    >
                      <option value="">Select Vendor...</option>
                      {vendors.filter(v => v.category === 'Decorator-Coordinator' || v.category === 'Florist Wholesaler').map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Caterer Vendor</label>
                    <select
                      value={formData.catererVendorId}
                      onChange={e => setFormData({ ...formData, catererVendorId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-slate-50"
                    >
                      <option value="">Select Vendor...</option>
                      {vendors.filter(v => v.category === 'Caterer' || v.category === 'Other').map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBooking}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded"
                  >
                    {isSavingBooking ? 'Saving...' : 'Save Booking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Booking Modal */}
        {deletingBooking && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <h2 className="text-lg font-bold text-rose-300">
                  {userRole === 'Owner' ? 'Delete Booking' : 'Request Booking Deletion'}
                </h2>
                <button onClick={() => setDeletingBooking(null)} className="text-slate-300 hover:text-white">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-200">
                  Booking ID: <span className="font-bold text-blue-400 font-mono">{deletingBooking.id}</span>
                </p>
                <p className="text-slate-200">
                  Client: <span className="font-bold text-slate-50">{deletingBooking.customer?.name}</span>
                </p>

                {userRole === 'Owner' ? (
                  <p className="text-rose-200 font-medium">
                    ⚠️ As Owner, confirming this will permanently delete this booking immediately.
                  </p>
                ) : (
                  <p className="text-amber-200 font-medium">
                    ⚠️ Requesting deletion will send a notification to the **Owner** for mandatory approval before the booking can be removed.
                  </p>
                )}

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Reason for Deletion *</label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Enter reason for deleting this booking (e.g. Client cancelled, Duplicate entry)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-50 focus:outline-none focus:border-rose-400 h-24"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingBooking(null)}
                    className="px-4 py-2 bg-slate-800 text-slate-100 font-semibold rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting || !deleteReason.trim()}
                    onClick={handleDeleteSubmit}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow disabled:opacity-50"
                  >
                    {isDeleting
                      ? 'Processing...'
                      : userRole === 'Owner'
                      ? '🗑️ Confirm & Delete Now'
                      : '📩 Submit Request to Owner'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

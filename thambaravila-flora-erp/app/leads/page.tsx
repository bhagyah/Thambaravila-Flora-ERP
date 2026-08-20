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

interface Lead {
  id: string;
  customerId: string;
  customer: Customer;
  inquiryDate: string;
  tentativeWeddingDate: string | null;
  tentativeVenue: string | null;
  estimatedGuestCount: number | null;
  budgetRange: string | null;
  leadSource: string;
  stage: string;
  nextFollowupDate: string | null;
  assignedSalesExecId: string | null;
  assignedSalesExec?: { name: string };
  interestNotes: string | null;
  converted: boolean;
  isSynthetic?: boolean;
  bookings?: { id: string; paymentStatus: string; bookingStatus: string }[];
}

export default function LeadsPage() {
  const { data: session } = useSession();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    customerId: '',
    inquiryDate: new Date().toISOString().split('T')[0],
    tentativeWeddingDate: '',
    tentativeVenue: '',
    estimatedGuestCount: '',
    budgetRange: '150000',
    leadSource: 'INSTAGRAM_DM',
    stage: 'NEW_INQUIRY',
    nextFollowupDate: '',
    interestNotes: '',
  });

  const leadSources = [
    { value: 'INSTAGRAM_DM', label: 'Instagram DM' },
    { value: 'FACEBOOK', label: 'Facebook' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'REFERRAL', label: 'Referral' },
    { value: 'WEDDING_PLANNER_PARTNER', label: 'Wedding Planner Partner' },
    { value: 'WALK_IN', label: 'Walk-in' },
    { value: 'WEBSITE', label: 'Website' },
    { value: 'GOOGLE_SEARCH', label: 'Google Search' },
    { value: 'BRIDAL_FAIR', label: 'Bridal Fair' },
    { value: 'DIRECT_BOOKING', label: 'Direct Booking' },
  ];

  const leadStages = [
    { value: 'NEW_INQUIRY', label: 'New Inquiry' },
    { value: 'CONTACTED', label: 'Contacted' },
    { value: 'SITE_VISIT_SCHEDULED', label: 'Site Visit Scheduled' },
    { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
    { value: 'NEGOTIATION', label: 'Negotiation' },
    { value: 'WON', label: 'Won (Convert to Booking)' },
    { value: 'LOST', label: 'Lost' },
  ];

  useEffect(() => {
    if (session) {
      fetchLeads();
      fetchCustomers();
    }
  }, [session]);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (e) {
      console.error('Failed to load leads', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        const list = data.customers || data;
        setCustomers(list);
        if (list.length > 0) {
          setFormData(prev => ({ ...prev, customerId: list[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load customers', e);
    }
  };

  const handleStageChange = async (leadId: string, newStage: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });

      if (res.ok) {
        fetchLeads();
      }
    } catch (e) {
      console.error('Failed to update stage', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        fetchLeads();
      }
    } catch (e) {
      console.error('Failed to create lead', e);
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (l.tentativeVenue && l.tentativeVenue.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStage = selectedStage === 'ALL' || l.stage === selectedStage;
    const matchesSource = selectedSource === 'ALL' || l.leadSource === selectedSource;
    return matchesSearch && matchesStage && matchesSource;
  });



  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'NEW_INQUIRY': return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'CONTACTED': return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
      case 'SITE_VISIT_SCHEDULED': return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      case 'PROPOSAL_SENT': return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'NEGOTIATION': return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
      case 'WON': return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'LOST': return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Lead Pipeline</h1>
            <p className="text-slate-400 text-sm mt-1">
              Pre-conversion inquiry tracking. Setting a Lead&apos;s stage to &quot;Won&quot; automatically converts it to an Event Booking.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-lg shadow transition flex items-center justify-center space-x-2"
          >
            <span>+ Create New Lead</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search lead ID, client name, or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
          />

          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Stages</option>
            {leadStages.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Lead Sources</option>
            {leadSources.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-400 flex items-center justify-between">
            <span>Total Active Leads:</span>
            <span className="font-bold text-teal-400">{filteredLeads.length}</span>
          </div>
        </div>

        {/* Lead Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            No leads found matching criteria. Click &quot;Create New Lead&quot; to add one!
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Lead / Booking ID</th>
                    <th className="p-3.5">Client Name</th>
                    <th className="p-3.5">Source</th>
                    <th className="p-3.5">Wedding Date</th>
                    <th className="p-3.5">Tentative Venue</th>
                    <th className="p-3.5">Guests</th>
                    <th className="p-3.5">Budget</th>
                    <th className="p-3.5">Stage</th>
                    <th className="p-3.5">Next Follow-Up</th>
                    <th className="p-3.5">Converted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-teal-400">{lead.id}</td>
                      <td className="p-3.5 font-semibold text-slate-100">{lead.customer.name}</td>
                      <td className="p-3.5">
                        <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-medium text-slate-300">
                          {lead.leadSource.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {lead.tentativeWeddingDate ? new Date(lead.tentativeWeddingDate).toLocaleDateString() : 'TBD'}
                      </td>
                      <td className="p-3.5 text-slate-300">{lead.tentativeVenue || 'TBD'}</td>
                      <td className="p-3.5 text-slate-300">{lead.estimatedGuestCount || 'N/A'}</td>
                      <td className="p-3.5 font-semibold text-emerald-400">{formatLKR(lead.budgetRange, false)}</td>
                      <td className="p-3.5">
                        <select
                          value={lead.stage}
                          disabled={lead.isSynthetic}
                          onChange={(e) => handleStageChange(lead.id, e.target.value)}
                          className={`border px-2 py-1 rounded text-xs font-semibold focus:outline-none ${getStageBadgeClass(lead.stage)}`}
                        >
                          {leadStages.map(s => (
                            <option key={s.value} value={s.value} className="bg-slate-900 text-slate-100">{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {lead.nextFollowupDate ? new Date(lead.nextFollowupDate).toLocaleDateString() : 'None'}
                      </td>
                      <td className="p-3.5">
                        {lead.converted || (lead.bookings && lead.bookings.length > 0) ? (
                          <Link href={`/bookings/${lead.bookings?.[0]?.id || ''}`} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30">
                            ✓ Booking ({lead.bookings?.[0]?.id || 'Linked'})
                          </Link>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Pre-Booking</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-slate-100">Create New Lead</h2>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Customer *</label>
                  <select
                    required
                    value={formData.customerId}
                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Lead Source *</label>
                    <select
                      value={formData.leadSource}
                      onChange={e => setFormData({ ...formData, leadSource: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                    >
                      {leadSources.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Current Stage *</label>
                    <select
                      value={formData.stage}
                      onChange={e => setFormData({ ...formData, stage: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                    >
                      {leadStages.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Tentative Wedding Date</label>
                    <input
                      type="date"
                      value={formData.tentativeWeddingDate}
                      onChange={e => setFormData({ ...formData, tentativeWeddingDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Tentative Venue</label>
                    <input
                      type="text"
                      value={formData.tentativeVenue}
                      onChange={e => setFormData({ ...formData, tentativeVenue: e.target.value })}
                      placeholder="e.g. Shangri-La Colombo"
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Estimated Guest Count</label>
                    <input
                      type="number"
                      value={formData.estimatedGuestCount}
                      onChange={e => setFormData({ ...formData, estimatedGuestCount: e.target.value })}
                      placeholder="e.g. 350"
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Estimated Budget (LKR)</label>
                    <input
                      type="number"
                      value={formData.budgetRange}
                      onChange={e => setFormData({ ...formData, budgetRange: e.target.value })}
                      placeholder="150000"
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Enter rupees only, not cents.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Next Follow-Up Date</label>
                  <input
                    type="date"
                    value={formData.nextFollowupDate}
                    onChange={e => setFormData({ ...formData, nextFollowupDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Interest & Decor Notes</label>
                  <textarea
                    rows={2}
                    value={formData.interestNotes}
                    onChange={e => setFormData({ ...formData, interestNotes: e.target.value })}
                    placeholder="Wants pastel blush roses and gold arches..."
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded"
                  >
                    Save Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

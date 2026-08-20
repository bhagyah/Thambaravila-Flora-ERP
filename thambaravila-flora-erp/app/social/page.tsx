'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface SocialCampaign {
  id: string;
  title: string;
  platform: string;
  startDate: string;
  budget: number;
  status: string;
}

export default function SocialMediaPage() {
  const { data: session } = useSession();
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [socialEnquiries, setSocialEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Lead Capture Modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (session) {
      fetchSocialData();
    }
  }, [session]);

  const fetchSocialData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/social');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setSocialEnquiries(data.socialEnquiries || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLeadCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const quoteCents = Math.round(parseFloat(quoteAmount) * 100);

      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LEAD_CAPTURE',
          name,
          phone,
          email,
          quoteAmount: quoteCents,
          eventDate: eventDate || null,
        }),
      });

      if (res.ok) {
        setMessage('Lead captured successfully! Customer & enquiry created with 3 payment stages.');
        setShowLeadModal(false);
        setName('');
        setPhone('');
        setEmail('');
        setQuoteAmount('');
        fetchSocialData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Social Media Manager Module</h1>
          <p className="text-slate-500 text-sm mt-1">Campaign tracking, lead capture form, and social pipeline conversions.</p>
        </div>
        <button
          onClick={() => setShowLeadModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-semibold rounded-lg shadow-sm text-sm transition"
        >
          + Social Lead Capture
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold">
          ✓ {message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Social Leads Captured</span>
          <div className="text-3xl font-black text-pink-600 mt-2">{socialEnquiries.length}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Campaigns</span>
          <div className="text-3xl font-black text-slate-900 mt-2">{campaigns.length}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Primary Channel</span>
          <div className="text-2xl font-black text-purple-600 mt-2">Instagram</div>
        </div>
      </div>

      {/* Social Enquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Captured Social Leads Pipeline</h3>

        {socialEnquiries.length === 0 ? (
          <p className="text-slate-500 text-sm">No social leads recorded yet. Click "+ Social Lead Capture" to add one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Customer ID</th>
                  <th className="px-4 py-3 text-left font-bold">Name</th>
                  <th className="px-4 py-3 text-left font-bold">Phone</th>
                  <th className="px-4 py-3 text-left font-bold">Event Date</th>
                  <th className="px-4 py-3 text-right font-bold">Quote (LKR)</th>
                  <th className="px-4 py-3 text-left font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {socialEnquiries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-teal-600">{e.customer?.customerId}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{e.customer?.name}</td>
                    <td className="px-4 py-3 text-slate-600">{e.customer?.phone}</td>
                    <td className="px-4 py-3 text-slate-500">{e.eventDate ? new Date(e.eventDate).toLocaleDateString() : 'TBD'}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      LKR {(e.totalQuoteAmount / 100).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-pink-100 text-pink-800 text-xs font-bold rounded-full">
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead Capture Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Social Lead Capture Form</h2>

            <form onSubmit={handleLeadCapture} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Event Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quoted Package Amount (LKR)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 300000"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeadModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Creating Lead...' : 'Save Lead & Create Stages'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

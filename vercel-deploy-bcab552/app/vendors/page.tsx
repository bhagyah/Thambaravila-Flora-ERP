'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface VendorItem {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  category: string;
  areaServed: string | null;
  reliabilityRating: number | null;
  notes: string | null;
  status: string;
  payments: Array<{ id: string; amount: number; status: string }>;
}

const EMPTY_FORM = {
  name: '', contactPerson: '', phone: '', email: '',
  category: 'Flower Supplier', areaServed: '', reliabilityRating: '5', notes: '', status: 'ACTIVE',
};

const CATEGORIES = [
  'Flower Supplier', 'Decor Rental', 'Lighting', 'Transport', 'Photographer',
  'Decorator-Coordinator', 'Caterer', 'Florist Wholesaler', 'Other',
];

export default function VendorsPage() {
  const { data: session } = useSession();
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<VendorItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (session) fetchVendors();
  }, [session]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vendors');
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingVendor(null);
    setFormData(EMPTY_FORM);
    setFeedback(null);
    setShowModal(true);
  };

  const openEdit = (v: VendorItem) => {
    setEditingVendor(v);
    setFormData({
      name: v.name, contactPerson: v.contactPerson ?? '', phone: v.phone,
      email: v.email ?? '', category: v.category, areaServed: v.areaServed ?? '',
      reliabilityRating: v.reliabilityRating?.toString() ?? '5',
      notes: v.notes ?? '', status: v.status,
    });
    setFeedback(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const isEdit = !!editingVendor;
      const url = isEdit ? `/api/vendors/${editingVendor!.id}` : '/api/vendors';
      const method = isEdit ? 'PATCH' : 'POST';

      const body = isEdit
        ? formData
        : { action: 'CREATE_VENDOR', ...formData };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        fetchVendors();
      } else {
        const d = await res.json();
        setFeedback({ text: d.error || 'Failed to save vendor', type: 'error' });
      }
    } catch {
      setFeedback({ text: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vendors/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchVendors();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete vendor');
      }
    } catch { alert('An unexpected error occurred.'); }
    finally { setDeleting(false); }
  };

  const f = (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData(p => ({ ...p, [k]: e.target.value }));

  const filtered = vendors.filter(v => {
    const q = searchQuery.toLowerCase();
    return (v.name.toLowerCase().includes(q) || (v.contactPerson ?? '').toLowerCase().includes(q)) &&
      (selectedCategory === 'ALL' || v.category === selectedCategory);
  });

  const ratingColor = (r: number | null) => {
    if (!r || r >= 4) return 'text-emerald-400';
    if (r >= 3) return 'text-amber-400';
    return 'text-rose-400';
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Vendor &amp; Supplier Directory</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage flower suppliers, rental partners, and all vendor accounts.
            </p>
          </div>
          <button onClick={openAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-bold rounded-lg shadow transition flex items-center space-x-2">
            <span>+ Add Vendor</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Search by name or contact..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500" />
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500">
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-400 flex items-center justify-between">
            <span>Total Vendors:</span>
            <span className="font-bold text-violet-400">{filtered.length}</span>
          </div>
        </div>

        {/* Vendors Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading vendor directory...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            No vendors found. Click &quot;+ Add Vendor&quot; to register your first supplier!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(v => (
              <div key={v.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                        {v.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-100 mt-2 truncate">{v.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        📞 {v.phone}{v.contactPerson ? ` · ${v.contactPerson}` : ''}
                      </p>
                      {v.email && <p className="text-xs text-slate-500 mt-0.5">✉ {v.email}</p>}
                      {v.areaServed && <p className="text-xs text-slate-500 mt-0.5">📍 {v.areaServed}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-black ${ratingColor(v.reliabilityRating)}`}>
                        ★ {v.reliabilityRating ?? 5}/5
                      </span>
                      <div className={`text-[10px] mt-1 font-bold ${v.status === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {v.status === 'ACTIVE' ? '● Active' : '○ Inactive'}
                      </div>
                    </div>
                  </div>

                  {v.notes && (
                    <p className="mt-3 text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded p-2.5 leading-relaxed">
                      {v.notes}
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[10px] text-slate-500">
                    {v.payments?.length || 0} payment record(s)
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(v)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-violet-300 border border-slate-700 transition flex items-center justify-center gap-1">
                      ✏️ Edit
                    </button>
                    <button onClick={() => setDeleteTarget(v)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-slate-700 hover:border-rose-700 transition flex items-center justify-center gap-1">
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">
                {editingVendor ? `✏️ Edit — ${editingVendor.name}` : '+ Add Supplier / Vendor'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            {feedback && (
              <div className={`p-3 rounded-lg text-xs font-bold ${feedback.type === 'error' ? 'bg-rose-950/60 text-rose-300 border border-rose-700' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-700'}`}>
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Company / Vendor Name *</label>
                  <input type="text" required value={formData.name} onChange={f('name')}
                    placeholder="e.g. Nuwara Eliya Fresh Flowers"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Category *</label>
                  <select value={formData.category} onChange={f('category')}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Phone Number *</label>
                  <input type="tel" required value={formData.phone} onChange={f('phone')}
                    placeholder="+94 77 123 4567"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Contact Person</label>
                  <input type="text" value={formData.contactPerson} onChange={f('contactPerson')}
                    placeholder="Rep name"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Email</label>
                  <input type="email" value={formData.email} onChange={f('email')}
                    placeholder="supplier@email.com"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Area Served</label>
                  <input type="text" value={formData.areaServed} onChange={f('areaServed')}
                    placeholder="e.g. Colombo, Kandy"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Reliability Rating (1–5)</label>
                  <input type="number" min="1" max="5" value={formData.reliabilityRating} onChange={f('reliabilityRating')}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500" />
                </div>

                {editingVendor && (
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Status</label>
                    <select value={formData.status} onChange={f('status')}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500">
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Notes / Remarks</label>
                  <textarea rows={3} value={formData.notes} onChange={f('notes')}
                    placeholder="Delivery lead time, quality notes, preferred contact hours..."
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-violet-500" />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-bold rounded text-xs disabled:opacity-50">
                  {submitting ? 'Saving...' : editingVendor ? 'Save Changes' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800/60 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">🗑</div>
              <h3 className="text-lg font-black text-rose-400">Delete Vendor?</h3>
              <p className="text-slate-300 text-sm">
                <span className="font-bold text-white">{deleteTarget.name}</span> will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2 text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

interface Venue {
  id: string;
  name: string;
  cityArea: string;
  fullAddress: string | null;
  venueType: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  maxCapacity: number | null;
  indoorOutdoor: string | null;
  loadInNotes: string | null;
  floralRestrictions: string | null;
  parkingAvailability: string | null;
  powerAccess: string | null;
  inHouseCatering: boolean;
  notesRating: number | null;
  weddingsBookedCount: number;
}

const EMPTY_FORM = {
  name: '', cityArea: '', fullAddress: '', venueType: 'Hotel Ballroom',
  contactPerson: '', phone: '', email: '', maxCapacity: '',
  indoorOutdoor: 'Both', loadInNotes: '', floralRestrictions: '',
  parkingAvailability: 'Ample On-Site', powerAccess: '3-Phase High Power',
  inHouseCatering: false, notesRating: '5.0',
};

const venueTypes = ['Hotel Ballroom', 'Beach Resort', 'Private Villa', 'Banquet Hall', 'Garden', 'Outdoor Lawn', 'Heritage Estate'];

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchVenues(); }, []);

  const fetchVenues = async () => {
    try {
      const res = await fetch('/api/venues');
      if (res.ok) setVenues(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingVenue(null);
    setFormData(EMPTY_FORM);
    setFeedback(null);
    setShowModal(true);
  };

  const openEdit = (v: Venue) => {
    setEditingVenue(v);
    setFormData({
      name: v.name, cityArea: v.cityArea, fullAddress: v.fullAddress ?? '',
      venueType: v.venueType, contactPerson: v.contactPerson ?? '',
      phone: v.phone ?? '', email: v.email ?? '',
      maxCapacity: v.maxCapacity?.toString() ?? '',
      indoorOutdoor: v.indoorOutdoor ?? 'Both',
      loadInNotes: v.loadInNotes ?? '', floralRestrictions: v.floralRestrictions ?? '',
      parkingAvailability: v.parkingAvailability ?? 'Ample On-Site',
      powerAccess: v.powerAccess ?? '3-Phase High Power',
      inHouseCatering: v.inHouseCatering,
      notesRating: v.notesRating?.toString() ?? '5.0',
    });
    setFeedback(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const url = editingVenue ? `/api/venues/${editingVenue.id}` : '/api/venues';
      const method = editingVenue ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        fetchVenues();
      } else {
        const d = await res.json();
        setFeedback({ text: d.error || 'Failed to save venue', type: 'error' });
      }
    } catch (e) {
      setFeedback({ text: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/venues/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchVenues();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete venue');
      }
    } catch (e) {
      alert('An unexpected error occurred.');
    } finally {
      setDeleting(false);
    }
  };

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [k]: e.target.value }));

  const filtered = venues.filter(v => {
    const q = searchQuery.toLowerCase();
    return (v.name.toLowerCase().includes(q) || v.cityArea.toLowerCase().includes(q)) &&
      (selectedType === 'ALL' || v.venueType === selectedType);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Venue Directory</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage wedding ceremony &amp; reception partner venues, capacities, and floral setup guidelines.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-lg shadow transition flex items-center space-x-2"
          >
            <span>+ Add New Venue</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text" placeholder="Search venue by name or city..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
          />
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500">
            <option value="ALL">All Venue Types</option>
            {venueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm text-slate-400 flex items-center justify-between">
            <span>Total Registered Venues:</span>
            <span className="font-bold text-teal-400">{filtered.length}</span>
          </div>
        </div>

        {/* Venues Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading venues...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            No venues found. Click &quot;Add New Venue&quot; to register your first partner venue!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(v => (
              <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4 group">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        {v.venueType}
                      </span>
                      <h3 className="text-lg font-bold text-slate-100 mt-2">{v.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center space-x-1">
                        <span>📍 {v.cityArea}</span>
                        {v.fullAddress && <span>• {v.fullAddress}</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                        ★ {v.notesRating ? v.notesRating.toFixed(1) : '5.0'}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">{v.weddingsBookedCount} Bookings</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div><span className="text-slate-500 block">Capacity:</span><span className="font-semibold">{v.maxCapacity ? `${v.maxCapacity} Guests` : 'N/A'}</span></div>
                    <div><span className="text-slate-500 block">Setting:</span><span className="font-semibold">{v.indoorOutdoor}</span></div>
                    <div><span className="text-slate-500 block">Contact:</span><span className="font-semibold">{v.contactPerson || 'N/A'}</span></div>
                    <div><span className="text-slate-500 block">Phone:</span><span className="font-semibold text-teal-400">{v.phone || 'N/A'}</span></div>
                  </div>

                  {(v.loadInNotes || v.floralRestrictions) && (
                    <div className="mt-3 p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      {v.loadInNotes && <div><strong className="text-slate-300">Load-In:</strong> {v.loadInNotes}</div>}
                      {v.floralRestrictions && <div><strong className="text-rose-300">Restrictions:</strong> {v.floralRestrictions}</div>}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className={v.inHouseCatering ? 'text-emerald-400' : 'text-slate-500'}>
                    {v.inHouseCatering ? '✓ In-House Catering' : 'External Catering Only'}
                  </span>
                  <span className="text-slate-500">Power: {v.powerAccess || 'Standard'}</span>
                </div>

                {/* Edit / Delete action row */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openEdit(v)}
                    className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 transition flex items-center justify-center gap-1"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(v)}
                    className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-slate-700 hover:border-rose-700 transition flex items-center justify-center gap-1"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">
                {editingVenue ? `✏️ Edit — ${editingVenue.name}` : '+ Add New Partner Venue'}
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
                {([
                  ['name', 'Venue Name *', 'text', 'e.g. Shangri-La Colombo Ballroom'],
                  ['cityArea', 'City / Area *', 'text', 'e.g. Colombo 02 / Bentota'],
                  ['contactPerson', 'Contact Person', 'text', 'Banquet Manager Name'],
                  ['phone', 'Phone Number', 'text', '+94 77 123 4567'],
                  ['email', 'Email Address', 'text', 'events@venue.lk'],
                  ['maxCapacity', 'Max Capacity (Guests)', 'number', '500'],
                  ['notesRating', 'Quality Rating (1–5)', 'number', '5.0'],
                ] as [keyof typeof EMPTY_FORM, string, string, string][]).map(([key, label, type, placeholder]) => (
                  <div key={key}>
                    <label className="block text-slate-400 mb-1 font-semibold">{label}</label>
                    <input
                      type={type} required={key === 'name' || key === 'cityArea'}
                      step={key === 'notesRating' ? '0.1' : undefined}
                      min={key === 'notesRating' ? '1' : undefined}
                      max={key === 'notesRating' ? '5' : undefined}
                      value={formData[key] as string} onChange={f(key)} placeholder={placeholder}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Venue Type *</label>
                  <select value={formData.venueType} onChange={f('venueType')}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-teal-500">
                    {venueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Indoor / Outdoor</label>
                  <select value={formData.indoorOutdoor} onChange={f('indoorOutdoor')}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-teal-500">
                    <option value="Indoor">Indoor (AC Ballroom)</option>
                    <option value="Outdoor">Outdoor Lawn / Beach</option>
                    <option value="Both">Both (Indoor + Outdoor)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Full Address</label>
                <input type="text" value={formData.fullAddress} onChange={f('fullAddress')}
                  placeholder="1 Galle Face, Colombo 02"
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-teal-500" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Load-In Notes</label>
                  <textarea rows={2} value={formData.loadInNotes} onChange={f('loadInNotes')}
                    placeholder="Service elevator access from basement B2"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Floral / Rigging Restrictions</label>
                  <textarea rows={2} value={formData.floralRestrictions} onChange={f('floralRestrictions')}
                    placeholder="No open flame candles, hanging floral max 50kg"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-slate-100 focus:outline-none focus:border-teal-500" />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input type="checkbox" id="inHouseCatering" checked={formData.inHouseCatering}
                  onChange={e => setFormData(p => ({ ...p, inHouseCatering: e.target.checked }))}
                  className="rounded text-teal-500 focus:ring-0" />
                <label htmlFor="inHouseCatering" className="text-slate-300 text-xs">Provides In-House Catering</label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded text-xs disabled:opacity-50">
                  {submitting ? 'Saving...' : editingVenue ? 'Save Changes' : 'Add Venue'}
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
              <h3 className="text-lg font-black text-rose-400">Delete Venue?</h3>
              <p className="text-slate-300 text-sm">
                <span className="font-bold text-white">{deleteTarget.name}</span> will be permanently removed.
              </p>
              {deleteTarget.weddingsBookedCount > 0 && (
                <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-700 rounded px-3 py-2">
                  ⚠ This venue has {deleteTarget.weddingsBookedCount} booking(s) — deletion will be blocked.
                </p>
              )}
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

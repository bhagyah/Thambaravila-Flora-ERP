'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Load map picker client-side only — Leaflet does not support SSR
const GeofenceMapPicker = dynamic(
  () => import('@/app/components/GeofenceMapPicker'),
  { ssr: false, loading: () => <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading map…</div> }
);

interface Geofence {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt: string;
  _count: { workSessions: number };
}

interface ModalState {
  open: boolean;
  editingFence: Geofence | null;
  name: string;
  lat: number | null;
  lng: number | null;
  radius: number;
  step: 'form' | 'map';
}

export default function GeofencesAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [modal, setModal] = useState<ModalState>({
    open: false,
    editingFence: null,
    name: '',
    lat: null,
    lng: null,
    radius: 100,
    step: 'form',
  });

  // RBAC: only IT/Owner can access this page
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      const role = session?.user?.role?.name;
      if (role !== 'Owner' && role !== 'IT/Admin') router.push('/dashboard');
    }
  }, [status, session, router]);

  const fetchGeofences = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/geofences');
      if (res.ok) {
        const data = await res.json();
        setGeofences(data.geofences || []);
      }
    } catch {
      showMsg('Failed to load geofences.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGeofences(); }, [fetchGeofences]);

  function showMsg(text: string, type: 'success' | 'error') {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  }

  function openCreateModal() {
    setModal({ open: true, editingFence: null, name: '', lat: 6.9271, lng: 79.8612, radius: 100, step: 'form' });
  }

  function openEditModal(fence: Geofence) {
    setModal({
      open: true,
      editingFence: fence,
      name: fence.name,
      lat: fence.centerLatitude,
      lng: fence.centerLongitude,
      radius: fence.radiusMeters,
      step: 'form',
    });
  }

  async function handleSave() {
    if (!modal.name.trim()) { showMsg('Zone name is required.', 'error'); return; }
    if (modal.lat == null || modal.lng == null) { showMsg('Please pick a location on the map.', 'error'); return; }

    setSaving(true);
    try {
      const url = modal.editingFence
        ? `/api/geofences/${modal.editingFence.id}`
        : '/api/geofences';
      const method = modal.editingFence ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modal.name.trim(),
          centerLatitude: modal.lat,
          centerLongitude: modal.lng,
          radiusMeters: modal.radius,
        }),
      });

      if (res.ok) {
        showMsg(modal.editingFence ? 'Geofence updated.' : 'Geofence created.', 'success');
        setModal((m) => ({ ...m, open: false }));
        fetchGeofences();
      } else {
        const data = await res.json();
        showMsg(data.error || 'Save failed.', 'error');
      }
    } catch {
      showMsg('Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(fence: Geofence) {
    try {
      const res = await fetch(`/api/geofences/${fence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !fence.isActive }),
      });
      if (res.ok) {
        showMsg(`Zone "${fence.name}" ${fence.isActive ? 'deactivated' : 'activated'}.`, 'success');
        fetchGeofences();
      }
    } catch {
      showMsg('Toggle failed. Please try again.', 'error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-flora-darker flex items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-flora-darker p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <span>📍</span> Geofence Zones
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage approved attendance locations. Staff must be within an active zone to clock in.
          </p>
          {/* Best-effort disclaimer — required per spec */}
          <p className="text-[11px] text-amber-400/80 mt-1">
            ⚠️ Best-effort geofencing: GPS coordinates from a browser can be spoofed by fake-location tools.
            This system prevents accidental off-site check-ins and provides a verifiable record, but is not tamper-proof.
          </p>
        </div>
        <button
          id="add-geofence-button"
          onClick={openCreateModal}
          className="px-5 py-2.5 bg-flora-green hover:bg-flora-sage text-slate-950 font-extrabold rounded-xl text-sm transition shadow"
        >
          + Add Zone
        </button>
      </div>

      {/* Toast message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
          messageType === 'success'
            ? 'bg-emerald-900/50 border-emerald-700 text-emerald-200'
            : 'bg-rose-900/50 border-rose-700 text-rose-200'
        }`}>
          {message}
        </div>
      )}

      {/* Geofence Table */}
      <div className="bg-flora-card border border-flora-border rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading zones…</div>
        ) : geofences.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-4xl mb-3">🗺️</div>
            <div className="font-semibold text-slate-300 mb-1">No geofence zones yet</div>
            <div className="text-sm text-slate-500">Click "Add Zone" to create your first attendance zone.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flora-border text-slate-400 text-xs uppercase tracking-widest">
                  <th className="text-left p-4">Zone Name</th>
                  <th className="text-left p-4">Coordinates</th>
                  <th className="text-right p-4">Radius</th>
                  <th className="text-right p-4">Sessions</th>
                  <th className="text-center p-4">Status</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {geofences.map((fence) => (
                  <tr
                    key={fence.id}
                    className="border-b border-flora-border last:border-0 hover:bg-flora-darker/50 transition"
                  >
                    <td className="p-4">
                      <div className="font-bold text-slate-100">{fence.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Added {new Date(fence.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-400">
                      {fence.centerLatitude.toFixed(5)}, {fence.centerLongitude.toFixed(5)}
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-300">
                      {fence.radiusMeters} m
                    </td>
                    <td className="p-4 text-right text-slate-400">
                      {fence._count.workSessions}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        id={`toggle-geofence-${fence.id}`}
                        onClick={() => toggleActive(fence)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                          fence.isActive
                            ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 hover:bg-rose-900/40 hover:text-rose-300 hover:border-rose-700/50'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-900/40 hover:text-emerald-300 hover:border-emerald-700/50'
                        }`}
                        title={fence.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {fence.isActive ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        id={`edit-geofence-${fence.id}`}
                        onClick={() => openEditModal(fence)}
                        className="px-3 py-1.5 bg-flora-darker hover:bg-flora-card text-slate-300 hover:text-white border border-flora-border rounded-lg text-xs font-semibold transition"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-flora-card border border-flora-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-flora-border flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-100">
                {modal.editingFence ? `Edit Zone: ${modal.editingFence.name}` : 'Create New Attendance Zone'}
              </h2>
              <button
                onClick={() => setModal((m) => ({ ...m, open: false }))}
                className="text-slate-400 hover:text-white transition text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Zone Name Field */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-1.5">
                  Zone Name *
                </label>
                <input
                  id="geofence-name-input"
                  type="text"
                  value={modal.name}
                  onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="e.g. Main Shop, Warehouse, Studio"
                  className="w-full bg-flora-darker border border-flora-border rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-flora-sage transition"
                />
              </div>

              {/* Map Picker */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
                  Zone Centre & Radius *
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Click on the map to place the zone centre. Use the slider to set the acceptance radius.
                </p>
                <GeofenceMapPicker
                  initialCenter={
                    modal.lat != null && modal.lng != null
                      ? { lat: modal.lat, lng: modal.lng }
                      : undefined
                  }
                  initialRadius={modal.radius}
                  onChange={(center, radius) => {
                    setModal((m) => ({ ...m, lat: center.lat, lng: center.lng, radius }));
                  }}
                  onConfirm={(center, radius) => {
                    setModal((m) => ({ ...m, lat: center.lat, lng: center.lng, radius }));
                  }}
                  onCancel={() => setModal((m) => ({ ...m, open: false }))}
                />
              </div>

              {/* Save Button */}
              <button
                id="save-geofence-button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-flora-green hover:bg-flora-sage disabled:opacity-60 text-slate-950 font-extrabold rounded-xl text-sm transition shadow"
              >
                {saving ? 'Saving…' : modal.editingFence ? 'Update Zone' : 'Create Zone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

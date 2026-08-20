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
  isMain?: boolean;
  zoneType?: string; // 'MAIN' | 'WFH' | 'ON_SITE'
  allowedRoles?: string | null;
  createdAt: string;
  _count: { workSessions: number };
}

const ALL_ROLES = [
  'Owner',
  'IT/Admin',
  'Accountant',
  'Sales Manager',
  'Wedding Coordinator',
  'Floral Designer',
  'Social Media Manager',
  'Labour',
];

interface ModalState {
  open: boolean;
  editingFence: Geofence | null;
  name: string;
  lat: number | null;
  lng: number | null;
  radius: number;
  zoneType: 'MAIN' | 'WFH' | 'ON_SITE';
  allowedRoles: string[];
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
    lat: 6.9271,
    lng: 79.8612,
    radius: 100,
    zoneType: 'MAIN',
    allowedRoles: [],
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
    setModal({
      open: true,
      editingFence: null,
      name: '',
      lat: 6.9271,
      lng: 79.8612,
      radius: 100,
      zoneType: geofences.some((g) => g.isMain) ? 'WFH' : 'MAIN',
      allowedRoles: [],
    });
  }

  function openEditModal(fence: Geofence) {
    const roles = fence.allowedRoles
      ? fence.allowedRoles.split(',').map((r) => r.trim()).filter(Boolean)
      : [];

    const type: 'MAIN' | 'WFH' | 'ON_SITE' = fence.isMain
      ? 'MAIN'
      : fence.zoneType === 'WFH'
      ? 'WFH'
      : (fence.zoneType as any) || 'ON_SITE';

    setModal({
      open: true,
      editingFence: fence,
      name: fence.name,
      lat: fence.centerLatitude,
      lng: fence.centerLongitude,
      radius: fence.radiusMeters,
      zoneType: type,
      allowedRoles: roles,
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
          isMain: modal.zoneType === 'MAIN',
          zoneType: modal.zoneType,
          allowedRoles: modal.zoneType === 'MAIN' ? null : modal.allowedRoles,
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

  async function setAsMain(fence: Geofence) {
    try {
      const res = await fetch(`/api/geofences/${fence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMain: true, zoneType: 'MAIN', allowedRoles: null }),
      });
      if (res.ok) {
        showMsg(`Zone "${fence.name}" is now set as the Main Workplace.`, 'success');
        fetchGeofences();
      }
    } catch {
      showMsg('Failed to set as Main zone.', 'error');
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

  function toggleRole(role: string) {
    setModal((prev) => {
      const exists = prev.allowedRoles.includes(role);
      const next = exists
        ? prev.allowedRoles.filter((r) => r !== role)
        : [...prev.allowedRoles, role];
      return { ...prev, allowedRoles: next };
    });
  }

  function selectAllRoles() {
    setModal((prev) => ({ ...prev, allowedRoles: [...ALL_ROLES] }));
  }

  function clearAllRoles() {
    setModal((prev) => ({ ...prev, allowedRoles: [] }));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <span>📍</span> Geofence Attendance Zones
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure Main workplace on-site zones and Work From Home (WFH) zones for custom roles.
          </p>
          <p className="text-[11px] text-amber-400/80 mt-1">
            ⚠️ Best-effort geofencing: GPS coordinates validate staff check-ins per zone rules. Main zone applies to all roles under Work Schedule; WFH zones apply to assigned roles and record as Work From Home.
          </p>
        </div>
        <button
          id="add-geofence-button"
          onClick={openCreateModal}
          className="px-5 py-2.5 bg-flora-green hover:bg-flora-sage text-slate-950 font-extrabold rounded-xl text-sm transition shadow flex items-center gap-1.5"
        >
          <span>+</span> Add Geozone
        </button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
          messageType === 'success'
            ? 'bg-emerald-900/50 border-emerald-700 text-emerald-200'
            : 'bg-rose-900/50 border-rose-700 text-rose-200'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-flora-card border border-flora-border rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading zones…</div>
        ) : geofences.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-4xl mb-3">🗺️</div>
            <div className="font-semibold text-slate-300 mb-1">No geofence zones yet</div>
            <div className="text-sm text-slate-500">Click "Add Geozone" to create your first attendance zone.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flora-border text-slate-400 text-xs uppercase tracking-widest">
                  <th className="text-left p-4">Zone Name & Type</th>
                  <th className="text-left p-4">Assigned Roles</th>
                  <th className="text-left p-4">Coordinates</th>
                  <th className="text-right p-4">Radius</th>
                  <th className="text-right p-4">Sessions</th>
                  <th className="text-center p-4">Status</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {geofences.map((fence) => {
                  const isMainZone = Boolean(fence.isMain || fence.zoneType === 'MAIN');
                  const isWfhZone = fence.zoneType === 'WFH';
                  const rolesList = fence.allowedRoles
                    ? fence.allowedRoles.split(',').map((r) => r.trim()).filter(Boolean)
                    : [];

                  return (
                    <tr
                      key={fence.id}
                      className={`border-b border-flora-border last:border-0 hover:bg-flora-darker/50 transition ${
                        isMainZone ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{fence.name}</span>
                          {isMainZone && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              ⭐ Main Workplace
                            </span>
                          )}
                          {isWfhZone && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              🏠 Work From Home
                            </span>
                          )}
                          {!isMainZone && !isWfhZone && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              🏢 On-Site Branch
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Added {new Date(fence.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="p-4">
                        {isMainZone ? (
                          <span className="text-xs font-semibold text-emerald-400">
                            All Roles (Work Schedule)
                          </span>
                        ) : rolesList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {rolesList.map((role) => (
                              <span
                                key={role}
                                className="px-2 py-0.5 bg-flora-darker border border-flora-border rounded text-[10px] text-slate-300 font-medium"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">All Roles</span>
                        )}
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
                        <div className="flex items-center justify-end gap-2">
                          {!isMainZone && fence.isActive && (
                            <button
                              onClick={() => setAsMain(fence)}
                              className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-200 border border-emerald-700/40 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                              title="Set as Main Workplace for all roles"
                            >
                              <span>⭐</span> Set Main
                            </button>
                          )}
                          <button
                            id={`edit-geofence-${fence.id}`}
                            onClick={() => openEditModal(fence)}
                            className="px-3 py-1.5 bg-flora-darker hover:bg-flora-card text-slate-300 hover:text-white border border-flora-border rounded-lg text-xs font-semibold transition"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-flora-card border border-flora-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-flora-border flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
                <span>📍</span>
                {modal.editingFence ? `Edit Geozone: ${modal.editingFence.name}` : 'Create New Geozone'}
              </h2>
              <button
                onClick={() => setModal((m) => ({ ...m, open: false }))}
                className="text-slate-400 hover:text-white transition text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-1.5">
                  Zone Name *
                </label>
                <input
                  id="geofence-name-input"
                  type="text"
                  value={modal.name}
                  onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="e.g. Thambaravila flora, Prasangika Home Geozone"
                  className="w-full bg-flora-darker border border-flora-border rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-flora-sage transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
                  Zone Classification & Attendance Mode *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModal((m) => ({ ...m, zoneType: 'MAIN' }))}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      modal.zoneType === 'MAIN'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                        : 'bg-flora-darker border-flora-border text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>⭐</span> Main Workplace
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Applies to all roles for Work Schedule.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModal((m) => ({ ...m, zoneType: 'WFH' }))}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      modal.zoneType === 'WFH'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-200'
                        : 'bg-flora-darker border-flora-border text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>🏠</span> Work From Home
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Saves as WFH attendance for assigned roles.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModal((m) => ({ ...m, zoneType: 'ON_SITE' }))}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      modal.zoneType === 'ON_SITE'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                        : 'bg-flora-darker border-flora-border text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>🏢</span> On-Site Branch
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Secondary shop, warehouse, or studio.
                    </div>
                  </button>
                </div>
              </div>

              {modal.zoneType !== 'MAIN' && (
                <div className="bg-flora-darker/90 p-4 rounded-xl border border-flora-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-200 block">
                        Allowed Roles for this {modal.zoneType === 'WFH' ? 'Work From Home' : 'Branch'} Zone
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {modal.allowedRoles.length === 0
                          ? 'No roles selected (will be accessible by all roles)'
                          : `${modal.allowedRoles.length} role(s) authorized`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllRoles}
                        className="text-[10px] text-flora-sage hover:underline font-semibold"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={clearAllRoles}
                        className="text-[10px] text-slate-400 hover:underline font-semibold"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {ALL_ROLES.map((role) => {
                      const checked = modal.allowedRoles.includes(role);
                      return (
                        <label
                          key={role}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            checked
                              ? 'bg-flora-green/10 border-flora-sage/50 text-emerald-200 font-semibold'
                              : 'bg-flora-darker border-flora-border text-slate-400 hover:bg-flora-card'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRole(role)}
                            className="rounded accent-flora-green h-4 w-4"
                          />
                          <span>{role}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-1">
                  Zone Location & Acceptance Radius *
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Click on the map or drag the pin to set the center point.
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

              <button
                id="save-geofence-button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-flora-green hover:bg-flora-sage disabled:opacity-60 text-slate-950 font-extrabold rounded-xl text-sm transition shadow"
              >
                {saving ? 'Saving…' : modal.editingFence ? 'Update Geozone' : 'Create Geozone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

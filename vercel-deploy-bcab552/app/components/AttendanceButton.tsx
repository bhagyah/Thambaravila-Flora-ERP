'use client';

import { useState, useEffect, useCallback } from 'react';

interface WorkSession {
  id: string;
  startTime: string;
  locationVerified: boolean;
  geofence?: { name: string } | null;
}

type Status = 'idle' | 'fetching_location' | 'submitting' | 'clocked_in' | 'clocked_out';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: This component only collects raw GPS coordinates from the browser
// and sends them to the server. All accept/reject decisions are made server-side
// using the Haversine formula. This is best-effort geofencing — not tamper-proof.
// ─────────────────────────────────────────────────────────────────────────────

export default function AttendanceButton() {
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [elapsed, setElapsed] = useState<string>('');
  const [showPanel, setShowPanel] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  // Fetch current session state on mount
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/work-sessions');
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.activeSession || null);
        setStatus(data.activeSession ? 'clocked_in' : 'idle');
      }
    } catch {
      // Non-fatal — button will show default state
    } finally {
      setLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Live elapsed time ticker
  useEffect(() => {
    if (!activeSession) { setElapsed(''); return; }
    const update = () => {
      const diffMs = Date.now() - new Date(activeSession.startTime).getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      setElapsed(`${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [activeSession]);

  // Get device info for audit log (non-sensitive)
  function getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    };
  }

  async function handleAttendance() {
    // Check geolocation API availability
    if (!navigator.geolocation) {
      setMessage('Your browser does not support location access. Please use a modern browser.');
      setMessageType('error');
      setShowPanel(true);
      return;
    }

    setStatus('fetching_location');
    setMessage('Requesting your location… This may take a few seconds.');
    setMessageType('info');
    setShowPanel(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setStatus('submitting');
        setMessage('Validating location with server…');

        const action = activeSession ? 'CLOCK_OUT' : 'CLOCK_IN';
        try {
          const res = await fetch('/api/work-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              latitude,
              longitude,
              accuracyMeters: accuracy,
              deviceInfo: getDeviceInfo(),
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            setMessageType('error');
            setMessage(data.error || 'Attendance could not be recorded. Please try again.');
            setStatus(activeSession ? 'clocked_in' : 'idle');
            return;
          }

          if (action === 'CLOCK_IN') {
            setActiveSession(data.workSession);
            setStatus('clocked_in');
            setMessageType('success');
            const modeLabel = data.isWfh ? '🏠 Clocked in (Work From Home)' : '🏢 Clocked in (On-Site)';
            setMessage(
              `✅ ${modeLabel} at ${new Date().toLocaleTimeString()} — verified at ${data.geofenceName || 'approved zone'}.`
            );
          } else {
            setActiveSession(null);
            setStatus('clocked_out');
            setMessageType('success');
            setMessage(
              `✅ Clocked out. Session duration: ${data.durationMinutes || 0} minutes.`
            );
            // Reset to idle after a few seconds so button is ready again
            setTimeout(() => setStatus('idle'), 5000);
          }
        } catch {
          setMessageType('error');
          setMessage('A network error occurred. Please check your connection and try again.');
          setStatus(activeSession ? 'clocked_in' : 'idle');
        }
      },
      (err) => {
        setStatus(activeSession ? 'clocked_in' : 'idle');
        setMessageType('error');

        // Do NOT allow attendance without location — show a clear message
        if (err.code === err.PERMISSION_DENIED) {
          setMessage(
            'Location access was denied. Attendance cannot be marked without location access. ' +
            'Please enable location in your browser settings and try again.'
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setMessage(
            'Location is currently unavailable. Please check your device\'s GPS/location settings and try again.'
          );
        } else if (err.code === err.TIMEOUT) {
          setMessage('Location request timed out. Please try again in a moment.');
        } else {
          setMessage('Could not obtain location. Please try again.');
        }
      },
      {
        enableHighAccuracy: true, // Request GPS-level accuracy when available
        timeout: 15000,           // 15 second timeout
        maximumAge: 0,            // Never use cached location for attendance
      }
    );
  }

  const isBusy = status === 'fetching_location' || status === 'submitting';

  if (loadingSession) return null;

  return (
    <div className="relative">
      {/* Main Attendance Button */}
      <button
        id="attendance-mark-button"
        onClick={handleAttendance}
        disabled={isBusy}
        title={activeSession ? 'Clock Out' : 'Mark Attendance (Clock In)'}
        className={`
          px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center space-x-2 shadow transition-all
          ${isBusy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
          ${
            activeSession
              ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40'
              : 'bg-flora-darker hover:bg-flora-card text-slate-200 hover:text-white border-flora-border'
          }
        `}
      >
        {/* Pulse dot when clocked in */}
        {activeSession && !isBusy && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}

        {isBusy ? (
          <>
            <span className="animate-spin text-sm">⏳</span>
            <span className="hidden sm:inline">
              {status === 'fetching_location' ? 'Getting location…' : 'Verifying…'}
            </span>
          </>
        ) : activeSession ? (
          <>
            <span>🕐</span>
            <span className="hidden sm:inline">
              Clock Out {elapsed && <span className="text-emerald-400 font-bold ml-1">({elapsed})</span>}
            </span>
          </>
        ) : (
          <>
            <span>📍</span>
            <span className="hidden sm:inline font-bold">Mark Attendance</span>
          </>
        )}
      </button>

      {/* Feedback Panel */}
      {showPanel && message && (
        <div
          className={`
            absolute right-0 top-12 w-80 z-50 rounded-2xl p-4 shadow-2xl border text-sm backdrop-blur-lg
            ${messageType === 'success'
              ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
              : messageType === 'error'
              ? 'bg-rose-900/90 border-rose-700 text-rose-100'
              : 'bg-flora-card border-flora-border text-slate-200'
            }
          `}
          role="alert"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="leading-relaxed flex-1">{message}</p>
            <button
              onClick={() => setShowPanel(false)}
              className="text-slate-400 hover:text-white mt-0.5 flex-shrink-0"
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          {/* Geofencing disclaimer */}
          {messageType === 'success' && (
            <p className="mt-2 text-[10px] text-emerald-300/70 border-t border-emerald-700/50 pt-2">
              ⚠️ Best-effort geofencing — GPS location can be affected by indoor conditions or device settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

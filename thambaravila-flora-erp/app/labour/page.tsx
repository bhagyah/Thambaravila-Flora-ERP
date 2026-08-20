'use client';

import Image from 'next/image';
import { signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileModal from '@/app/components/ProfileModal';

type Meal = 'breakfast' | 'lunch' | 'dinner';
type Overview = {
  today: string;
  serverTimeLabel: string;
  activeSession: { id: string; startTime: string; geofence?: { name: string } | null } | null;
  todaySession: { id: string; startTime: string; endTime: string | null; duration: number | null } | null;
  mealRequest: Record<Meal, boolean>;
  mealAvailability: Record<Meal, { open: boolean; cutoff: string }>;
  month: { presentDays: number; totalMinutes: number; totalHours: number; sessions: Array<{ id: string; startTime: string; endTime: string | null; duration: number | null }> };
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, '0')}m`;
}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? 'Allow location permission, then try again.' : 'Could not verify current location. Move outdoors and retry.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

export default function LabourMobilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/labour/overview', { cache: 'no-store' });
      if (response.status === 401) return router.replace('/auth/signin?callbackUrl=/labour');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load labour app.');
      setOverview(data);
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Could not load app.', error: true }); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin?callbackUrl=/labour');
    if (status === 'authenticated') {
      if (session?.user.role.name !== 'Labour') router.replace('/dashboard');
      else load();
    }
  }, [status, session, load, router]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    const updateOnline = () => setOnline(navigator.onLine);
    const captureInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    updateOnline(); window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
    window.addEventListener('beforeinstallprompt', captureInstall);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/labour-sw.js').catch(() => undefined);
    return () => { window.clearInterval(timer); window.clearInterval(refresh); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); window.removeEventListener('beforeinstallprompt', captureInstall); };
  }, [load]);

  const liveMinutes = useMemo(() => overview?.activeSession ? Math.max(0, Math.floor((now - new Date(overview.activeSession.startTime).getTime()) / 60000)) : 0, [overview?.activeSession, now]);

  const clock = async (action: 'CLOCK_IN' | 'CLOCK_OUT') => {
    if (!online) return setMessage({ text: 'Internet connection required to mark attendance.', error: true });
    setBusy(action); setMessage(null);
    try {
      const current = await position();
      const response = await fetch('/api/work-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, latitude: current.coords.latitude, longitude: current.coords.longitude, accuracyMeters: current.coords.accuracy, deviceInfo: { userAgent: navigator.userAgent, platform: navigator.platform, app: 'Labour PWA' } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Attendance could not be saved.');
      setMessage({ text: action === 'CLOCK_IN' ? `Clocked on at ${data.geofenceName}.` : `Clocked off. Worked ${duration(data.durationMinutes || 0)}.` });
      await load();
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Attendance could not be saved.', error: true }); }
    finally { setBusy(null); }
  };

  const updateMeal = async (meal: Meal, selected: boolean) => {
    if (!overview || !online) return setMessage({ text: 'Internet connection required to save meal requests.', error: true });
    setBusy(meal); setMessage(null);
    try {
      const response = await fetch('/api/labour/meals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [meal]: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Meal request could not be saved.');
      setOverview({ ...overview, mealRequest: data.mealRequest, mealAvailability: data.mealAvailability });
      setMessage({ text: `${meal[0].toUpperCase()}${meal.slice(1)} ${selected ? 'requested' : 'removed'} for today.` });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Meal request could not be saved.', error: true }); }
    finally { setBusy(null); }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (loading || status === 'loading') return <main className="grid min-h-screen place-items-center bg-[#18201d] text-emerald-100"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" /><p className="mt-4 text-sm font-bold">Loading attendance...</p></div></main>;
  if (!overview || !session) return null;

  const clockedOut = Boolean(overview.todaySession?.endTime);
  return <main className="min-h-screen bg-[#edf3ee] pb-10 text-[#20362d]">
    <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-[#173b2d] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white shadow-lg">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
            <Image src="/logo.png" alt="Thambaravila Flora" fill sizes="44px" className="scale-[2.1] object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{session.user.name}</p>
            <p className="text-xs text-emerald-100/70">Labour attendance · {overview.today}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setProfileModalOpen(true)} className="min-h-11 rounded-lg border border-white/20 px-3 text-xs font-bold">Account</button>
          <button onClick={() => signOut({ callbackUrl: '/auth/signin?callbackUrl=/labour' })} className="min-h-11 rounded-lg border border-white/20 px-3 text-xs font-bold">Sign out</button>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row"><div className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${online ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-700'}`}>{online ? `Online · ${overview.serverTimeLabel}` : 'Offline · Attendance and meals cannot save'}</div>{installPrompt && <button onClick={installApp} className="min-h-11 rounded-lg bg-[#173b2d] px-4 text-xs font-black text-white">Install Android App</button>}</div>
      {message && <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${message.error ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}

      <section className="overflow-hidden rounded-lg bg-[#173b2d] p-5 text-white shadow-xl"><p className="text-xs font-bold uppercase text-emerald-200/70">Today attendance</p>{overview.activeSession ? <><p className="mt-3 text-4xl font-black tabular-nums">{duration(liveMinutes)}</p><p className="mt-1 text-sm text-emerald-100/70">Clocked on {new Date(overview.activeSession.startTime).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' })}{overview.activeSession.geofence?.name ? ` · ${overview.activeSession.geofence.name}` : ''}</p><button disabled={busy !== null} onClick={() => clock('CLOCK_OUT')} className="mt-5 min-h-14 w-full rounded-lg bg-rose-500 px-5 text-lg font-black shadow-lg disabled:opacity-50">{busy === 'CLOCK_OUT' ? 'Checking location...' : 'Clock Off'}</button></> : clockedOut ? <><p className="mt-3 text-3xl font-black">Shift complete</p><p className="mt-1 text-sm text-emerald-100/70">Worked {duration(overview.todaySession?.duration || 0)} today</p><div className="mt-5 rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-bold">Attendance saved</div></> : <><p className="mt-3 text-3xl font-black">Ready to work</p><p className="mt-1 text-sm text-emerald-100/70">GPS verification required at approved work location.</p><button disabled={busy !== null} onClick={() => clock('CLOCK_IN')} className="mt-5 min-h-14 w-full rounded-lg bg-emerald-400 px-5 text-lg font-black text-emerald-950 shadow-lg disabled:opacity-50">{busy === 'CLOCK_IN' ? 'Checking location...' : 'Clock On'}</button></>}</section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div><p className="text-xs font-black uppercase text-emerald-700">Daily food</p><h2 className="mt-1 text-xl font-black">Today meal requests</h2><p className="mt-1 text-xs text-slate-500">Tick needed meals before each deadline. Changes save immediately.</p></div><div className="mt-4 space-y-3">{(['breakfast', 'lunch', 'dinner'] as Meal[]).map((meal) => { const availability = overview.mealAvailability[meal]; const selected = Boolean(overview.mealRequest[meal]); return <label key={meal} className={`flex min-h-16 items-center gap-4 rounded-lg border p-3 ${availability.open ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100 opacity-70'}`}><input type="checkbox" checked={selected} disabled={!availability.open || busy !== null} onChange={(event) => updateMeal(meal, event.target.checked)} className="h-7 w-7 shrink-0 accent-emerald-600" /><span className="min-w-0 flex-1"><span className="block text-base font-black capitalize">{meal}</span><span className="block text-xs text-slate-500">Apply before {availability.cutoff}</span></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${selected ? 'bg-emerald-100 text-emerald-700' : availability.open ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>{busy === meal ? 'Saving' : selected ? 'Applied' : availability.open ? 'Open' : 'Closed'}</span></label>; })}</div></section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-emerald-700">This month</p><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-lg bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Days present</p><p className="mt-1 text-3xl font-black text-emerald-900">{overview.month.presentDays}</p></div><div className="rounded-lg bg-sky-50 p-4"><p className="text-xs text-sky-700">Worked hours</p><p className="mt-1 text-3xl font-black text-sky-900">{overview.month.totalHours}</p></div></div><div className="mt-4 divide-y divide-slate-100">{overview.month.sessions.slice(0, 7).map((item) => <div key={item.id} className="flex items-center justify-between py-3 text-sm"><div><p className="font-bold">{new Date(item.startTime).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', weekday: 'short' })}</p><p className="text-xs text-slate-500">{new Date(item.startTime).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' })} - {item.endTime ? new Date(item.endTime).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' }) : 'Working'}</p></div><span className="font-black">{item.duration == null ? 'Active' : duration(item.duration)}</span></div>)}</div></section>
    </div>
    {profileModalOpen && <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />}
  </main>;
}

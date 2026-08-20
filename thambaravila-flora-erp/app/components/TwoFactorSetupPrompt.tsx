'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';

export default function TwoFactorSetupPrompt() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !session.user.requires2FA || session.user.totpConfigured || pathname === '/settings/2fa') {
      setDismissed(true);
      return;
    }

    const sessionKey = `flora-2fa-reminder-shown:${userId}`;
    if (sessionStorage.getItem(sessionKey)) {
      setDismissed(true);
      return;
    }

    const storageKey = `flora-2fa-reminders:${userId}`;
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const recent = Array.isArray(stored)
        ? stored.filter((value): value is number => typeof value === 'number' && value >= sevenDaysAgo)
        : [];

      if (recent.length >= 2) {
        localStorage.setItem(storageKey, JSON.stringify(recent));
        setDismissed(true);
        return;
      }

      localStorage.setItem(storageKey, JSON.stringify([...recent, now]));
      sessionStorage.setItem(sessionKey, '1');
      setDismissed(false);
    } catch {
      sessionStorage.setItem(sessionKey, '1');
      setDismissed(false);
    }
  }, [pathname, session?.user?.id, session?.user?.requires2FA, session?.user?.totpConfigured]);

  const shouldShow = Boolean(
    session?.user?.requires2FA
    && !session.user.totpConfigured
    && pathname !== '/settings/2fa'
    && !dismissed
  );

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="two-factor-title">
      <div className="w-full max-w-lg rounded-lg border border-emerald-300/25 bg-[#202725] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:p-7">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-xl font-black text-emerald-200" aria-hidden="true">
          2FA
        </div>
        <p className="text-xs font-bold uppercase text-emerald-300">Account security</p>
        <h2 id="two-factor-title" className="mt-2 text-2xl font-bold text-white">Set up Google Authenticator</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Login complete. Protect your account with a six-digit Google Authenticator code. Setup takes about one minute and recovery codes are provided.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setDismissed(true)} className="min-h-11 rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white">
            Continue for now
          </button>
          <button type="button" onClick={() => router.push('/settings/2fa')} className="min-h-11 rounded-md bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">
            Set up 2FA now
          </button>
        </div>
      </div>
    </div>
  );
}

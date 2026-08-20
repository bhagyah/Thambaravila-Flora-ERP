'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

type LoginLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

async function createDeviceFingerprint(): Promise<string> {
  const source = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(navigator.hardwareConcurrency || ''),
    String(navigator.maxTouchPoints || ''),
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requestLoginLocation(): Promise<LoginLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This device does not support location. Location is required to sign in.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission is blocked. Allow location access in browser settings, then try again.'
          : 'Current location could not be verified. Enable device location and try again.';
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function SignInContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'verified' | 'blocked'>('idle');

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const defaultPath = session.user?.role?.name === 'Labour'
        ? '/labour'
        : session.user?.role?.name === 'Floral Designer'
          ? '/designer'
          : '/dashboard';
      const callbackUrl = searchParams.get('callbackUrl') || defaultPath;
      router.replace(callbackUrl);
    }
  }, [status, session, router, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      setLocationStatus('checking');
      const [location, deviceFingerprint] = await Promise.all([
        requestLoginLocation(),
        createDeviceFingerprint(),
      ]);
      setLocationStatus('verified');

      const signInCredentials: Record<string, string | boolean> = {
        email,
        password,
        loginLatitude: String(location.latitude),
        loginLongitude: String(location.longitude),
        loginAccuracy: String(location.accuracy),
        locationGranted: 'true',
        deviceFingerprint,
        redirect: false,
      };
      if (totpToken.trim()) {
        signInCredentials.totpToken = totpToken.trim();
      }

      const result = await signIn('credentials', signInCredentials);

      if (result?.error) {
        if (result.error === '2FA_REQUIRED') {
          setNeeds2FA(true);
          setError('Enter the current code from Google Authenticator to continue.');
        } else if (/2fa|second.factor|already-used/i.test(result.error)) {
          setNeeds2FA(true);
          setTotpToken('');
          setError('Invalid or expired code. Enter a new code from Google Authenticator.');
        } else {
          setError(result.error);
        }
      }
    } catch (error) {
      setLocationStatus('blocked');
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#f5f5ee] text-[#26372f]">
      <Image
        src="/dashboard-floral-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-30"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(244,247,239,0.94)_0%,rgba(249,247,239,0.82)_52%,rgba(239,247,242,0.78)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(92,150,119,0.15),transparent_29%),radial-gradient(circle_at_82%_79%,rgba(92,150,119,0.13),transparent_28%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1240px] items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-16 lg:px-12 lg:py-12">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          <div className="relative h-24 w-64 overflow-hidden sm:h-28 sm:w-72">
            <Image
              src="/logo-light.png"
              alt="Thambaravila Flora"
              fill
              priority
              sizes="288px"
              className="scale-[5] object-contain object-center"
            />
          </div>

          <p className="mt-6 text-xs font-bold uppercase text-[#4e8068] sm:text-sm">
            Floral, No Better Ways
          </p>
          <h1
            className="mt-4 text-4xl font-bold leading-tight text-[#285d3b] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Welcome Back
          </h1>
          <div className="mt-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px w-16 bg-[#4e8068]" />
            <span className="h-2 w-2 rounded-full border border-[#4e8068]" />
            <span className="h-px w-16 bg-[#4e8068]" />
          </div>
          <p className="mt-6 max-w-md text-base leading-7 text-[#617069] sm:text-lg">
            Sign in to manage floral events, customer journeys, payments, and team workflows.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[480px] rounded-[8px] border border-white/90 bg-white/90 px-5 py-7 shadow-[0_30px_80px_rgba(49,75,61,0.18)] backdrop-blur-xl sm:px-10 sm:py-10">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase text-[#579274]">Secure staff portal</p>
            <h2
              className="mt-2 text-4xl font-bold text-[#285d3b]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Sign In
            </h2>
            <p className="mt-2 text-sm text-[#718078]">Access your account to continue.</p>
            <div className="mt-5 flex gap-2" aria-hidden="true">
              <span className="h-0.5 w-14 bg-[#579274]" />
              <span className="h-0.5 w-8 bg-[#9ebcab]" />
            </div>
          </div>

          {error && (
            <div
              className="mb-5 rounded-[6px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-[6px] border border-[#d8dfd9] bg-[#f7fbf8] px-4 py-3 text-sm text-[#4d675a]" aria-live="polite">
              <span className="font-semibold">Location security:</span>{' '}
              {locationStatus === 'checking' && 'Verifying current location...'}
              {locationStatus === 'verified' && 'Current location verified.'}
              {locationStatus === 'blocked' && 'Location unavailable. Permission is required.'}
              {locationStatus === 'idle' && 'Browser permission is required for every sign-in.'}
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#3c5147]">
                Email address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 grid w-12 place-items-center text-sm font-bold text-[#6f8077]">
                  @
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-14 w-full rounded-[7px] border border-[#d8dfd9] bg-white/75 py-3 pl-12 pr-4 text-base text-[#26372f] outline-none transition placeholder:text-[#9ba6a0] focus:border-[#579274] focus:ring-4 focus:ring-[#579274]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="name@thambaravila-flora.com"
                  disabled={loading || needs2FA}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#3c5147]">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 grid w-12 place-items-center text-sm font-bold text-[#6f8077]">
                  *
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-14 w-full rounded-[7px] border border-[#d8dfd9] bg-white/75 py-3 pl-12 pr-16 text-base text-[#26372f] outline-none transition placeholder:text-[#9ba6a0] focus:border-[#579274] focus:ring-4 focus:ring-[#579274]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="Enter your password"
                  disabled={loading || needs2FA}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-1 min-w-12 px-2 text-xs font-bold text-[#4e8068] hover:text-[#285d3b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#579274]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {needs2FA && (
              <div>
                <label htmlFor="totpToken" className="mb-2 block text-sm font-semibold text-[#3c5147]">
                  Two-factor authentication code
                </label>
                <input
                  id="totpToken"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  required
                  value={totpToken}
                  onChange={(event) => setTotpToken(event.target.value.toUpperCase().replace(/[^A-F0-9-]/g, ''))}
                  maxLength={19}
                  className="min-h-14 w-full rounded-[7px] border border-[#579274] bg-[#f7fbf8] px-4 py-3 text-center font-mono text-2xl text-[#285d3b] outline-none focus:ring-4 focus:ring-[#579274]/10"
                  placeholder="000000 or recovery code"
                  autoFocus
                  disabled={loading}
                />
                <p className="mt-2 text-center text-xs text-[#718078]">
                  Enter Google Authenticator code or one single-use recovery code.
                </p>
              </div>
            )}

            {!needs2FA && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="flex min-h-11 items-center gap-2 text-[#5c7568]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-[#b7c9bd] accent-[#579274] focus:ring-[#579274]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setError('Password resets are managed by Super Admin.')}
                  className="min-h-11 font-semibold text-[#4e8068] hover:text-[#285d3b] focus:outline-none focus-visible:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-14 w-full items-center justify-center rounded-[7px] bg-[#57a88d] px-5 py-3 text-base font-bold text-white shadow-[0_12px_28px_rgba(62,135,108,0.24)] transition hover:bg-[#438d73] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#579274]/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Authenticating...' : needs2FA ? 'Verify 2FA Code' : 'Sign In'}
            </button>
          </form>


          <div className="mt-7 border-t border-[#e2e7e3] pt-5 text-center">
            <p className="text-sm text-[#718078]">Accounts are managed by Super Admin.</p>
            <p className="mt-3 text-xs text-[#98a29d]">Copyright 2026 Thambaravila Flora. All rights reserved.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen w-full place-items-center bg-[#f5f5ee] text-[#285d3b]">Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}

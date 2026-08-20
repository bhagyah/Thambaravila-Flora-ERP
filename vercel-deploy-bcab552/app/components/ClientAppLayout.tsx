'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import TwoFactorSetupPrompt from './TwoFactorSetupPrompt';
import { useTheme } from '../context/ThemeContext';

export default function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { theme, customBg, bgContrast } = useTheme();
  const pathname = usePathname();

  const isPublicPage = !pathname || pathname === '/' || pathname.startsWith('/auth');
  const isLabourApp = pathname?.startsWith('/labour');
  const showAppLayout = status === 'authenticated' && session && !isPublicPage;

  if (!showAppLayout || isLabourApp) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center bg-transparent">
        {children}
      </main>
    );
  }

  // Contrast calculations (0 to 100)
  const contrastFactor = Math.max(0, Math.min(100, bgContrast ?? 65)) / 100;
  const darkAlpha = (0.20 + contrastFactor * 0.70).toFixed(2);
  const darkTopAlpha = (0.30 + contrastFactor * 0.65).toFixed(2);
  const darkBotAlpha = (0.35 + contrastFactor * 0.60).toFixed(2);

  const lightAlpha = (0.30 + contrastFactor * 0.62).toFixed(2);
  const lightTopAlpha = (0.40 + contrastFactor * 0.55).toFixed(2);
  const lightBotAlpha = (0.35 + contrastFactor * 0.58).toFixed(2);

  return (
    <div className="app-shell dashboard-shell relative flex min-h-screen overflow-x-hidden bg-transparent">
      <TwoFactorSetupPrompt />
      
      {/* ── Background Layer ── */}
      {customBg ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-20 overflow-hidden bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={{
            backgroundImage: `url("${customBg}")`,
          }}
        >
          {/* Theme-Adaptive & User-Contrast Adjustable Overlays */}
          {theme === 'light' ? (
            <div
              className="absolute inset-0 backdrop-blur-[2px] transition-all duration-300"
              style={{
                backgroundColor: `rgba(226, 221, 212, ${lightAlpha})`,
                backgroundImage: `linear-gradient(180deg, rgba(238, 234, 226, ${lightTopAlpha}) 0%, rgba(220, 214, 203, ${lightAlpha}) 50%, rgba(226, 221, 212, ${lightBotAlpha}) 100%)`,
              }}
            />
          ) : (
            <div
              className="absolute inset-0 backdrop-blur-[1px] transition-all duration-300"
              style={{
                backgroundColor: `rgba(2, 6, 23, ${darkAlpha})`,
                backgroundImage: `linear-gradient(180deg, rgba(2, 6, 23, ${darkTopAlpha}) 0%, rgba(23, 28, 26, ${darkAlpha}) 50%, rgba(2, 6, 23, ${darkBotAlpha}) 100%)`,
              }}
            />
          )}
        </div>
      ) : (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
          <Image
            src="/dashboard-floral-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-right opacity-[0.12]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(107,175,145,0.16),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(78,157,130,0.12),transparent_24%),radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.12),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(34,40,38,0.18)_100%)]" />
        </div>
      )}

      {!customBg && (
        <div aria-hidden="true" className="app-shell-wash pointer-events-none absolute inset-0 -z-10" />
      )}
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col pt-[69px] transition-all lg:pl-[16.5rem] lg:pt-0">
        <HeaderBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

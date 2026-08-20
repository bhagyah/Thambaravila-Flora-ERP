'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import TwoFactorSetupPrompt from './TwoFactorSetupPrompt';

export default function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
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

  return (
    <div className="app-shell dashboard-shell relative flex min-h-screen overflow-x-hidden bg-transparent">
      <TwoFactorSetupPrompt />
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
      <div aria-hidden="true" className="app-shell-wash pointer-events-none absolute inset-0 -z-10" />
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col pt-[69px] transition-all lg:pl-[16.5rem] lg:pt-0">
        <HeaderBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

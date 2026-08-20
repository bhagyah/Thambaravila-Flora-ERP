'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import RoleDashboardView from '../components/dashboard/RoleDashboardView';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role?.name === 'Floral Designer') {
      router.replace('/designer');
    } else if (status === 'authenticated' && session?.user?.role?.name === 'Labour') {
      router.replace('/labour');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-transparent text-slate-100 flex items-center justify-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(107,175,145,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(78,157,130,0.12),transparent_30%),linear-gradient(180deg,#222826_0%,#171c1a_100%)]" />
        <div className="relative flex flex-col items-center space-y-4 rounded-3xl border border-white/10 bg-white/8 backdrop-blur-2xl px-8 py-7 shadow-[0_30px_80px_rgba(0,0,0,0.24)]">
          <div className="h-12 w-12 rounded-full border-4 border-[#6BAF91] border-t-transparent animate-spin" />
          <p className="text-sm font-semibold text-slate-300">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const roleName = session.user?.role?.name || 'Owner';
  const userName = session.user?.name || 'Team Member';

  return (
    <div className="min-h-screen relative overflow-hidden bg-transparent text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(107,175,145,0.16),transparent_32%),radial-gradient(circle_at_85%_0%,rgba(78,157,130,0.12),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.05),transparent_35%)]" />
      <div className="relative mx-auto max-w-7xl p-3 sm:p-5 lg:p-8">
        <RoleDashboardView userRole={roleName} userName={userName} />
      </div>
    </div>
  );
}

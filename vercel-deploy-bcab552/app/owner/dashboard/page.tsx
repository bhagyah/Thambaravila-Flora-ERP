'use client';

import { useSession } from 'next-auth/react';
import RoleDashboardView from '@/app/components/dashboard/RoleDashboardView';

export default function OwnerDashboardPage() {
  const { data: session } = useSession();

  if (!session) return null;

  const roleName = session.user?.role?.name || '';
  if (roleName !== 'Owner') {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-100">
        <h2 className="text-2xl font-bold text-rose-500">Access Restricted</h2>
        <p className="text-slate-400 mt-2">The Executive Owner Master Dashboard is reserved exclusively for the Owner role.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-3 text-slate-100 sm:p-5 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <RoleDashboardView userRole="Owner" userName={session.user?.name || 'Owner'} />
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EnquiriesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leads');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
      <h1 className="text-xl font-bold text-teal-400">Redirecting to Lead Pipeline...</h1>
      <p className="text-sm text-slate-400">
        The system now uses a two-pipeline structure matching the sales spreadsheet: <strong>Lead Pipeline</strong> (Pre-Conversion) &amp; <strong>Event Bookings</strong> (Post-Conversion).
      </p>
      <div className="flex space-x-4">
        <Link href="/leads" className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded text-xs">
          Go to Leads Pipeline →
        </Link>
        <Link href="/bookings" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded text-xs border border-slate-700">
          Go to Event Bookings →
        </Link>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      const userRole = (session?.user as any)?.role?.name;
      if (userRole === 'Floral Designer') {
        router.replace('/designer');
      } else {
        router.replace('/dashboard');
      }
    } else if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-flora-dark text-slate-300 font-semibold text-xs space-y-3">
      <div className="w-9 h-9 border-3 border-flora-sage border-t-transparent rounded-full animate-spin"></div>
      <p className="animate-pulse">Redirecting to Thambaravila Flora ERP...</p>
    </div>
  );
}

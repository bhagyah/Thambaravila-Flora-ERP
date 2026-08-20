'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import AttendanceButton from './AttendanceButton';
import NotificationCenter from './NotificationCenter';
import ProfileModal from './ProfileModal';
import { useTheme } from '../context/ThemeContext';

function SunIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="4.25" />
      <path strokeLinecap="round" d="M12 2.75v2.5M12 18.75v2.5M4.75 12h2.5M16.75 12h2.5M6.1 6.1l1.77 1.77M16.13 16.13l1.77 1.77M17.9 6.1l-1.77 1.77M7.87 16.13 6.1 17.9" />
    </svg>
  );
}

function MoonIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 14.5A8.5 8.5 0 1 1 9.5 3a6.8 6.8 0 0 0 11.5 11.5Z" />
    </svg>
  );
}

function ChatIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.5h15v9h-7l-4.5 4v-4h-3.5z" />
    </svg>
  );
}

function LeaveIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75v2.5M17 3.75v2.5M4.75 8.5h14.5M6.5 5.5h11A1.75 1.75 0 0 1 19.25 7.25v12A1.75 1.75 0 0 1 17.5 21H6.5A1.75 1.75 0 0 1 4.75 19.25v-12A1.75 1.75 0 0 1 6.5 5.5Z" />
    </svg>
  );
}

function ProfileIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.2a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function LogoutIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 7V5.75A1.75 1.75 0 0 1 11.75 4h5.5A1.75 1.75 0 0 1 19 5.75v12.5A1.75 1.75 0 0 1 17.25 20h-5.5A1.75 1.75 0 0 1 10 18.25V17" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h10.5m0 0-3.25-3.25m3.25 3.25-3.25 3.25" />
    </svg>
  );
}

export default function HeaderBar() {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (session) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
      }
    } catch (error) {
      console.error('Failed to fetch profile', error);
    }
  };

  if (!session || !pathname || pathname === '/' || pathname.startsWith('/auth')) return null;

  const roleName = session.user?.role?.name || 'Staff';
  const avatar = userProfile?.avatarUrl || '👤';
  const isLight = theme === 'light';
  const shell = isLight
    ? 'border-[#DDD8D3] bg-[#F2F0EF]/95 text-[#1E2421] shadow-[0_8px_24px_rgba(40,35,30,0.06)]'
    : 'border-white/10 bg-[#171c1a] text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]';
  const buttonBase = isLight
    ? 'border-[#DDD8D3] bg-[#FAF9F8] text-[#2C3B34] hover:bg-[#E5E2DF] hover:text-[#111A15]'
    : 'border-white/10 bg-white/[0.08] text-slate-200 hover:bg-white/[0.12] hover:text-white';
  const iconButton = 'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition duration-200 hover:-translate-y-0.5';

  return (
    <>
      <header className={`sticky top-0 z-30 hidden items-center justify-between gap-4 border-b px-5 py-3.5 lg:flex lg:px-6 ${shell}`}>
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.3em] text-[#4E9D82]">
            Thambaravila Flora ERP Portal
          </div>
          <div className={`mt-1 hidden text-xs font-medium sm:block ${isLight ? 'text-[#5A625D]' : 'text-slate-400'}`}>
            {roleName} workspace
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <AttendanceButton />

          <Link href="/leave" className={`${iconButton} ${buttonBase}`} title="Leave Management Calendar">
            <LeaveIcon />
            <span className="hidden sm:inline">Leave</span>
          </Link>

          <Link href="/chat" className={`${iconButton} ${buttonBase}`} title="Open Team Chat">
            <ChatIcon />
            <span className="hidden sm:inline">Team Chat</span>
          </Link>

          <button
            onClick={toggleTheme}
            className={`${iconButton} group ${buttonBase} min-w-[9.5rem] justify-center`}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6BAF91]/15 text-[#4E9D82] transition-transform duration-200 group-hover:scale-110">
              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            </span>
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <NotificationCenter />

          <button
            onClick={() => setProfileModalOpen(true)}
            className={`${iconButton} ${buttonBase} px-2.5 py-2 text-left`}
            title="View & Edit Profile"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#6BAF91] to-[#4E9D82] text-sm font-black text-[#111817] shadow-sm">
              {avatar.length <= 2 ? avatar : avatar.slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className={`truncate text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {userProfile?.name || session.user?.name}
              </div>
              <div className="truncate text-[10px] font-semibold text-[#6BAF91]">{roleName}</div>
            </div>
            <ProfileIcon className="hidden h-4 w-4 sm:block" />
          </button>

          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className={`${iconButton} border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white`}
            title="Log Out"
          >
            <LogoutIcon />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {profileModalOpen && (
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => {
            setProfileModalOpen(false);
            fetchProfile();
          }}
        />
      )}
    </>
  );
}

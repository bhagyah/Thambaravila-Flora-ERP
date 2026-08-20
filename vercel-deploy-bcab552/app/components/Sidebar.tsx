'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import NotificationCenter from './NotificationCenter';
import ProfileModal from './ProfileModal';
import { useTheme } from '../context/ThemeContext';

type Accent = 'sage' | 'green' | 'teal' | 'amber' | 'violet' | 'rose' | 'sky' | 'slate';

const accentStyles: Record<Accent, { chip: string; active: string; rail: string }> = {
  sage: {
    chip: 'border-[#6BAF91]/35 bg-[#6BAF91]/12 text-[#bfe9d8]',
    active: 'border-[#6BAF91]/35 bg-[#6BAF91]/14 text-white',
    rail: 'bg-[#6BAF91]',
  },
  green: {
    chip: 'border-[#4E9D82]/35 bg-[#4E9D82]/12 text-[#bce7d6]',
    active: 'border-[#4E9D82]/35 bg-[#4E9D82]/14 text-white',
    rail: 'bg-[#4E9D82]',
  },
  teal: {
    chip: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    active: 'border-cyan-400/30 bg-cyan-400/12 text-white',
    rail: 'bg-cyan-400',
  },
  amber: {
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    active: 'border-amber-400/30 bg-amber-400/12 text-white',
    rail: 'bg-amber-400',
  },
  violet: {
    chip: 'border-violet-400/30 bg-violet-400/10 text-violet-100',
    active: 'border-violet-400/30 bg-violet-400/12 text-white',
    rail: 'bg-violet-400',
  },
  rose: {
    chip: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
    active: 'border-rose-400/30 bg-rose-400/12 text-white',
    rail: 'bg-rose-400',
  },
  sky: {
    chip: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
    active: 'border-sky-400/30 bg-sky-400/12 text-white',
    rail: 'bg-sky-400',
  },
  slate: {
    chip: 'border-white/[0.15] bg-white/[0.08] text-slate-100',
    active: 'border-white/[0.20] bg-white/[0.12] text-white',
    rail: 'bg-white/70',
  },
};

function MenuBadge({ abbr, accent, active = false }: { abbr: string; accent: Accent; active?: boolean }) {
  const styles = accentStyles[accent];
  return (
    <span
      className={[
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black tracking-[0.18em] shadow-sm',
        active ? styles.active : styles.chip,
      ].join(' ')}
    >
      {abbr}
    </span>
  );
}

function SidebarNavItem({
  href,
  label,
  abbr,
  accent,
  active,
  onClick,
  compact = false,
}: {
  href: string;
  label: string;
  abbr: string;
  accent: Accent;
  active: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const styles = accentStyles[accent];

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        'group relative flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200',
        active
          ? `${styles.active} shadow-[0_18px_40px_rgba(0,0,0,0.18)] ring-1 ring-white/10`
          : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.07] hover:text-white',
        compact ? 'min-h-11' : '',
      ].join(' ')}
    >
      <span
        className={[
          'absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-opacity',
          active ? styles.rail : 'opacity-0 group-hover:opacity-80',
        ].join(' ')}
      />
      <MenuBadge abbr={abbr} accent={accent} active={active} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function SidebarSubItem({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200',
        active
          ? 'border-white/[0.15] bg-white/10 text-white'
          : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.07] hover:text-slate-100',
      ].join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400/90">
      {children}
    </div>
  );
}

export default function Sidebar() {
  const { data: session } = useSession();
  const { theme } = useTheme();
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    if (!session) return;

    const fetchPermissions = async () => {
      try {
        const res = await fetch('/api/permissions/me');
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.permissions || []);
        }
      } catch (error) {
        console.error('Failed to fetch permissions', error);
      }
    };

    fetchPermissions();
  }, [session]);

  if (!session || !pathname || pathname === '/' || pathname.startsWith('/auth')) return null;

  const roleName = session.user?.role?.name || '';
  const hasPerm = (perm: string) => permissions.includes(perm);
  const isOwner = roleName === 'Owner';
  const isIT = roleName === 'IT/Admin';
  const isAccountant = roleName === 'Accountant' || isOwner;
  const isSales = roleName === 'Sales Manager' || isOwner;
  const isCoordinator = roleName === 'Wedding Coordinator' || isOwner;
  const isDesigner = roleName === 'Floral Designer' || isOwner || isCoordinator || isIT;
  const isSocial = roleName === 'Social Media Manager' || isOwner;
  const canViewLabourOperations = ['Owner', 'Accountant', 'IT/Admin'].includes(roleName);
  const isActive = (path: string) => pathname === path || pathname?.startsWith(`${path}/`);
  const isLight = theme === 'light';
  const mobileShell = isLight
    ? 'border-[#DCE4DF] bg-[#F7F8F5] text-[#18221D]'
    : 'border-white/10 bg-[#171c1a] text-white';
  const asideShell = isLight
    ? 'border-[#DCE4DF] bg-[#F7F8F5] text-[#18221D] shadow-[0_12px_36px_rgba(35,48,41,0.08)]'
    : 'border-white/10 bg-[#171c1a] text-white shadow-[0_12px_36px_rgba(0,0,0,0.22)]';
  const sectionShell = isLight
    ? 'border-[#DCE4DF] bg-[#EBF0EA]'
    : 'border-white/10 bg-white/5';
  const textStrong = isLight ? 'text-[#18221D]' : 'text-slate-100';
  const textMuted = isLight ? 'text-[#4A5B52]' : 'text-slate-400';

  const dashboardHref = roleName === 'Floral Designer' ? '/designer' : '/dashboard';
  const dashboardLabel = roleName === 'Floral Designer' ? 'Designer Studio' : 'Dashboard';
  const dashboardAccent: Accent = roleName === 'Floral Designer' ? 'rose' : 'sage';
  const dashboardAbbr = roleName === 'Floral Designer' ? 'DS' : 'DB';

  const coreLinks = useMemo(
    () => [
      { href: dashboardHref, label: dashboardLabel, abbr: dashboardAbbr, accent: dashboardAccent, active: isActive('/dashboard') || (roleName === 'Floral Designer' && isActive('/designer')) },
      { href: '/leads', label: 'Leads Pipeline', abbr: 'LD', accent: 'green' as Accent, active: isActive('/leads') },
      { href: '/bookings', label: 'Event Bookings', abbr: 'BK', accent: 'teal' as Accent, active: isActive('/bookings') },
      { href: '/customers', label: 'Customers', abbr: 'CU', accent: 'sky' as Accent, active: isActive('/customers') },
      { href: '/venues', label: 'Venues', abbr: 'VN', accent: 'amber' as Accent, active: isActive('/venues') },
      { href: '/vendors', label: 'Vendors', abbr: 'VD', accent: 'violet' as Accent, active: isActive('/vendors') },
    ],
    [dashboardAbbr, dashboardAccent, dashboardHref, dashboardLabel, isActive, roleName]
  );

  const canManageLeaves = isOwner || roleName === 'Accountant' || isIT;

  const toolLinks = [
    { href: '/settings/2fa', label: '2FA Security', abbr: '2F', accent: 'violet' as Accent, active: isActive('/settings/2fa') },
    { href: '/chat', label: 'Team Chat', abbr: 'CH', accent: 'teal' as Accent, active: isActive('/chat') },
    { href: '/leave', label: 'My Leave Calendar', abbr: 'LV', accent: 'amber' as Accent, active: isActive('/leave') },
    ...(canManageLeaves ? [{ href: '/leave/approve', label: 'Leave Assign & Approvals', abbr: 'LA', accent: 'amber' as Accent, active: isActive('/leave/approve') }] : []),
    { href: '/attendance', label: 'Attendance', abbr: 'AT', accent: 'sage' as Accent, active: isActive('/attendance') },
    ...(canViewLabourOperations ? [{ href: '/attendance/labour', label: 'Labour Attendance & Food', abbr: 'LF', accent: 'green' as Accent, active: isActive('/attendance/labour') }] : []),
    { href: '/work-sessions', label: 'Clock In / Out', abbr: 'TS', accent: 'green' as Accent, active: isActive('/work-sessions') },
    { href: '/approvals', label: 'Approvals', abbr: 'AP', accent: 'rose' as Accent, active: isActive('/approvals') },
  ];

  return (
    <>
      <div className={`fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b px-3 py-3 sm:px-4 lg:hidden ${mobileShell}`}>
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border shadow-sm ${isLight ? 'border-[#DCE4DF] bg-[#FAFBF8]' : 'border-white/10 bg-white/[0.08]'}`}>
            <Image src="/logo.png" alt="Thambaravila Flora" width={28} height={28} className="scale-[2.1] object-contain object-center" />
          </div>
          <div className="min-w-0">
            <div className={`truncate text-xs font-black tracking-[0.18em] ${textStrong}`}>THAMBARAVILA</div>
            <div className="truncate text-[10px] font-semibold tracking-[0.22em] text-[#6BAF91]">FLORA ERP</div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationCenter />
          <button
            onClick={() => setMobileOpen((value) => !value)}
            className={`grid h-11 w-11 place-items-center rounded-xl border ${isLight ? 'border-[#DCE4DF] bg-[#FAFBF8] text-[#18221D]' : 'border-white/10 bg-white/[0.08] text-slate-100'}`}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? (
              <span className="relative block h-4 w-4">
                <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 rotate-45 rounded-full bg-current" />
                <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            ) : (
              <span className="flex flex-col gap-1">
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
              </span>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/45 lg:hidden" />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[min(16.5rem,88vw)] flex-col justify-between overflow-hidden border-r transition-transform duration-300 lg:w-[16.5rem] ${asideShell} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className={`border-b p-4 ${isLight ? 'border-[#DCE4DF] bg-[#F4F6F2]' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-center gap-3">
              <div className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border shadow-sm ${isLight ? 'border-[#DCE4DF] bg-[#FAFBF8]' : 'border-white/10 bg-white/[0.08]'}`}>
                <Image src="/logo.png" alt="Thambaravila Flora" width={40} height={40} className="scale-[2.1] object-contain object-center" />
              </div>
              <div className="min-w-0">
                <div className={`truncate text-sm font-black tracking-[0.2em] ${textStrong}`}>THAMBARAVILA</div>
                <div className="truncate text-xs font-semibold tracking-[0.22em] text-[#6BAF91]">FLORA ERP PORTAL</div>
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border px-4 py-3 ${sectionShell}`}>
              <div className={`text-[10px] font-bold uppercase tracking-[0.24em] ${textMuted}`}>Active Role</div>
              <div className={`mt-1 text-sm font-semibold ${textStrong}`}>{roleName || 'Team Member'}</div>
              <div className={`mt-1 text-xs ${textMuted}`}>Operational access and live workflow control</div>
              <button
                type="button"
                onClick={() => {
                  setProfileModalOpen(true);
                  setMobileOpen(false);
                }}
                className={`mt-3 min-h-11 w-full rounded-xl border px-3 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  isLight
                    ? 'border-[#D2DBD4] bg-[#FAFBF8] text-[#2C3B34] hover:bg-[#EBF0EA] hover:text-[#111A15]'
                    : 'border-white/10 bg-white/[0.08] text-slate-200 hover:bg-white/[0.12]'
                }`}
              >
                <span>🖼️</span>
                <span>Profile &amp; Wallpaper</span>
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-3 p-3.5 text-sm">
            <SectionLabel>Main Modules</SectionLabel>
            <div className="space-y-1.5">
              {coreLinks.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  abbr={item.abbr}
                  accent={item.accent}
                  active={item.active}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>

            {(hasPerm('view_financial_dashboard') || isAccountant) && (
              <div className="space-y-2">
                <button
                  onClick={() => setAccountsOpen((value) => !value)}
                  className={[
                    'group relative flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200',
                    isActive('/accountant')
                      ? 'border-[#6BAF91]/30 bg-[#6BAF91]/14 text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]'
                      : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.07] hover:text-white',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute left-0 top-2 bottom-2 w-1 rounded-r-full',
                      isActive('/accountant') ? 'bg-[#6BAF91]' : 'bg-[#6BAF91]/50 opacity-0 group-hover:opacity-80',
                    ].join(' ')}
                  />
                  <MenuBadge abbr="AC" accent="sage" active={isActive('/accountant')} />
                  <span className="min-w-0 flex-1 truncate">Accounts &amp; Finance</span>
                  <span className="text-[10px] font-black tracking-[0.24em] text-slate-500">{accountsOpen ? 'UP' : 'DN'}</span>
                </button>

                {(accountsOpen || isActive('/accountant')) && (
                  <div className="space-y-2 border-l border-white/10 pl-4">
                    <SidebarSubItem href="/accountant/dues" label="Payment Dues" active={isActive('/accountant/dues')} onClick={() => setMobileOpen(false)} />
                    {isAccountant && <SidebarSubItem href="/accountant/liabilities" label="Scheduled Liabilities" active={isActive('/accountant/liabilities')} onClick={() => setMobileOpen(false)} />}
                    {isAccountant && <SidebarSubItem href="/accountant/cashflow-history" label="Payments & Receivables" active={isActive('/accountant/cashflow-history')} onClick={() => setMobileOpen(false)} />}
                    <SidebarSubItem href="/accountant/financials" label="Financial Summary" active={isActive('/accountant/financials')} onClick={() => setMobileOpen(false)} />
                    <SidebarSubItem href="/accountant/reports" label="P&amp;L Reports" active={isActive('/accountant/reports')} onClick={() => setMobileOpen(false)} />
                  </div>
                )}
              </div>
            )}

            {isSales && (
              <div className="space-y-1.5">
                <button
                  onClick={() => setSalesOpen((value) => !value)}
                  className={[
                    'group relative flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200',
                    isActive('/sales')
                      ? 'border-[#4E9D82]/30 bg-[#4E9D82]/14 text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]'
                      : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.07] hover:text-white',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute left-0 top-2 bottom-2 w-1 rounded-r-full',
                      isActive('/sales') ? 'bg-[#4E9D82]' : 'bg-[#4E9D82]/50 opacity-0 group-hover:opacity-80',
                    ].join(' ')}
                  />
                  <MenuBadge abbr="SL" accent="green" active={isActive('/sales')} />
                  <span className="min-w-0 flex-1 truncate">Sales Management</span>
                  <span className="text-[10px] font-black tracking-[0.24em] text-slate-500">{salesOpen ? 'UP' : 'DN'}</span>
                </button>

                {(salesOpen || isActive('/sales')) && (
                  <div className="space-y-2 border-l border-white/10 pl-4">
                    <SidebarSubItem href="/sales/analytics" label="Pattern Analytics" active={isActive('/sales/analytics')} onClick={() => setMobileOpen(false)} />
                  </div>
                )}
              </div>
            )}

            {isCoordinator && (
              <SidebarNavItem
                href="/coordinator"
                label="Events &amp; Calendar"
                abbr="EV"
                accent="amber"
                active={isActive('/coordinator')}
                onClick={() => setMobileOpen(false)}
              />
            )}

            {isDesigner && roleName !== 'Floral Designer' && (
              <SidebarNavItem
                href="/designer"
                label="Floral Designer Studio"
                abbr="DS"
                accent="rose"
                active={isActive('/designer')}
                onClick={() => setMobileOpen(false)}
              />
            )}

            {isSocial && (
              <SidebarNavItem
                href="/social"
                label="Social Media"
                abbr="SM"
                accent="violet"
                active={isActive('/social')}
                onClick={() => setMobileOpen(false)}
              />
            )}

            {isOwner && (
              <SidebarNavItem
                href="/owner/dashboard"
                label="Owner Portal"
                abbr="OW"
                accent="sage"
                active={isActive('/owner/dashboard')}
                onClick={() => setMobileOpen(false)}
              />
            )}

            {(isIT || isOwner) && (
              <div className="space-y-2">
                <button
                  onClick={() => setAdminOpen((value) => !value)}
                  className={[
                    'group relative flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-all duration-200',
                    isActive('/admin')
                      ? 'border-violet-400/30 bg-violet-400/14 text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]'
                      : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.07] hover:text-white',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute left-0 top-2 bottom-2 w-1 rounded-r-full',
                      isActive('/admin') ? 'bg-violet-400' : 'bg-violet-400/50 opacity-0 group-hover:opacity-80',
                    ].join(' ')}
                  />
                  <MenuBadge abbr="AD" accent="violet" active={isActive('/admin')} />
                  <span className="min-w-0 flex-1 truncate">Admin Control</span>
                  <span className="text-[10px] font-black tracking-[0.24em] text-slate-500">{adminOpen ? 'UP' : 'DN'}</span>
                </button>

                {(adminOpen || isActive('/admin')) && (
                  <div className="space-y-2 border-l border-white/10 pl-4">
                    <SidebarSubItem href="/admin/users" label="User Management" active={isActive('/admin/users')} onClick={() => setMobileOpen(false)} />
                    <SidebarSubItem href="/admin/config" label="System Config" active={isActive('/admin/config')} onClick={() => setMobileOpen(false)} />
                    <SidebarSubItem href="/admin/audit-logs" label="Audit Logs" active={isActive('/admin/audit-logs')} onClick={() => setMobileOpen(false)} />
                    <SidebarSubItem href="/admin/login-security" label="Login Security" active={isActive('/admin/login-security')} onClick={() => setMobileOpen(false)} />
                    <SidebarSubItem href="/admin/backups" label="Database Backups" active={isActive('/admin/backups')} onClick={() => setMobileOpen(false)} />
                    <SidebarSubItem href="/admin/geofences" label="Geofence Zones" active={isActive('/admin/geofences')} onClick={() => setMobileOpen(false)} />
                  </div>
                )}
              </div>
            )}

            <SectionLabel>Tools</SectionLabel>
            <div className="space-y-2">
              {toolLinks.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  abbr={item.abbr}
                  accent={item.accent}
                  active={item.active}
                  onClick={() => setMobileOpen(false)}
                  compact
                />
              ))}
            </div>
          </nav>

        </div>
      </aside>

      {profileModalOpen && (
        <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      )}
    </>
  );
}


'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import NotificationCenter from './NotificationCenter';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountantDropdown, setAccountantDropdown] = useState(false);
  const [salesDropdown, setSalesDropdown] = useState(false);
  const [adminDropdown, setAdminDropdown] = useState(false);

  useEffect(() => {
    if (session) {
      fetchPermissions();
    }
  }, [session]);

  const fetchPermissions = async () => {
    try {
      const res = await fetch('/api/permissions/me');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || []);
      }
    } catch (e) {
      console.error('Failed to fetch permissions', e);
    }
  };

  if (!session) return null;

  const roleName = session.user?.role?.name || '';
  const hasPerm = (perm: string) => permissions.includes(perm);

  const isOwner = roleName === 'Owner';
  const isIT = roleName === 'IT/Admin';
  const isAccountant = roleName === 'Accountant' || isOwner;
  const isSales = roleName === 'Sales Manager' || isOwner;
  const isCoordinator = roleName === 'Wedding Coordinator' || isOwner;
  const isSocial = roleName === 'Social Media Manager' || isOwner;

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <header className="bg-flora-dark/95 border-b border-flora-border text-white sticky top-0 z-40 shadow-2xl backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Main Navigation */}
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="flex items-center space-x-3 group">
              <div className="relative w-9 h-9 flex items-center justify-center bg-flora-darker rounded-xl p-1 border border-flora-border shadow-inner group-hover:scale-105 transition">
                <Image src="/logo.svg" alt="Thambaravila Flora Logo" width={32} height={32} className="object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm text-slate-100 tracking-wider font-mono">
                  THAMBARAVILA
                </span>
                <span className="text-[10px] text-flora-sage font-bold tracking-widest uppercase -mt-1">
                  FLORA ERP
                </span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium">
              <Link
                href="/dashboard"
                className={`px-3 py-2 rounded-md transition-colors ${
                  isActive('/dashboard') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                }`}
              >
                Dashboard
              </Link>

              <Link
                href="/leads"
                className={`px-3 py-2 rounded-md transition-colors ${
                  isActive('/leads') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                }`}
              >
                Leads
              </Link>

              <Link
                href="/bookings"
                className={`px-3 py-2 rounded-md transition-colors ${
                  isActive('/bookings') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                }`}
              >
                Bookings
              </Link>

              <Link
                href="/customers"
                className={`px-3 py-2 rounded-md transition-colors ${
                  isActive('/customers') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                }`}
              >
                Customers
              </Link>

              <Link
                href="/venues"
                className={`px-3 py-2 rounded-md transition-colors ${
                  isActive('/venues') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                }`}
              >
                Venues
              </Link>

              <Link
                href="/vendors"
                className={`px-3 py-2 rounded-md transition-colors ${
                  isActive('/vendors') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                }`}
              >
                Vendors
              </Link>

              {/* Accountant Dropdown */}
              {(hasPerm('view_financial_dashboard') || isAccountant) && (
                <div className="relative">
                  <button
                    onClick={() => setAccountantDropdown(!accountantDropdown)}
                    onBlur={() => setTimeout(() => setAccountantDropdown(false), 200)}
                    className={`px-3 py-2 rounded-md flex items-center space-x-1 transition-colors ${
                      isActive('/accountant') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                    }`}
                  >
                    <span>Accounts</span>
                    <span className="text-xs">▼</span>
                  </button>
                  {accountantDropdown && (
                    <div className="absolute left-0 mt-1 w-48 bg-flora-dark border border-flora-border rounded-md shadow-xl py-1 z-50">
                      <Link href="/accountant/dues" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        Payment Dues
                      </Link>
                      <Link href="/accountant/financials" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        Financial Summary
                      </Link>
                      <Link href="/accountant/reports" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        P&L Reports
                      </Link>
                      <Link href="/accountant/targets" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        Collection Targets
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Sales Dropdown */}
              {isSales && (
                <div className="relative">
                  <button
                    onClick={() => setSalesDropdown(!salesDropdown)}
                    onBlur={() => setTimeout(() => setSalesDropdown(false), 200)}
                    className={`px-3 py-2 rounded-md flex items-center space-x-1 transition-colors ${
                      isActive('/sales') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                    }`}
                  >
                    <span>Sales</span>
                    <span className="text-xs">▼</span>
                  </button>
                  {salesDropdown && (
                    <div className="absolute left-0 mt-1 w-48 bg-flora-dark border border-flora-border rounded-md shadow-xl py-1 z-50">
                      <Link href="/sales/targets" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        Sales Targets
                      </Link>
                      <Link href="/sales/analytics" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        Pattern Analytics
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {isCoordinator && (
                <Link
                  href="/coordinator"
                  className={`px-3 py-2 rounded-md transition-colors ${
                    isActive('/coordinator') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                  }`}
                >
                  Events
                </Link>
              )}

              {isSocial && (
                <Link
                  href="/social"
                  className={`px-3 py-2 rounded-md transition-colors ${
                    isActive('/social') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                  }`}
                >
                  Social
                </Link>
              )}

              {isOwner && (
                <Link
                  href="/owner/dashboard"
                  className={`px-3 py-2 rounded-md transition-colors ${
                    isActive('/owner/dashboard') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-flora-sage hover:bg-flora-card hover:text-white'
                  }`}
                >
                  Owner Portal
                </Link>
              )}

              {/* Admin Dropdown */}
              {(isIT || isOwner) && (
                <div className="relative">
                  <button
                    onClick={() => setAdminDropdown(!adminDropdown)}
                    onBlur={() => setTimeout(() => setAdminDropdown(false), 200)}
                    className={`px-3 py-2 rounded-md flex items-center space-x-1 transition-colors ${
                      isActive('/admin') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                    }`}
                  >
                    <span>Admin</span>
                    <span className="text-xs">▼</span>
                  </button>
                  {adminDropdown && (
                    <div className="absolute left-0 mt-1 w-48 bg-flora-dark border border-flora-border rounded-md shadow-xl py-1 z-50">
                      <Link href="/admin/users" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        User Management
                      </Link>
                      <Link href="/admin/config" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        System Config
                      </Link>
                      <Link href="/admin/audit-logs" className="block px-4 py-2 text-sm text-slate-200 hover:bg-flora-card hover:text-flora-sage">
                        Audit Logs
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <Link
                href="/chat"
                className={`px-3 py-2 rounded-md transition-colors ${
                  isActive('/chat') ? 'bg-flora-card text-flora-sage font-semibold border border-flora-border' : 'text-slate-300 hover:bg-flora-card hover:text-white'
                }`}
              >
                Chat
              </Link>
            </nav>
          </div>

          {/* Quick Tools & Profile */}
          <div className="hidden lg:flex items-center space-x-3">
            <NotificationCenter />

            <Link
              href="/work-sessions"
              className="px-3 py-1.5 bg-flora-darker hover:bg-flora-card text-slate-200 rounded-md text-xs font-semibold flex items-center space-x-1.5 border border-flora-border transition"
            >
              <span className="w-2 h-2 rounded-full bg-flora-sage animate-pulse"></span>
              <span>Clock In/Out</span>
            </Link>

            <Link
              href="/approvals"
              className="px-3 py-1.5 bg-flora-darker hover:bg-flora-card text-slate-200 rounded-md text-xs font-semibold border border-flora-border transition"
            >
              Approvals
            </Link>

            <div className="h-6 w-px bg-flora-border my-auto"></div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-100">{session.user.name}</div>
                <div className="text-[10px] text-flora-sage font-medium">{roleName}</div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-md text-xs font-semibold border border-rose-500/30 transition"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-flora-card focus:outline-none"
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-flora-dark border-b border-flora-border px-4 pt-2 pb-4 space-y-2">
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Dashboard
          </Link>
          <Link href="/leads" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Lead Pipeline
          </Link>
          <Link href="/bookings" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Bookings
          </Link>
          <Link href="/venues" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Venues Directory
          </Link>
          <Link href="/vendors" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Vendors Directory
          </Link>
          <Link href="/customers" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Customers
          </Link>
          <Link href="/accountant/dues" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Payment Dues
          </Link>
          <Link href="/accountant/financials" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Financial Summary
          </Link>
          <Link href="/sales/targets" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Sales Targets
          </Link>
          <Link href="/coordinator" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Events & Calendar
          </Link>
          <Link href="/social" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Social Media
          </Link>

          {isOwner && (
            <Link href="/owner/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-flora-sage hover:bg-flora-card">
              Owner Dashboard
            </Link>
          )}

          {(isIT || isOwner) && (
            <>
              <Link href="/admin/users" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
                User Management
              </Link>
              <Link href="/admin/audit-logs" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
                Audit Logs
              </Link>
            </>
          )}

          <Link href="/chat" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Internal Chat
          </Link>

          <Link href="/work-sessions" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-flora-card">
            Clock In / Work Sessions
          </Link>

          <div className="pt-4 border-t border-flora-border flex justify-between items-center">
            <div>
              <div className="text-sm font-semibold text-slate-200">{session.user.name}</div>
              <div className="text-xs text-flora-sage">{roleName}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

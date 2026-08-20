'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export default function NotificationCenter() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchNotifications();
      // Live background polling every 3.5 seconds
      const interval = setInterval(fetchNotifications, 3500);
      return () => clearInterval(interval);
    }
  }, [session, pathname]);

  useEffect(() => {
    // Close dropdown on outside click
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        const newNotifications: NotificationItem[] = data.notifications || [];
        const newUnreadCount: number = data.unreadCount || 0;

        // Check if there is a brand new unread notification
        if (newNotifications.length > 0) {
          const newest = newNotifications[0];
          if (!newest.isRead && newest.id !== lastSeenIdRef.current) {
            lastSeenIdRef.current = newest.id;
            
            // If user is away from /chat or notification is urgent/chat
            if (pathname !== '/chat' || newest.title.includes('Chat')) {
              setActiveToast(newest);
              setTimeout(() => {
                setActiveToast(null);
              }, 8000);
            }
          }
        }

        setNotifications(newNotifications);
        setUnreadCount(newUnreadCount);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  const handleMarkAsRead = async (id?: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { notificationId: id } : { markAllRead: true }),
      });

      if (res.ok) {
        fetchNotifications();
      }
    } catch (e) {
      console.error('Failed to mark read', e);
    }
  };

  if (!session) return null;

  const getBadgeTypeClass = (type: string) => {
    switch (type) {
      case 'URGENT': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'WARNING': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'SUCCESS': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Bell Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-xl bg-flora-darker hover:bg-flora-card text-slate-200 transition focus:outline-none border border-flora-border shadow"
          title="Notification Center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-flora-dark border border-flora-border rounded-2xl shadow-2xl z-50 overflow-hidden text-xs">
            {/* Header */}
            <div className="p-4 bg-flora-darker border-b border-flora-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-slate-100">Notification Center</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    {unreadCount} New
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={() => handleMarkAsRead()}
                  className="text-[11px] text-flora-sage hover:underline font-semibold"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-flora-border/60">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No notifications at this time.
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => !item.isRead && handleMarkAsRead(item.id)}
                    className={`p-3.5 transition flex items-start space-x-3 cursor-pointer ${
                      item.isRead ? 'bg-flora-dark/50 text-slate-400' : 'bg-flora-card/40 text-slate-100 font-medium'
                    } hover:bg-flora-card`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeTypeClass(item.type)}`}>
                          {item.type}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="font-bold text-slate-200 mt-1">{item.title}</div>
                      <p className="text-slate-400 leading-relaxed text-[11px]">{item.message}</p>

                      {item.link && (
                        <Link
                          href={item.link}
                          onClick={() => setIsOpen(false)}
                          className="inline-block text-[11px] text-flora-sage hover:underline font-semibold mt-1"
                        >
                          View Details →
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Live Pop-Up Toast Alert for Chat & Urgent Notifications */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 max-w-sm bg-flora-dark border border-flora-sage/60 p-4 rounded-2xl shadow-2xl z-50 text-xs space-y-2.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-flora-sage flex items-center space-x-1.5">
              <span>{activeToast.type === 'URGENT' ? '!' : 'i'}</span> <span>{activeToast.title}</span>
            </span>
            <button
              onClick={() => setActiveToast(null)}
              className="w-6 h-6 rounded-full bg-flora-card border border-flora-border text-slate-300 hover:text-white hover:bg-rose-600 font-black flex items-center justify-center transition"
              title="Close notification"
            >
              ✕
            </button>
          </div>
          <p className="text-slate-200 leading-snug">{activeToast.message}</p>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              onClick={() => setActiveToast(null)}
              className="px-3 py-1 bg-flora-card text-slate-300 font-bold rounded-lg border border-flora-border hover:bg-slate-800"
            >
              Dismiss
            </button>
            <Link
              href={activeToast.link || '/dashboard'}
              onClick={() => {
                handleMarkAsRead(activeToast.id);
                setActiveToast(null);
              }}
              className="px-3 py-1 bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-bold rounded-lg hover:from-flora-sage hover:to-flora-green transition shadow"
            >
              View Details
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

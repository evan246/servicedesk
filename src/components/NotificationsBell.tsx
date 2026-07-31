import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { navigate, type Route } from '../router';
import type { AppNotification } from '../types';

export default function NotificationsBell({ onGreen = false }: { onGreen?: boolean }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) console.error('Failed to load notifications:', error.message);
    const rows = (data as AppNotification[]) ?? [];
    setNotifications(rows);
    setUnreadCount(rows.filter((n) => !n.read).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime: listen for new notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifications((prev) => [n, ...prev]);
          setUnreadCount((c) => c + 1);
          // Fire a desktop notification if permission granted and tab not focused
          fireDesktopNotification(n);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        open &&
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function markAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }

  async function markAllRead() {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ read: true }).eq('user_id', user?.id).eq('read', false);
    setMarkingAll(false);
  }

  function handleClick(n: AppNotification) {
    if (!n.read) markAsRead(n.id);
    setOpen(false);
    navigate('/my-requests' as Route);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className={`relative rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
          onGreen
            ? 'text-white hover:bg-white/15'
            : 'text-ink-700/80 hover:bg-cream-100 focus-visible:ring-teal-500'
        }`}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
            onGreen ? 'bg-white text-teal-700' : 'bg-teal-600 text-cream-50'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-cream-200 bg-white shadow-lg animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
            <span className="text-sm font-semibold text-ink-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50"
              >
                {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex justify-center py-8 text-ink-700/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Inbox className="mb-2 h-8 w-8 text-ink-700/30" />
                <p className="text-sm text-ink-700/60">No notifications yet</p>
                <p className="mt-0.5 text-xs text-ink-700/45">You'll be notified here when your tickets are updated.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-3 border-b border-cream-100 px-4 py-3 text-left transition-colors hover:bg-cream-50 ${
                    !n.read ? 'bg-teal-50/40' : ''
                  }`}
                >
                  <div
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.read ? 'bg-transparent' : n.type === 'status_resolved' ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-ink-800">{n.message}</p>
                    <p className="mt-0.5 text-xs text-ink-700/45">{formatRelative(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// --- Browser push notification support ---
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function fireDesktopNotification(n: AppNotification) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  const title =
    n.type === 'status_resolved'
      ? `Ticket ${n.ticket_number} resolved`
      : `Ticket ${n.ticket_number} updated`;
  const body = n.message;
  const notif = new Notification(title, {
    body,
    icon: '/vite.svg',
    tag: n.id,
  });
  notif.onclick = () => {
    window.focus();
    notif.close();
  };
}
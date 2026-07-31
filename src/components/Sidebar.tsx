import { useEffect, useState } from 'react';
import { LifeBuoy, LogOut, PlusCircle, ClipboardList, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth';
import { useRoute, navigate, type Route } from '../router';
import NotificationsBell, { requestNotificationPermission, notificationsSupported } from './NotificationsBell';

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const route = useRoute();
  const isStaff = profile?.role === 'it_staff';

  const items: { label: string; route: Route; icon: typeof PlusCircle; show: boolean }[] = [
    { label: 'New request', route: '/', icon: PlusCircle, show: !isStaff },
    { label: 'My requests', route: '/my-requests', icon: ClipboardList, show: !isStaff },
    { label: 'Dashboard', route: '/dashboard', icon: LayoutDashboard, show: isStaff },
  ].filter((i) => i.show) as { label: string; route: Route; icon: typeof PlusCircle; show: boolean }[];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-cream-200 bg-cream-50/60 px-3 py-5 backdrop-blur-sm lg:flex">
        <div className="rounded-xl bg-teal-700 px-3 py-3 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="font-serif text-base font-semibold text-white">IT Desk</div>
                <div className="text-xs text-white/70">{isStaff ? 'Staff' : 'Teacher'}</div>
              </div>
            </div>
            <NotificationsBell onGreen />
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          <button
            onClick={() => signOut()}
            className="nav-item mb-2 w-full text-left text-ink-700/70 hover:bg-cream-100"
          >
            <ArrowLeft className="h-4.5 w-4.5 text-ink-700/60" />
            Back to login
          </button>
          {items.map((item) => {
            const active = route === item.route;
            return (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className={`nav-item w-full text-left ${
                  active ? 'bg-teal-50 text-teal-800' : 'text-ink-700/80 hover:bg-cream-100'
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 ${active ? 'text-teal-700' : 'text-ink-700/60'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-cream-200 pt-4">
          <div className="px-3">
            <div className="text-sm font-medium text-ink-900">{profile?.full_name}</div>
            <div className="text-xs capitalize text-ink-700/50">{profile?.role?.replace('_', ' ')}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="nav-item w-full text-left text-ink-700/70 hover:bg-cream-100"
          >
            <LogOut className="h-4.5 w-4.5 text-ink-700/60" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar with notifications */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-teal-700 bg-teal-700 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => signOut()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15"
            aria-label="Back to login"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-serif text-sm font-semibold text-white">IT Desk</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell onGreen />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-cream-200 bg-cream-50/95 backdrop-blur-md lg:hidden">
        {items.map((item) => {
          const active = route === item.route;
          return (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? 'text-teal-700' : 'text-ink-700/60'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

// Desktop notification permission prompt (teachers only, one-time)
export function DesktopNotificationPrompt() {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'it_staff';
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStaff) return;
    if (!notificationsSupported()) return;
    if (Notification.permission !== 'default') return;
    if (sessionStorage.getItem('notif-prompt-dismissed') === '1') return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [isStaff]);

  if (!show) return null;

  async function handleEnable() {
    await requestNotificationPermission();
    setShow(false);
  }

  function handleDismiss() {
    sessionStorage.setItem('notif-prompt-dismissed', '1');
    setShow(false);
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 w-72 rounded-xl border border-cream-200 bg-white p-4 shadow-lg animate-slide-up lg:bottom-4">
      <p className="text-sm font-medium text-ink-900">Get desktop notifications</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-700/60">
        Allow notifications so you're alerted when your tickets are updated — even if this tab is in the background.
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={handleEnable} className="btn-primary flex-1 py-1.5 text-xs">Enable</button>
        <button onClick={handleDismiss} className="btn-ghost text-xs">Not now</button>
      </div>
    </div>
  );
}

// Re-export a tiny hook for other components to detect desktop layout if needed.
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Inbox, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { CATEGORY_OPTIONS, type Ticket, type TicketCategory } from '../types';
import { StatusBadge, UrgencyBadge } from '../components/Badges';
import TicketDrawer from '../components/TicketDrawer';

export default function MyRequests() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) console.error('Failed to load tickets:', error.message);
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const channel = supabase
      .channel('my-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `user_id=eq.${user?.id}` },
        () => loadTickets(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadTickets]);

  const filtered = query.trim()
    ? tickets.filter((t) => {
        const q = query.toLowerCase();
        return (
          t.ticket_number.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label.toLowerCase().includes(q)
        );
      })
    : tickets;

  function handleTicketChanged(updated: Ticket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setActiveTicket((prev) => (prev?.id === updated.id ? updated : prev));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-semibold text-ink-900">My requests</h1>
        <p className="mt-1.5 text-sm text-ink-700/65">
          Track the status of every request you've submitted. Click any ticket for details and feedback.
        </p>
      </div>

      {tickets.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ticket number, department, or description…"
            className="input-field pl-9"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-700/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="card py-10 text-center text-sm text-ink-700/60">
          No tickets match "{query}".
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTicket(t)}
              className="card flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left transition-all duration-150 hover:border-teal-300 hover:shadow-card active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-teal-700">{t.ticket_number}</span>
                  <UrgencyBadge urgency={t.urgency} />
                </div>
                <div className="mt-1 truncate text-sm font-medium text-ink-900">
                  {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label} · {t.department}
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-700/55">{t.description}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-700/50">{formatRelative(t.created_at)}</span>
                <StatusBadge status={t.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {activeTicket && (
        <TicketDrawer
          ticket={activeTicket}
          onClose={() => setActiveTicket(null)}
          onTicketChanged={handleTicketChanged}
          isAdmin={false}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center animate-slide-up">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-ink-700/40">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-ink-800">No requests yet</p>
      <p className="mt-1 max-w-xs text-xs text-ink-700/60">
        When you submit a request from the New request page, it will appear here with a live status.
      </p>
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
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

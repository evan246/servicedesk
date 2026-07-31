import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Inbox,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Clock,
  CircleDot,
  CheckCircle2,
  Search,
  Check,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  URGENCY_RANK,
  type Ticket,
  type TicketStatus,
  type TicketCategory,
} from '../types';
import { StatusBadge, UrgencyBadge } from '../components/Badges';
import CommentThread from '../components/CommentThread';

type StatusFilter = 'all' | TicketStatus;
type CategoryFilter = 'all' | TicketCategory;
type SortKey = 'urgency' | 'date';
type SortDir = 'asc' | 'desc';

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');
  const [quickUpdating, setQuickUpdating] = useState<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<{ id: string; status: TicketStatus } | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError('Could not load tickets: ' + error.message);
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => loadTickets())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      open: tickets.filter((t) => t.status === 'open').length,
      inProgress: tickets.filter((t) => t.status === 'in_progress').length,
      resolvedThisMonth: tickets.filter(
        (t) => t.status === 'resolved' && t.resolved_at && new Date(t.resolved_at) >= monthStart,
      ).length,
    };
  }, [tickets]);

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || !!query.trim();

  function resetFilters() {
    setStatusFilter('all');
    setCategoryFilter('all');
    setQuery('');
  }

  const visible = useMemo(() => {
    let list = tickets;
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (categoryFilter !== 'all') list = list.filter((t) => t.category === categoryFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.ticket_number.toLowerCase().includes(q) ||
          t.requester_name.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'urgency') {
        const r = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        return sortDir === 'asc' ? r : -r;
      }
      const r = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === 'asc' ? r : -r;
    });
    return sorted;
  }, [tickets, statusFilter, categoryFilter, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  }

  function handleTicketChanged(updated: Ticket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function handleQuickStatus(ticket: Ticket, next: TicketStatus) {
    if (ticket.status === next) return;
    setQuickUpdating(ticket.id);
    setQuickError(null);
    const { data, error } = await supabase
      .from('tickets')
      .update({ status: next })
      .eq('id', ticket.id)
      .select()
      .maybeSingle();
    setQuickUpdating(null);
    if (error || !data) {
      setQuickError('Could not update status. Please try again.');
      setTimeout(() => setQuickError(null), 4000);
      return;
    }
    handleTicketChanged(data as Ticket);
    setQuickFeedback({ id: ticket.id, status: next });
    setTimeout(() => setQuickFeedback(null), 3000);

    // Email is best-effort — silent failure so staff don't see a scary error.
    // The in-app notification (bell) is handled by the database trigger.
    if (next === 'resolved' || next === 'in_progress') {
      sendEmailNotification(data.id);
    }
  }

  async function sendEmailNotification(ticketId: string) {
    try {
      const { data: session } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ ticketId }),
      });
    } catch {
      // Email not configured — in-app notification still works.
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-semibold text-ink-900">Service queue</h1>
        <p className="mt-1.5 text-sm text-ink-700/65">All submitted tickets across the school. Assign, update status, and reply.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3 animate-slide-up">
        <StatCard label="Open" value={stats.open} icon={CircleDot} tone="teal" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} tone="amber" />
        <StatCard label="Resolved this month" value={stats.resolvedThisMonth} icon={CheckCircle2} tone="stone" />
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets…"
            className="input-field pl-9"
          />
        </div>
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))]}
        />
        <FilterSelect
          label="Category"
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v as CategoryFilter)}
          options={[{ value: 'all', label: 'All categories' }, ...CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label }))]}
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-cream-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-sm">
          <span className="hidden text-ink-700/60 sm:inline">Sort</span>
          <SortButton label="Urgency" active={sortKey === 'urgency'} dir={sortDir} onClick={() => toggleSort('urgency')} />
          <SortButton label="Date" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {quickError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 animate-fade-in">{quickError}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-700/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <DashboardEmpty filtered={hasActiveFilters} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-soft animate-slide-up">
          <div className="hidden grid-cols-12 gap-4 border-b border-cream-200 bg-cream-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-700/60 sm:grid">
            <div className="col-span-4">Ticket</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-3">Department</div>
            <div className="col-span-2">Urgency</div>
          </div>
          <div className="divide-y divide-cream-200">
            {visible.map((t) => (
              <TicketRow
                key={t.id}
                ticket={t}
                expanded={expandedId === t.id}
                quickUpdating={quickUpdating === t.id}
                quickFeedback={quickFeedback?.id === t.id ? quickFeedback.status : null}
                onToggle={() => setExpandedId((id) => (id === t.id ? null : t.id))}
                onQuickStatus={(next) => handleQuickStatus(t, next)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  tone: 'teal' | 'amber' | 'stone';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    stone: 'bg-stone-100 text-stone-600',
  };
  return (
    <div className="card flex items-center gap-3 py-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none text-ink-900">{value}</div>
        <div className="mt-1 text-xs text-ink-700/60">{label}</div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-700/60 sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink-800 transition-colors focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-teal-50 text-teal-700' : 'text-ink-700/70 hover:bg-cream-100'
      }`}
    >
      {label}
      {active ? (
        dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );
}

function DashboardEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center animate-slide-up">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-ink-700/40">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-ink-800">{filtered ? 'No tickets match these filters' : 'No tickets yet'}</p>
      <p className="mt-1 text-xs text-ink-700/60">
        {filtered ? 'Try clearing the search or filters.' : 'When teachers submit requests, they will appear here.'}
      </p>
    </div>
  );
}

function TicketRow({
  ticket,
  expanded,
  quickUpdating,
  quickFeedback,
  onToggle,
  onQuickStatus,
}: {
  ticket: Ticket;
  expanded: boolean;
  quickUpdating: boolean;
  quickFeedback: TicketStatus | null;
  onToggle: () => void;
  onQuickStatus: (next: TicketStatus) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-1 gap-2 px-5 py-4 text-left transition-colors hover:bg-cream-50 sm:grid-cols-12 sm:items-center sm:gap-4"
      >
        <div className="col-span-4 min-w-0">
          <div className="font-mono text-xs font-semibold text-teal-700">{ticket.ticket_number}</div>
          <div className="mt-0.5 truncate text-sm font-medium text-ink-900">{ticket.requester_name}</div>
        </div>
        <div className="col-span-3 hidden text-sm text-ink-700 sm:block">
          {CATEGORY_OPTIONS.find((c) => c.value === ticket.category)?.label}
        </div>
        <div className="col-span-3 hidden truncate text-sm text-ink-700 sm:block">{ticket.department}</div>
        <div className="col-span-2 flex items-center justify-between sm:justify-start sm:gap-2">
          <UrgencyBadge urgency={ticket.urgency} />
          {expanded ? <ChevronUp className="h-4 w-4 text-ink-700/40" /> : <ChevronDown className="h-4 w-4 text-ink-700/40" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-cream-200 bg-cream-50/60 px-5 py-4">
          <p className="line-clamp-2 text-sm text-ink-700/80">{ticket.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-700/55">
            <span>Submitted {new Date(ticket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {ticket.resolved_at && <span>· Resolved {new Date(ticket.resolved_at).toLocaleDateString()}</span>}
            <StatusBadge status={ticket.status} />
          </div>

          {quickFeedback && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 animate-fade-in">
              <Check className="h-3.5 w-3.5" />
              Marked as {STATUS_OPTIONS.find((s) => s.value === quickFeedback)?.label}{quickFeedback === 'resolved' ? ' — the teacher will be notified' : ''}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink-700/60">Update status:</span>
            {STATUS_OPTIONS.map((opt) => {
              const active = ticket.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickStatus(opt.value);
                  }}
                  disabled={quickUpdating || active}
                  className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    active
                      ? 'border-teal-600 bg-teal-50 text-teal-800'
                      : 'border-cream-300 bg-white text-ink-700 hover:bg-cream-100'
                  }`}
                >
                  {quickUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? <Check className="h-3 w-3" /> : null}
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-cream-200 pt-4">
            <CommentThread ticketId={ticket.id} isAdmin={true} compact />
          </div>
        </div>
      )}
    </div>
  );
}

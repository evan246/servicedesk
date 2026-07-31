import { useEffect, useState } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Building2,
  Clock,
  CheckCircle2,
  Loader2,
  UserCheck,
  Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAssignees, displayNameForAssignee } from '../hooks';
import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  type Ticket,
  type TicketStatus,
} from '../types';
import { StatusBadge, UrgencyBadge } from './Badges';
import CommentThread from './CommentThread';

interface Props {
  ticket: Ticket;
  onClose: () => void;
  onTicketChanged: (t: Ticket) => void;
  isAdmin: boolean;
}

export default function TicketDrawer({ ticket, onClose, onTicketChanged, isAdmin }: Props) {
  const { assignees, loading: assigneesLoading } = useAssignees(isAdmin);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleStatusChange(next: TicketStatus) {
    if (ticket.status === next) return;
    setUpdatingStatus(true);
    setError(null);
    const { data, error } = await supabase
      .from('tickets')
      .update({ status: next })
      .eq('id', ticket.id)
      .select()
      .maybeSingle();
    setUpdatingStatus(false);
    if (error || !data) {
      setError('Could not update status. Please try again.');
      return;
    }
    onTicketChanged(data as Ticket);

    // Email is best-effort — silent failure so staff don't see a scary error.
    // The in-app notification (bell) is handled by the database trigger.
    if (isAdmin && (next === 'resolved' || next === 'in_progress')) {
      try {
        const { data: session } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session?.access_token ?? ''}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ ticketId: data.id }),
        });
      } catch {
        // Email not configured — in-app notification still works.
      }
    }
  }

  async function handleAssign(userId: string | null) {
    setUpdatingAssignee(true);
    setError(null);
    const { data, error } = await supabase
      .from('tickets')
      .update({ assigned_to: userId })
      .eq('id', ticket.id)
      .select()
      .maybeSingle();
    setUpdatingAssignee(false);
    if (error || !data) {
      setError('Could not assign ticket. Please try again.');
      return;
    }
    onTicketChanged(data as Ticket);
  }

  const assigneeName = displayNameForAssignee(assignees, ticket.assigned_to);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-900/30 animate-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-cream-50 shadow-2xl animate-drawer-in overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-200 bg-cream-50/95 px-5 py-4 backdrop-blur-sm">
          <div>
            <div className="font-mono text-sm font-semibold text-teal-700">{ticket.ticket_number}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <StatusBadge status={ticket.status} />
              <UrgencyBadge urgency={ticket.urgency} />
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost -mr-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Title + description */}
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
              {CATEGORY_OPTIONS.find((c) => c.value === ticket.category)?.label} — {ticket.department}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-700/60">
              <Calendar className="h-3.5 w-3.5" />
              Submitted {new Date(ticket.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="mt-4 rounded-lg border border-cream-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">Description</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{ticket.description}</p>
            </div>
          </div>

          {/* Requester details */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Requester</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Detail icon={UserIcon} label="Name" value={ticket.requester_name} />
              <Detail icon={Mail} label="Email" value={ticket.requester_email} />
              <Detail icon={Building2} label="Department" value={ticket.department} />
              <Detail
                icon={Clock}
                label="Resolved"
                value={ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString() : 'Not yet'}
              />
            </div>
          </div>

          {/* Assignment (admin only) */}
          {isAdmin && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Assigned to</h3>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <UserCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/40" />
                  <select
                    value={ticket.assigned_to ?? ''}
                    disabled={updatingAssignee || assigneesLoading}
                    onChange={(e) => handleAssign(e.target.value || null)}
                    className="input-field appearance-none pl-9 pr-8"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                {updatingAssignee && <Loader2 className="h-4 w-4 animate-spin text-ink-700/40" />}
              </div>
            </div>
          )}

          {!isAdmin && assigneeName && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Assigned to</h3>
              <div className="flex items-center gap-2 rounded-lg border border-cream-200 bg-white px-3.5 py-2.5">
                <UserCheck className="h-4 w-4 text-teal-700" />
                <span className="text-sm font-medium text-ink-800">{assigneeName}</span>
              </div>
            </div>
          )}

          {/* Status control (admin only) */}
          {isAdmin && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Status</h3>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const active = ticket.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                      disabled={updatingStatus || active}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                        active
                          ? 'border-teal-600 bg-teal-50 text-teal-800'
                          : 'border-cream-300 bg-white text-ink-800 hover:bg-cream-50'
                      }`}
                    >
                      {active && <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback / comments thread */}
          <CommentThread ticketId={ticket.id} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-cream-200 bg-white px-3.5 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-700/40" />
      <div className="min-w-0">
        <div className="text-xs text-ink-700/50">{label}</div>
        <div className="truncate text-sm font-medium text-ink-900">{value}</div>
      </div>
    </div>
  );
}

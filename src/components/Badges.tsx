import type { TicketStatus, TicketUrgency } from '../types';

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-teal-50 text-teal-700 border-teal-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
};

const STATUS_DOT: Record<TicketStatus, string> = {
  open: 'bg-teal-500',
  in_progress: 'bg-amber-500',
  resolved: 'bg-green-500',
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const URGENCY_STYLES: Record<TicketUrgency, string> = {
  low: 'bg-stone-100 text-stone-600 border-stone-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
};

const URGENCY_LABEL: Record<TicketUrgency, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function UrgencyBadge({ urgency }: { urgency: TicketUrgency }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${URGENCY_STYLES[urgency]}`}
    >
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

export function StatusDot({ status }: { status: TicketStatus }) {
  return <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />;
}

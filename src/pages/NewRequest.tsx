import { useState } from 'react';
import {
  Laptop,
  Wifi,
  MonitorPlay,
  AppWindow,
  MoreHorizontal,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import {
  CATEGORY_OPTIONS,
  URGENCY_OPTIONS,
  type Ticket,
  type TicketCategory,
  type TicketUrgency,
  type TicketInsert,
} from '../types';
import { UrgencyBadge } from '../components/Badges';

const CATEGORY_ICONS: Record<TicketCategory, typeof Laptop> = {
  hardware: Laptop,
  network: Wifi,
  software: AppWindow,
  projector: MonitorPlay,
  other: MoreHorizontal,
};

export default function NewRequest() {
  const { user, profile } = useAuth();
  const [confirmation, setConfirmation] = useState<Ticket | null>(null);

  if (confirmation) {
    return <Confirmation ticket={confirmation} onReset={() => setConfirmation(null)} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 animate-slide-up">
        <h1 className="text-2xl font-semibold text-ink-900">New IT request</h1>
        <p className="mt-1.5 text-sm text-ink-700/65">
          Tell us what's wrong and we'll get it into the queue. You'll get a ticket number to track it.
        </p>
      </div>
      <RequestForm
        defaultName={profile?.full_name ?? ''}
        defaultEmail={user?.email ?? ''}
        onSubmitted={(t) => setConfirmation(t)}
      />
    </div>
  );
}

function RequestForm({
  defaultName,
  defaultEmail,
  onSubmitted,
}: {
  defaultName: string;
  defaultEmail: string;
  onSubmitted: (t: Ticket) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [urgency, setUrgency] = useState<TicketUrgency | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !department.trim() || !category || !urgency || !description.trim()) {
      setError('Please fill in every field before submitting.');
      return;
    }
    setSubmitting(true);
    const payload: TicketInsert = {
      requester_name: name.trim(),
      requester_email: email.trim(),
      department: department.trim(),
      category,
      description: description.trim(),
      urgency,
    };
    const { data, error } = await supabase.from('tickets').insert(payload).select().maybeSingle();
    setSubmitting(false);
    if (error || !data) {
      setError(error?.message ?? 'Could not submit your request. Please try again.');
      return;
    }
    onSubmitted(data as Ticket);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6 animate-slide-up">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink-800">
            Your name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
            placeholder="Jane Martinez"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="you@school.edu"
          />
        </div>
      </div>

      <div>
        <label htmlFor="department" className="mb-1.5 block text-sm font-medium text-ink-800">
          Department or class
        </label>
        <input
          id="department"
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="input-field"
          placeholder="e.g. Science Dept, Grade 4 — Mr. Lee"
        />
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-ink-800">Category</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {CATEGORY_OPTIONS.map((opt) => {
            const Icon = CATEGORY_ICONS[opt.value];
            const selected = category === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCategory(opt.value)}
                className={`flex flex-col items-center gap-2 rounded-lg border px-2 py-4 text-center transition-all duration-150 active:scale-[0.97] ${
                  selected
                    ? 'border-teal-600 bg-teal-50 text-teal-800 ring-1 ring-teal-600'
                    : 'border-cream-300 bg-white text-ink-800 hover:bg-cream-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${selected ? 'text-teal-700' : 'text-ink-700/70'}`} />
                <span className="text-xs font-medium leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-ink-800">Urgency</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {URGENCY_OPTIONS.map((opt) => {
            const selected = urgency === opt.value;
            const ring =
              opt.value === 'high'
                ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                : opt.value === 'medium'
                  ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500'
                  : 'border-stone-400 bg-stone-50 ring-1 ring-stone-400';
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUrgency(opt.value)}
                className={`rounded-lg border p-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                  selected ? ring : 'border-cream-300 bg-white hover:bg-cream-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UrgencyBadge urgency={opt.value} />
                </div>
                <div className="mt-1.5 text-xs leading-snug text-ink-700/70">{opt.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-ink-800">
          Describe the problem
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-field min-h-[120px] resize-y"
          placeholder="What's happening? Which device or room is affected? Any error messages?"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </form>
  );
}

function Confirmation({ ticket, onReset }: { ticket: Ticket; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  function copyNumber() {
    navigator.clipboard?.writeText(ticket.ticket_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="card text-center animate-slide-up">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600 ring-4 ring-green-50/50">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold text-ink-900">Your request is in</h1>
        <p className="mt-2 text-sm text-ink-700/70">
          We've logged your ticket and sent it to the IT team. Keep this number for your records.
        </p>
        <button
          type="button"
          onClick={copyNumber}
          className="mx-auto mt-6 flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 px-4 py-2.5 transition-colors hover:bg-cream-100"
        >
          <span className="font-mono text-lg font-semibold tracking-wide text-teal-700">{ticket.ticket_number}</span>
          {copied ? <Check className="h-4 w-4 text-teal-700" /> : <Copy className="h-4 w-4 text-ink-700/50" />}
        </button>
        <p className="mt-1.5 text-xs text-ink-700/50">{copied ? 'Copied' : 'Tap to copy'}</p>

        <div className="mt-6 space-y-2 rounded-lg bg-cream-50 p-4 text-left text-sm">
          <SummaryRow
            label="Category"
            value={CATEGORY_OPTIONS.find((c) => c.value === ticket.category)?.label ?? ticket.category}
          />
          <SummaryRow label="Department" value={ticket.department} />
          <SummaryRow label="Urgency" value={<UrgencyBadge urgency={ticket.urgency} />} />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onReset} className="btn-primary w-full">
            Submit another request
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-700/60">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}

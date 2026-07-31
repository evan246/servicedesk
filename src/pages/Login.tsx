import { useState } from 'react';
import { LifeBuoy, Loader2, AlertCircle, GraduationCap, Wrench, Settings } from 'lucide-react';
import { useAuth } from '../auth';
import { navigate } from '../router';
import { supabaseConfigured } from '../lib/supabase';
import type { Role } from '../types';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('teacher');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error);
      } else {
        if (!fullName.trim()) {
          setError('Please enter your full name.');
          return;
        }
        const { error } = await signUp(email.trim(), password, fullName.trim(), role);
        if (error) setError(error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: 'signin' | 'signup') {
    setMode(next);
    setError(null);
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream-50 to-cream-100 px-4 py-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-soft">
              <Settings className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold text-ink-900">Setup required</h1>
            <p className="mt-1.5 text-sm text-ink-700/70">This app needs a database connection to work.</p>
          </div>
          <div className="card space-y-3">
            <p className="text-sm text-ink-800">
              The connection settings are missing on this deployment. If you're the site owner:
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-700/80">
              <li>Open your hosting dashboard (e.g. Vercel project settings)</li>
              <li>Add two environment variables:
                <ul className="ml-2 mt-1 list-disc text-xs text-ink-700/70">
                  <li><code className="rounded bg-cream-100 px-1">VITE_SUPABASE_URL</code> — your database URL</li>
                  <li><code className="rounded bg-cream-100 px-1">VITE_SUPABASE_ANON_KEY</code> — your database key</li>
                </ul>
              </li>
              <li>Redeploy the project</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream-50 to-cream-100 px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-cream-50 shadow-soft">
            <LifeBuoy className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-ink-900">School IT Desk</h1>
          <p className="mt-1.5 text-sm text-ink-700/70">Report IT issues and track them through to resolution.</p>
        </div>

        <div className="card">
          <div className="mb-6 flex rounded-lg bg-cream-100 p-1">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                mode === 'signin' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-700/70 hover:text-ink-800'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-700/70 hover:text-ink-800'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  placeholder="Jane Martinez"
                  autoComplete="name"
                />
              </div>
            )}

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
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-800">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="At least 6 characters"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-800">I am a…</label>
                <div className="grid grid-cols-2 gap-3">
                  <RoleCard
                    icon={GraduationCap}
                    label="Teacher"
                    description="Submit and track my own requests"
                    selected={role === 'teacher'}
                    onClick={() => setRole('teacher')}
                  />
                  <RoleCard
                    icon={Wrench}
                    label="IT Staff"
                    description="Manage all submitted tickets"
                    selected={role === 'it_staff'}
                    onClick={() => setRole('it_staff')}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-700/50">School IT Service Desk · For staff use</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-2 block w-full text-center text-xs text-teal-700 hover:text-teal-800"
        >
          Back to app
        </button>
      </div>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: typeof GraduationCap;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all duration-150 active:scale-[0.98] ${
        selected
          ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
          : 'border-cream-300 bg-white hover:bg-cream-50'
      }`}
    >
      <Icon className={`h-5 w-5 ${selected ? 'text-teal-700' : 'text-ink-700/60'}`} />
      <div>
        <div className={`text-sm font-semibold ${selected ? 'text-teal-800' : 'text-ink-800'}`}>{label}</div>
        <div className="mt-0.5 text-xs leading-snug text-ink-700/60">{description}</div>
      </div>
    </button>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { commentAuthor, type TicketComment } from '../types';

interface Props {
  ticketId: string;
  isAdmin: boolean;
  compact?: boolean;
}

export default function CommentThread({ ticketId, isAdmin, compact = false }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ticket_comments')
      .select('id, ticket_id, author_id, body, created_at, author:profiles!author_id(full_name, role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) console.error('Failed to load comments:', error.message);
    setComments((data as TicketComment[]) ?? []);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`comments-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, load]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    const { data, error } = await supabase
      .from('ticket_comments')
      .insert({ ticket_id: ticketId, body: body.trim() })
      .select('id, ticket_id, author_id, body, created_at, author:profiles!author_id(full_name, role)')
      .maybeSingle();
    setPosting(false);
    if (error || !data) {
      setError('Could not send your message. Please try again.');
      return;
    }
    setComments((prev) => [...prev, data as TicketComment]);
    setBody('');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4 text-ink-700/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h3 className={`mb-3 flex items-center gap-2 font-semibold uppercase tracking-wide text-ink-700/50 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        <MessageSquare className="h-3.5 w-3.5" />
        Conversation
      </h3>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {comments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cream-300 bg-white/50 px-4 py-5 text-center">
          <p className="text-sm text-ink-700/60">No messages yet.</p>
          <p className="mt-1 text-xs text-ink-700/45">
            {isAdmin ? 'Reply to the teacher here — they will see your message.' : 'Leave a note for the IT team about this request.'}
          </p>
        </div>
      ) : (
        <div className="max-h-64 space-y-2.5 overflow-y-auto scrollbar-thin pr-1">
          {comments.map((c) => {
            const isOwn = c.author_id === user?.id;
            const author = commentAuthor(c);
            const isStaff = author?.role === 'it_staff';
            return (
              <div key={c.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    isOwn
                      ? 'rounded-br-sm bg-teal-700 text-cream-50'
                      : 'rounded-bl-sm border border-cream-200 bg-white text-ink-800'
                  }`}
                >
                  {!isOwn && (
                    <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold">
                      <span className={isStaff ? 'text-teal-700' : 'text-ink-700/70'}>
                        {author?.full_name ?? 'Unknown'}
                      </span>
                      {isStaff && (
                        <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                          IT Staff
                        </span>
                      )}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{c.body}</p>
                  <div className={`mt-1 text-[10px] ${isOwn ? 'text-cream-50/60' : 'text-ink-700/40'}`}>
                    {new Date(c.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handlePost} className="mt-3">
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isAdmin ? 'Reply to the teacher…' : 'Add a note for the IT team…'}
            rows={2}
            className="input-field resize-none"
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="btn-primary shrink-0 px-3 py-2.5"
            aria-label="Send message"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

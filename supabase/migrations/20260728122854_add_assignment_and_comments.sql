/*
# Add ticket assignment, comments, and updated_at

## Overview
Extends the IT Service Request app so tickets can be assigned to specific IT staff
members and so teachers and IT staff can leave feedback/comments on a ticket. This
migration is additive only — no existing columns are dropped or renamed, and no
existing data is lost.

## 1. Modified Tables

### tickets
- `assigned_to` (uuid, nullable) — references auth.users(id) with ON DELETE SET NULL.
  When an IT staff member is assigned, this holds their user id; NULL means unassigned.
- `updated_at` (timestamptz, default now()) — tracks the last modification time. A
  BEFORE UPDATE trigger keeps it in sync with now() on every row update.

## 2. New Tables

### ticket_comments
- `id` (uuid, primary key)
- `ticket_id` (uuid, FK to tickets, ON DELETE CASCADE)
- `author_id` (uuid, FK to auth.users, ON DELETE CASCADE) — who wrote the comment
- `body` (text, not null) — the comment text
- `created_at` (timestamptz, default now())
This is the feedback thread. Both teachers and IT staff can post comments. Teachers
can only comment on their own tickets; IT staff can comment on any ticket. RLS enforces
this at the database level.

## 3. Security (RLS)

### ticket_comments
- SELECT: a user may read comments on a ticket they own OR any it_staff member.
  (Mirrors the tickets SELECT policy so a teacher sees the full thread on their own
  ticket, and IT staff see threads on every ticket.)
- INSERT: a user may insert a comment if they own the ticket OR are it_staff, and the
  comment's author_id must be themselves (auth.uid() = author_id).
- UPDATE: only it_staff may update comments.
- DELETE: only it_staff may delete comments.

### profiles (relaxed)
- The existing SELECT policy already allows it_staff to read all profiles, which is
  needed to resolve assigned_to user names on the dashboard. No change needed here.

## 4. Notes
- assigned_to defaults to NULL (unassigned). The frontend sets it when IT staff pick
  someone from the assignee dropdown.
- updated_at is maintained automatically by the trigger; the frontend never sets it.
- Comments are ordered by created_at ascending in the UI to read as a conversation.
- This migration is idempotent and safe to re-run.
*/

-- ---------- tickets: add assigned_to + updated_at ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'assigned_to') THEN
    ALTER TABLE public.tickets ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'updated_at') THEN
    ALTER TABLE public.tickets ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tickets_assigned_to_idx ON public.tickets(assigned_to);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.tickets;
CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- ticket_comments ----------
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_id_idx ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_comments_created_at_idx ON public.ticket_comments(created_at);

DROP POLICY IF EXISTS "select_own_ticket_or_all_for_it_staff" ON public.ticket_comments;
CREATE POLICY "select_own_ticket_or_all_for_it_staff"
ON public.ticket_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = public.ticket_comments.ticket_id
    AND (t.user_id = auth.uid() OR public.is_it_staff())
  )
);

DROP POLICY IF EXISTS "insert_own_ticket_or_it_staff" ON public.ticket_comments;
CREATE POLICY "insert_own_ticket_or_it_staff"
ON public.ticket_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = public.ticket_comments.ticket_id
    AND (t.user_id = auth.uid() OR public.is_it_staff())
  )
);

DROP POLICY IF EXISTS "update_for_it_staff" ON public.ticket_comments;
CREATE POLICY "update_for_it_staff"
ON public.ticket_comments FOR UPDATE
TO authenticated
USING (public.is_it_staff())
WITH CHECK (public.is_it_staff());

DROP POLICY IF EXISTS "delete_for_it_staff" ON public.ticket_comments;
CREATE POLICY "delete_for_it_staff"
ON public.ticket_comments FOR DELETE
TO authenticated
USING (public.is_it_staff());
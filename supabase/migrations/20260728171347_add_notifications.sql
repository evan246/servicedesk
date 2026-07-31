/*
# Add in-app notifications

## Overview
Adds a `notifications` table so teachers and IT staff receive in-app notifications
when ticket statuses change. A database trigger automatically creates a notification
row whenever a ticket's status is updated to 'in_progress' or 'resolved'. No external
service or API key is required — notifications live entirely in the database and are
surfaced in the app via a bell icon with an unread count.

## 1. New Tables

### notifications
- `id` (uuid, primary key)
- `user_id` (uuid, FK to auth.users, ON DELETE CASCADE) — who the notification is for
  (the ticket's requester/owner)
- `ticket_id` (uuid, FK to tickets, ON DELETE CASCADE) — the ticket this notification is about
- `ticket_number` (text) — denormalized for fast display without a join
- `message` (text) — human-readable message, e.g. "Your ticket TCK-0007 has been resolved."
- `type` (text) — either 'status_resolved' or 'status_in_progress'
- `read` (boolean, default false) — whether the user has seen it
- `created_at` (timestamptz, default now())

## 2. Triggers

### trg_notify_on_status_change (AFTER UPDATE on tickets)
When a ticket's status changes to 'in_progress' or 'resolved', this trigger inserts a
notification row for the ticket's owner (user_id). It only fires when the status actually
changes (OLD.status IS DISTINCT FROM NEW.status), so re-saving the same status doesn't
create duplicate notifications. It skips creating notifications for the user who made the
change (so IT staff don't notify themselves when they resolve a ticket they happen to own).
Runs as SECURITY DEFINER so it can INSERT into notifications regardless of the caller's RLS.

## 3. Security (RLS)

### notifications
- SELECT: a user may only read their own notifications (auth.uid() = user_id).
- UPDATE: a user may only update their own notifications (used for marking as read).
- INSERT: only the trigger (SECURITY DEFINER, bypasses RLS) inserts. No client INSERT policy.
- DELETE: a user may only delete their own notifications.

## 4. Notes
- This is fully self-contained — no external email service or API key needed.
- Notifications appear in real time via Supabase realtime subscriptions in the frontend.
- The trigger is idempotent-safe: it only fires on actual status transitions.
- ticket_number is denormalized into the notification so the bell dropdown can render
  without an extra join query.
*/

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('status_resolved', 'status_in_progress')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON public.notifications;
CREATE POLICY "delete_own_notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- No INSERT policy: only the trigger (SECURITY DEFINER) inserts notifications.

CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status actually changes to in_progress or resolved
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('in_progress', 'resolved') THEN
    -- Don't notify the user who made the change (avoids self-notification for IT staff)
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, ticket_id, ticket_number, message, type)
      VALUES (
        NEW.user_id,
        NEW.id,
        NEW.ticket_number,
        CASE WHEN NEW.status = 'resolved'
          THEN 'Your ticket ' || NEW.ticket_number || ' has been resolved.'
          ELSE 'Your ticket ' || NEW.ticket_number || ' is now in progress.'
        END,
        CASE WHEN NEW.status = 'resolved' THEN 'status_resolved' ELSE 'status_in_progress' END
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_status_change ON public.tickets;
CREATE TRIGGER trg_notify_on_status_change
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_on_status_change();
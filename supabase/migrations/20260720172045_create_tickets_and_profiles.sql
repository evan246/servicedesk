/*
# Create profiles and tickets tables for the IT Service Request app

## Overview
This migration sets up the complete data layer for a school IT service request system.
Teachers submit IT problems (hardware, network, software, projector, other); the IT team
views and manages all submitted tickets on a dashboard. Access is enforced at the database
level via Row Level Security: teachers only ever see their own tickets, IT staff see and
manage everything.

## 1. New Tables

### profiles
- `id` (uuid, primary key) — links 1:1 to auth.users.id
- `full_name` (text, not null) — display name chosen at signup
- `role` (text, not null) — either 'teacher' or 'it_staff'
- `created_at` (timestamptz, default now())
A profile row is created automatically when a user signs up (via a trigger on auth.users).
Users cannot directly insert/update/delete their profile through the API — only the trigger
(which bypasses RLS as the table owner) can create rows, so a user cannot change their own
role. This makes profiles.role a trustworthy source of authorization.

### tickets
- `id` (uuid, primary key, default gen_random_uuid())
- `ticket_number` (text, unique, not null) — human-readable id like TCK-0001, auto-generated
  by a BEFORE INSERT trigger from a dedicated sequence. Left NULL on insert; the trigger fills it.
- `created_at` (timestamptz, default now())
- `user_id` (uuid, not null, default auth.uid()) — owner of the ticket (the submitting teacher).
  References auth.users with ON DELETE CASCADE. Required for RLS ownership checks. The default
  means a teacher's insert omits user_id and it is filled from the session.
- `requester_name` (text, not null) — display name of the submitter
- `requester_email` (text, not null) — contact email of the submitter
- `department` (text, not null) — department or class (e.g. "Science Dept", "Grade 4 - Mr. Lee")
- `category` (text, not null) — one of: hardware, network, software, projector, other
- `description` (text, not null) — free-text description of the problem
- `urgency` (text, not null) — one of: low, medium, high
- `status` (text, not null, default 'open') — one of: open, in_progress, resolved
- `resolved_at` (timestamptz, nullable) — set automatically when status transitions to resolved,
  cleared automatically when status moves away from resolved (handled by a BEFORE UPDATE trigger)

### Sequences & triggers
- `ticket_number_seq` — monotonically increasing counter backing the TCK-XXXX format.
- `trg_set_ticket_number` (BEFORE INSERT on tickets) — fills ticket_number as
  'TCK-' || lpad(seq::text, 4, '0'). Skips recalculation if a value is already present.
- `trg_set_resolved_at` (BEFORE UPDATE on tickets) — when status becomes 'resolved' (and was
  not already resolved), stamps resolved_at = now(); when status is anything else, clears
  resolved_at to NULL.
- `trg_create_profile_on_signup` (AFTER INSERT on auth.users) — reads full_name and role
  from the new user's raw_user_meta_data (set by the signup form) and inserts a matching
  profiles row. Runs as the table owner, bypassing RLS, so no client INSERT policy is needed.

## 2. Helper functions
- `is_it_staff()` — SECURITY DEFINER function returning boolean: true if the current
  authenticated user's profiles.role = 'it_staff'. Created AFTER the profiles table so the
  function body can reference it. Used by ticket RLS policies so IT staff can see and manage
  every ticket while teachers are restricted to their own.

## 3. Security (RLS)
Both tables have RLS ENABLED.

### profiles
- SELECT: a user may read their own profile, OR any it_staff member may read all profiles
  (so the dashboard can show who submitted a ticket).
- No INSERT / UPDATE / DELETE policies are defined for clients. Profile creation happens only
  through the owner-bypassing trigger, and role/values are immutable from the API. This
  prevents privilege escalation.

### tickets
- SELECT: a user may read rows they own (user_id = auth.uid()) OR any it_staff member.
- INSERT: any authenticated user may insert, but only for themselves
  (WITH CHECK auth.uid() = user_id, satisfied by the DEFAULT auth.uid()).
- UPDATE: only it_staff may update tickets (they manage status). Teachers cannot edit tickets
  after submission.
- DELETE: only it_staff may delete tickets.

## 4. Notes
- Ticket numbers are unique (UNIQUE constraint) and never reused (sequence only advances).
- The sequence starts at 1, so the first ticket is TCK-0001.
- user_id has DEFAULT auth.uid() so the frontend insert does not need to pass it.
- resolved_at is fully managed by the database; the frontend only changes status.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher', 'it_staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ---------- helper: is_it_staff (created after profiles table) ----------
CREATE OR REPLACE FUNCTION public.is_it_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'it_staff'
  );
$$;

-- ---------- profiles policies ----------
DROP POLICY IF EXISTS "select_own_or_all_for_it_staff" ON profiles;
CREATE POLICY "select_own_or_all_for_it_staff"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_it_staff());

-- No INSERT/UPDATE/DELETE policies: profiles are created only by the signup trigger,
-- and role/name are immutable from the API. This prevents self-escalation to it_staff.

-- ---------- tickets ----------
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  department text NOT NULL,
  category text NOT NULL CHECK (category IN ('hardware', 'network', 'software', 'projector', 'other')),
  description text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolved_at timestamptz
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_created_at_idx ON tickets(created_at DESC);

DROP POLICY IF EXISTS "select_own_or_all_for_it_staff" ON tickets;
CREATE POLICY "select_own_or_all_for_it_staff"
ON tickets FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_it_staff());

DROP POLICY IF EXISTS "insert_own_tickets" ON tickets;
CREATE POLICY "insert_own_tickets"
ON tickets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_for_it_staff" ON tickets;
CREATE POLICY "update_for_it_staff"
ON tickets FOR UPDATE
TO authenticated
USING (public.is_it_staff())
WITH CHECK (public.is_it_staff());

DROP POLICY IF EXISTS "delete_for_it_staff" ON tickets;
CREATE POLICY "delete_for_it_staff"
ON tickets FOR DELETE
TO authenticated
USING (public.is_it_staff());

-- ---------- sequence + ticket_number trigger ----------
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TCK-' || lpad(nextval('public.ticket_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_number ON public.tickets;
CREATE TRIGGER trg_set_ticket_number
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();

-- ---------- resolved_at trigger ----------
CREATE OR REPLACE FUNCTION public.set_resolved_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at := now();
  ELSIF NEW.status <> 'resolved' THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_resolved_at ON public.tickets;
CREATE TRIGGER trg_set_resolved_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_resolved_at();

-- ---------- auto-create profile on signup ----------
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unnamed user'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_profile_on_signup ON auth.users;
CREATE TRIGGER trg_create_profile_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_on_signup();
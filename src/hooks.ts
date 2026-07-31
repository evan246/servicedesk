import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Assignee } from './types';

export function useAssignees(enabled: boolean) {
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'it_staff')
      .order('full_name', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Failed to load assignees:', error.message);
        setAssignees((data as Assignee[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { assignees, loading };
}

export function displayNameForAssignee(
  assignees: Assignee[],
  assignedTo: string | null | undefined,
): string | null {
  if (!assignedTo) return null;
  return assignees.find((a) => a.id === assignedTo)?.full_name ?? null;
}

export type Role = 'teacher' | 'it_staff';

export type TicketCategory = 'hardware' | 'network' | 'software' | 'projector' | 'other';
export type TicketUrgency = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Assignee {
  id: string;
  full_name: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  requester_name: string;
  requester_email: string;
  department: string;
  category: TicketCategory;
  description: string;
  urgency: TicketUrgency;
  status: TicketStatus;
  resolved_at: string | null;
  assigned_to: string | null;
  assignee?: Assignee | null;
}

export interface TicketInsert {
  requester_name: string;
  requester_email: string;
  department: string;
  category: TicketCategory;
  description: string;
  urgency: TicketUrgency;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string; role: Role }[] | null;
}

export function commentAuthor(c: TicketComment): { full_name: string; role: Role } | null {
  if (!c.author || c.author.length === 0) return null;
  return c.author[0];
}

export interface TicketCommentInsert {
  ticket_id: string;
  body: string;
}

export const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'network', label: 'Network' },
  { value: 'software', label: 'Software' },
  { value: 'projector', label: 'Projector / AV' },
  { value: 'other', label: 'Other' },
];

export const URGENCY_OPTIONS: { value: TicketUrgency; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Minor inconvenience, no rush' },
  { value: 'medium', label: 'Medium', description: 'Affects some work, needs attention' },
  { value: 'high', label: 'High', description: 'Blocking — cannot work until fixed' },
];

export const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

export const URGENCY_RANK: Record<TicketUrgency, number> = { high: 0, medium: 1, low: 2 };

export type NotificationType = 'status_resolved' | 'status_in_progress';

export interface AppNotification {
  id: string;
  user_id: string;
  ticket_id: string;
  ticket_number: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

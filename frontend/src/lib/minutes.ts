import { workCompanyPhoto } from "@/lib/work";

export type MinutesCompany = {
  id: number;
  name: string;
  parent: number | null;
  owner: number;
  owner_name?: string;
  logo?: string | null;
  status: string;
  is_owner?: boolean;
  created_at: string;
  updated_at?: string;
};

export type MinutesGroup = {
  id: number;
  company: number;
  company_name?: string;
  name: string;
  owner: number;
  owner_name?: string;
  logo?: string | null;
  status: string;
  is_default: boolean;
  my_role?: string | null;
  can_manage?: boolean;
  can_edit?: boolean;
  created_at: string;
  updated_at?: string;
};

export type MinutesMember = {
  id: number;
  user: number;
  phone_number: string;
  full_name: string;
  profile_image?: string | null;
  role: string;
  position_title: string;
  status: string;
  joined_at?: string | null;
};

export type MinutesInvitation = {
  id: number;
  group: number;
  group_name: string;
  company_id: number;
  invited_by: number;
  invited_by_name: string;
  invited_user: number | null;
  invited_name?: string;
  phone_number: string;
  role: string;
  position_title: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type MinutesItemStatus =
  | "created"
  | "in_progress"
  | "test"
  | "completed"
  | "cancelled";

export type MinutesItem = {
  id: number;
  title: string;
  description: string;
  priority: number;
  status: MinutesItemStatus;
  order: number;
  due_date: string | null;
  remaining_days: number | null;
  is_overdue: boolean;
  assignees: MinutesMember[];
  cloned_from: number | null;
  completed_at: string | null;
  can_edit: boolean;
  can_set_status: boolean;
  created_at: string;
  updated_at?: string;
};

export type MinutesMeeting = {
  id: number;
  name: string;
  group: number;
  group_name: string;
  group_logo?: string | null;
  company_id: number;
  company_name: string;
  date: string;
  meeting_number: number;
  description: string;
  status: "open" | "closed" | "archived";
  clerk_name: string;
  clerk_image?: string | null;
  item_count: number;
  open_item_count: number;
  can_clerk: boolean;
  can_delete?: boolean;
  items?: MinutesItem[];
  closed_at: string | null;
  created_at: string;
  updated_at?: string;
};

export const ITEM_STATUSES: MinutesItemStatus[] = [
  "created",
  "in_progress",
  "test",
  "completed",
  "cancelled",
];

export const ASSIGNABLE_ROLES = ["maintainer", "guest"] as const;

export function defaultMinutesPicture(kind: "group" | "company", id: number): string {
  if (kind === "company") {
    const index = ((Math.abs(id) - 1) % 2) + 1;
    return `/minutes/defaults/company-${index}.svg`;
  }
  const index = ((Math.abs(id) - 1) % 4) + 1;
  return `/minutes/defaults/group-${index}.svg`;
}

export function minutesCompanyPhoto(companyId: number): string {
  return workCompanyPhoto(companyId);
}

export function itemStatusClass(status: MinutesItemStatus): string {
  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "in_progress") return "bg-brand-50 text-navy-800";
  if (status === "test") return "bg-navy-800 text-white";
  if (status === "cancelled") return "bg-gray-100 text-gray-500 line-through";
  return "bg-gray-100 text-gray-600";
}

export function meetingStatusClass(status: string): string {
  if (status === "open") return "bg-brand-50 text-navy-800";
  if (status === "closed") return "bg-navy-800 text-white";
  return "bg-gray-100 text-gray-600";
}

export function priorityLabelKey(priority: number): string {
  if (priority >= 4) return "minutes.priority.critical";
  if (priority === 3) return "minutes.priority.high";
  if (priority === 1) return "minutes.priority.low";
  return "minutes.priority.medium";
}

export function peopleStatusClass(status: string): string {
  if (status === "pending") return "bg-amber-100 text-amber-900";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "expired" || status === "cancelled") return "bg-gray-100 text-gray-500";
  return "bg-green-100 text-green-800";
}

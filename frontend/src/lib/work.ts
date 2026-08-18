export type WorkCompany = {
  id: number;
  name: string;
  parent: number | null;
  owner: number;
  status: string;
  created_at: string;
};

export type WorkTeam = {
  id: number;
  company: number;
  company_name?: string;
  name: string;
  owner: number;
  status: string;
  can_manage?: boolean;
};

export type WorkTeamMember = {
  id: number;
  user: number;
  phone_number: string;
  full_name: string;
  profile_image?: string | null;
  position_title: string;
  status: string;
};

export type WorkInvitation = {
  id: number;
  team: number;
  team_name: string;
  company_id: number;
  phone_number: string;
  position_title: string;
  status: string;
  expires_at: string;
  invited_by_name: string;
};

export type WorkProject = {
  id: number;
  company: number;
  name: string;
  description: string;
  owner: number;
  status: string;
  priority: number;
  start_date: string | null;
  due_date: string | null;
  progress_percent: number;
  can_manage: boolean;
};

export type WorkProjectMember = {
  id: number;
  user: number;
  phone_number: string;
  full_name: string;
  role: string;
  status: string;
};

export type WorkTaskStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

export type WorkTask = {
  id: number;
  project: number;
  project_name: string;
  title: string;
  description: string;
  assigned_to: number | null;
  assignee_user_id: number | null;
  assignee_name: string | null;
  status: WorkTaskStatus;
  priority: number;
  difficulty: number;
  due_date: string | null;
  progress_percent: number;
};

export type WorkTaskStep = {
  id: number;
  title: string;
  order: number;
  is_completed: boolean;
};

export type WorkComment = {
  id: number;
  author: number;
  author_name: string;
  body: string;
  reply_to: number | null;
  created_at: string;
};

export type WorkTaskDetail = WorkTask & {
  steps: WorkTaskStep[];
  comments: WorkComment[];
};

export type WorkTaskRow = {
  id: number;
  title: string;
  status: WorkTaskStatus;
  priority: number;
  difficulty: number;
  due_date: string | null;
  project_id: number;
  project_name: string;
  progress_percent: number;
};

export type WorkTimelineItem = {
  id: string;
  kind: "activity" | "due" | "overdue";
  occurred_at: string | null;
  title: string;
  message: string;
  entity_type: string;
  entity_id: number;
  project_id: number | null;
  company_id: number | null;
  notification_type: string | null;
  reference_type: string;
  reference_id: number | null;
};

export type WorkTimeline = {
  due: WorkTimelineItem[];
  activity: WorkTimelineItem[];
  items: WorkTimelineItem[];
};

export type WorkDashboard = {
  is_manager: boolean;
  employee: {
    today: WorkTaskRow[];
    overdue: WorkTaskRow[];
    assigned: WorkTaskRow[];
    counts: { today: number; overdue: number; assigned: number };
  };
  manager: {
    projects: Array<
      WorkProject & {
        overdue_count: number;
        blocked_count: number;
        due_soon_count: number;
        unassigned_count: number;
      }
    >;
    at_risk: WorkProject[];
    unassigned_count: number;
    workload: Array<{ user_id: number; name: string; open_tasks: number }>;
    pending_invites: number;
    completed_this_week: number;
  } | null;
  timeline: WorkTimeline;
};

export type WorkNotification = {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_type: string;
  reference_id: number | null;
  created_at: string;
};

export type WorkUserLookup = {
  id: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  profile_image: string | null;
};

export const TASK_STATUS_LABELS: Record<WorkTaskStatus, string> = {
  todo: "برای انجام",
  in_progress: "در حال انجام",
  in_review: "بازبینی",
  blocked: "مسدود",
  done: "تمام",
  cancelled: "لغو",
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "کم",
  2: "متوسط",
  3: "بالا",
  4: "بحرانی",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "برنامه‌ریزی",
  in_progress: "در حال انجام",
  on_hold: "متوقف",
  completed: "تمام‌شده",
  cancelled: "لغو",
};

export const INVITE_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  accepted: "پذیرفته",
  rejected: "رد شده",
  expired: "منقضی",
  cancelled: "لغو",
};

export const TASK_STATUSES: WorkTaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export function taskStatusTone(
  status: WorkTaskStatus,
): "gray" | "blue" | "amber" | "green" | "red" {
  if (status === "done") return "green";
  if (status === "blocked" || status === "cancelled") return "red";
  if (status === "in_progress" || status === "in_review") return "blue";
  if (status === "todo") return "amber";
  return "gray";
}

export function priorityTone(priority: number): "gray" | "blue" | "amber" | "red" {
  if (priority >= 4) return "red";
  if (priority === 3) return "amber";
  if (priority === 2) return "blue";
  return "gray";
}

export function localIsoDate(value?: Date): string {
  const date = value ?? new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatFaDate(value: string | null | undefined): string {
  if (!value) return "بدون سررسید";
  const day = value.slice(0, 10);
  try {
    return new Date(`${day}T00:00:00`).toLocaleDateString("fa-IR");
  } catch {
    return day;
  }
}

/** Saturday → Friday week, matching the Persian calendar. */
export const WEEKDAY_FA = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

export function currentWeek(): Array<{
  iso: string;
  weekday: string;
  isToday: boolean;
  isWeekend: boolean;
}> {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayIso = localIsoDate(today);
  const offsetFromSaturday = (today.getDay() + 1) % 7;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - offsetFromSaturday);

  return WEEKDAY_FA.map((weekday, index) => {
    const date = new Date(saturday);
    date.setDate(saturday.getDate() + index);
    const iso = localIsoDate(date);
    return {
      iso,
      weekday,
      isToday: iso === todayIso,
      isWeekend: index === 6,
    };
  });
}

export function isOverdue(due: string | null | undefined, status?: string): boolean {
  if (!due || status === "done" || status === "cancelled") return false;
  return due.slice(0, 10) < localIsoDate();
}

export function notificationHref(item: {
  reference_type?: string;
  reference_id?: number | null;
  entity_type?: string;
  entity_id?: number;
  project_id?: number | null;
}): string {
  const type = item.reference_type || item.entity_type || "";
  const id = item.reference_id ?? item.entity_id;
  if (type === "task" && id) return `/work/tasks/${id}`;
  if (type === "project" && id) return `/work/projects/${id}`;
  if (type === "invitation" && id) return "/work/inbox";
  if (item.project_id) return `/work/projects/${item.project_id}`;
  return "/work";
}

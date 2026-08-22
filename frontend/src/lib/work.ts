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
  company_name?: string;
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

export type WorkLabel = {
  id: number;
  company: number;
  name: string;
  color: string;
  description?: string;
};

export type WorkBoardColumn = {
  id: number;
  project: number;
  name: string;
  color: string;
  position: number;
  status_key: WorkTaskStatus;
  is_closed: boolean;
  task_count?: number;
  tasks?: WorkTask[];
};

export type WorkBoard = {
  columns: WorkBoardColumn[];
};

export type WorkTask = {
  id: number;
  project: number;
  project_name: string;
  title: string;
  description: string;
  assigned_to: number | null;
  assignee_user_id: number | null;
  assignee_name: string | null;
  assignee_avatar?: string | null;
  status: WorkTaskStatus;
  column: number | null;
  column_name?: string | null;
  column_color?: string | null;
  labels?: WorkLabel[];
  priority: number;
  difficulty: number;
  start_date: string | null;
  due_date: string | null;
  progress_percent: number;
  can_move?: boolean;
  created_at?: string;
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
    at_risk: Array<
      WorkProject & {
        overdue_count?: number;
        blocked_count?: number;
        due_soon_count?: number;
        unassigned_count?: number;
      }
    >;
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

function parseHex(hex: string): [number, number, number] | null {
  const raw = (hex || "").replace("#", "");
  if (raw.length < 6) return null;
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

export function labelTextColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#fff";
  const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luma > 165 ? "#1f1f1f" : "#ffffff";
}

/** Soft wash of a hue — for column headers and label pills. */
export function colorAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return `rgba(31, 31, 31, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export const LABEL_COLORS = [
  "#14233A",
  "#1A2B49",
  "#243656",
  "#1B3A4A",
  "#2A2438",
  "#3A2430",
  "#1E3328",
  "#3A2E1C",
];

/** Keep column headers navy-dark even if an older light hue is stored. */
export function toHeaderColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#1A2B49";
  const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  if (luma <= 72) return hex;
  const scale = 62 / luma;
  return `#${[rgb[0], rgb[1], rgb[2]]
    .map((value) => Math.max(16, Math.min(80, Math.round(value * scale))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function teamColor(id: number): string {
  return LABEL_COLORS[Math.abs(id) % LABEL_COLORS.length];
}

export function shortFaDate(value: string | null | undefined): string {
  if (!value) return "";
  const day = value.slice(0, 10);
  try {
    return new Date(`${day}T00:00:00`).toLocaleDateString("fa-IR", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return day;
  }
}

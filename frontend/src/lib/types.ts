export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Profile = {
  phone_number: string;
  first_name: string;
  last_name: string;
  bio: string;
  profile_image: string | null;
  birth_date: string | null;
  company_name: string;
  job_title: string;
  /** True when the user has set a usable login password. */
  has_password: boolean;
};

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "CLOSED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TicketMessage = {
  id: number;
  sender: number;
  sender_name: string;
  message: string;
  is_admin_message: boolean;
  created_at: string;
};

export type Ticket = {
  id: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "باز",
  IN_PROGRESS: "در حال بررسی",
  WAITING_FOR_USER: "پاسخ پشتیبانی",
  CLOSED: "بسته",
};

export type ProjectStatus =
  | "draft"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ProjectRole = "owner" | "editor" | "viewer";

export type Project = {
  id: number;
  parent: number | null;
  parent_name?: string | null;
  name: string;
  company_name: string;
  description: string;
  status: ProjectStatus;
  is_active: boolean;
  is_root: boolean;
  /** Card colour: legacy key or Google Calendar hex. */
  color?: string;
  owner: number;
  my_role?: ProjectRole | null;
  is_shared_with_me?: boolean;
  process_count?: number;
  sub_project_count?: number;
  created_at: string;
  updated_at: string;
  sub_projects?: Project[];
};

export type ProjectMember = {
  id: number;
  user: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  profile_image?: string | null;
  role: ProjectRole;
  invited_by: number | null;
  created_at: string;
};

/** Lightweight user hit for invite-by-phone autocomplete. */
export type UserLookupResult = {
  id: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  profile_image: string | null;
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  owner: "مالک",
  editor: "ویرایشگر",
  viewer: "بیننده",
};

export type Process = {
  id: number;
  project: number;
  project_name?: string;
  name: string;
  description: string;
  process_owner_name: string;
  department: string;
  order: number;
  /** Card colour: legacy key or Google Calendar hex. */
  color?: string;
  owner: number;
  my_role?: ProjectRole | null;
  step_count?: number;
  created_at: string;
  updated_at: string;
};

export type ShapeType = "square" | "rectangle" | "circle" | "diamond" | "oval";

export type ProcessStep = {
  id: number;
  process: number;
  title: string;
  shape_type: ShapeType;
  position_x: number;
  position_y: number;
  order: number;
  created_at: string;
  updated_at: string;
};

export type StepConnection = {
  id: number;
  process: number;
  from_step: number;
  to_step: number;
  label: string;
  created_at: string;
  updated_at: string;
};

export type MediaSection = "explanation" | "risk" | "control";
export type MediaKind = "image" | "file" | "link";

export type StepMedia = {
  id: number;
  step: number;
  section: MediaSection;
  risk: number | null;
  control: number | null;
  kind: MediaKind;
  title: string;
  file: string | null;
  file_url: string | null;
  url: string;
  order: number;
};

export type StepItem = {
  id: number;
  step: number;
  title: string;
  content: string;
  order: number;
  media_items: StepMedia[];
};

export type ProcessStepDetail = ProcessStep & {
  process_name?: string;
  project?: number;
  project_name?: string;
  explanation: string;
  explanation_media: StepMedia[];
  risks: StepItem[];
  controls: StepItem[];
  my_role?: ProjectRole | null;
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  on_hold: "متوقف",
  completed: "تکمیل‌شده",
  cancelled: "لغو‌شده",
};

export const PROJECT_STATUS_OPTIONS = (
  Object.entries(PROJECT_STATUS_LABELS) as [ProjectStatus, string][]
).map(([value, label]) => ({ value, label }));

export const PROJECT_MEMBER_ROLE_OPTIONS: { value: Exclude<ProjectRole, "owner">; label: string }[] =
  [
    { value: "editor", label: PROJECT_ROLE_LABELS.editor },
    { value: "viewer", label: PROJECT_ROLE_LABELS.viewer },
  ];

/** Owner and editor can change project content. */
export function canEditProject(role?: ProjectRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canManageMembers(role?: ProjectRole | null): boolean {
  return role === "owner";
}

export const SHAPE_LABELS: Record<ShapeType, string> = {
  square: "مربع",
  rectangle: "مستطیل",
  circle: "دایره",
  diamond: "لوزی",
  oval: "بیضی",
};

/** Pixel footprint of each shape on the canvas, used to draw connector lines. */
export const SHAPE_SIZES: Record<ShapeType, { width: number; height: number }> = {
  square: { width: 112, height: 112 },
  rectangle: { width: 168, height: 84 },
  circle: { width: 112, height: 112 },
  diamond: { width: 112, height: 112 },
  oval: { width: 168, height: 84 },
};

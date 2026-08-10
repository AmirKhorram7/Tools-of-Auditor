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

export type ProjectStatus =
  | "draft"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export type Project = {
  id: number;
  parent: number | null;
  name: string;
  company_name: string;
  description: string;
  status: ProjectStatus;
  is_active: boolean;
  is_root: boolean;
  owner: number;
  process_count?: number;
  sub_project_count?: number;
  created_at: string;
  updated_at: string;
  sub_projects?: Project[];
};

export type Process = {
  id: number;
  project: number;
  name: string;
  description: string;
  process_owner_name: string;
  department: string;
  order: number;
  owner: number;
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
  explanation: string;
  explanation_media: StepMedia[];
  risks: StepItem[];
  controls: StepItem[];
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

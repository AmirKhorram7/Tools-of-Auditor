import { tokens } from "@/lib/api";

export type CourseLevel = "basic" | "advanced" | "professional";

export type EduTeacherCard = {
  id: number;
  name: string;
  headline?: string;
  photo_url?: string;
};

export type EduCourseCard = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  author_id: number | null;
  like_count: number;
  thumbnail_url?: string;
  level?: CourseLevel | string;
  teacher?: EduTeacherCard | null;
  category_id?: number | null;
  category_title?: string;
  subcategory_id?: number | null;
  subcategory_title?: string;
  chapter_count?: number;
  lesson_count?: number;
  student_count?: number;
};

export type EduCategoryNode = {
  id: number;
  title: string;
  children: { id: number; title: string }[];
};

export function courseCategories(courses: EduCourseCard[]): { id: number; title: string }[] {
  return courseCategoryTree(courses).map(({ id, title }) => ({ id, title }));
}

export function courseCategoryTree(courses: EduCourseCard[]): EduCategoryNode[] {
  const map = new Map<number, EduCategoryNode>();
  courses.forEach((course) => {
    if (!course.category_id || !course.category_title) return;
    if (!map.has(course.category_id)) {
      map.set(course.category_id, { id: course.category_id, title: course.category_title, children: [] });
    }
    const node = map.get(course.category_id);
    if (
      node &&
      course.subcategory_id &&
      course.subcategory_title &&
      !node.children.some((child) => child.id === course.subcategory_id)
    ) {
      node.children.push({ id: course.subcategory_id, title: course.subcategory_title });
    }
  });
  return [...map.values()];
}

export function filterCourses(
  courses: EduCourseCard[],
  levels: CourseLevel[] | CourseLevel | "",
  folderIds: number[] | number | null,
): EduCourseCard[] {
  const levelList = Array.isArray(levels) ? levels : levels ? [levels] : [];
  const folders = Array.isArray(folderIds) ? folderIds : folderIds ? [folderIds] : [];
  return courses.filter((course) => {
    if (levelList.length && !levelList.includes(courseLevel(course.level))) return false;
    if (folders.length) {
      const hit =
        (course.category_id != null && folders.includes(course.category_id)) ||
        (course.subcategory_id != null && folders.includes(course.subcategory_id));
      if (!hit) return false;
    }
    return true;
  });
}

export function courseLevel(level?: string): CourseLevel {
  if (level === "advanced" || level === "professional") return level;
  return "basic";
}

export type EduLessonBlock = {
  type: "heading" | "paragraph" | "image" | "document" | "quote" | "code" | "video_embed" | string;
  value: string | { url?: string; title?: string };
};

export type EduLesson = {
  id: number;
  title: string;
  short_description?: string;
  body: string;
  video_url?: string;
  video_file_url?: string;
  featured_image_url?: string;
  document_url?: string;
  document_title?: string;
  content?: EduLessonBlock[];
  has_quiz?: boolean;
  has_exam?: boolean;
};

export type EduModule = {
  id: number;
  title: string;
  summary: string;
  lessons: EduLesson[];
};

export type EduCourse = EduCourseCard & {
  modules: EduModule[];
};

export type EduQuiz = {
  id: number;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

export type EduComment = {
  id: number;
  course: number;
  lesson: number | null;
  parent?: number | null;
  author_id: number;
  author_name?: string;
  is_teacher?: boolean;
  body: string;
  like_count?: number;
  dislike_count?: number;
  my_vote?: number;
  created_at: string;
};

export type EduMe = {
  user_id: number;
  is_teacher: boolean;
  is_admin: boolean;
  can_build_course: boolean;
  cms_url: string;
  login: string;
  default_password: string | null;
};

export type EduTeacher = {
  user: number;
  name?: string;
  display_name?: string;
  headline?: string;
  bio: string;
  photo_url?: string;
  website?: string;
  linkedin_url?: string;
  telegram_url?: string;
  instagram_url?: string;
  projects?: string[];
  projects_text?: string;
  course_count?: number;
  student_count?: number;
  like_count?: number;
  courses: EduCourseCard[];
};

const PROGRESS_KEY = "ta_edu_done";

function readProgress(): Record<string, number[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "{}") as Record<string, number[]>;
  } catch {
    return {};
  }
}

export function doneLessonIds(courseId: number): number[] {
  return readProgress()[String(courseId)] ?? [];
}

export function markLessonDone(courseId: number, lessonId: number) {
  const all = readProgress();
  const key = String(courseId);
  const next = new Set(all[key] ?? []);
  next.add(lessonId);
  all[key] = [...next];
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export function unmarkLessonDone(courseId: number, lessonId: number) {
  const all = readProgress();
  const key = String(courseId);
  all[key] = (all[key] ?? []).filter((id) => id !== lessonId);
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export function flattenLessons(course: EduCourse): EduLesson[] {
  return course.modules.flatMap((module) => module.lessons);
}

export function lessonMinutes(lesson: EduLesson): number {
  const text = `${lesson.title} ${lesson.body ?? ""}`;
  return Math.max(4, Math.min(18, Math.round(text.length / 280) + (lesson.has_quiz || lesson.has_exam ? 3 : 0)));
}

export function moduleMinutes(module: EduModule): number {
  return module.lessons.reduce((sum, lesson) => sum + lessonMinutes(lesson), 0);
}

export function courseMinutes(course: EduCourse): number {
  return course.modules.reduce((sum, module) => sum + moduleMinutes(module), 0);
}

export function currentUserId(): number | null {
  const access = tokens.access;
  if (!access) return null;
  try {
    const payload = JSON.parse(atob(access.split(".")[1] ?? "")) as { user_id?: number };
    return payload.user_id ?? null;
  } catch {
    return null;
  }
}

export function safeHtml(html: string): string {
  return (html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");
}

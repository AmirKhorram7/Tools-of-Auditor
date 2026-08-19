"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "fa" | "en";

const STORAGE_KEY = "ta_locale";

type Dict = Record<string, string>;

const FA: Dict = {
  "brand.name": "تی‌ادیتور",
  "nav.home": "خانه",
  "nav.work": "مدیریت کار",
  "nav.explanation": "تشریح سیستم",
  "nav.contact": "ارتباط با ما",
  "nav.profile": "پروفایل",
  "nav.services": "سرویس‌ها",
  "nav.soon": "به‌زودی",
  "nav.workDesc": "کار روشن، پیشرفت قابل اندازه‌گیری",
  "nav.explanationDesc": "مستندسازی فرایند، ریسک و کنترل",
  "nav.auditPlan": "برنامه حسابرسی",
  "nav.workingPapers": "کاربرگ‌ها",
  "nav.myProfile": "پروفایل من",
  "nav.tools": "ابزارها",
  "nav.showTools": "نمایش پنل ابزارها",
  "nav.inbox": "اعلان‌ها",
  "nav.workHomeShort": "پیشخوان",
  "lang.fa": "فارسی",
  "lang.en": "English",

  "common.save": "ذخیره",
  "common.cancel": "انصراف",
  "common.delete": "حذف",
  "common.edit": "ویرایش",
  "common.later": "بعداً",
  "common.back": "بازگشت",
  "common.loading": "در حال بارگذاری...",
  "common.status": "وضعیت",
  "common.saving": "ذخیره...",
  "common.color": "رنگ کارت",
  "common.folder": "پوشه",
  "common.subfolder": "زیرپوشه",
  "common.process": "فرایند",
  "common.step": "گام",
  "common.service": "سرویس",

  "status.draft": "پیش‌نویس",
  "status.active": "فعال",
  "status.on_hold": "متوقف",
  "status.completed": "تکمیل‌شده",
  "status.cancelled": "لغو‌شده",
  "role.owner": "مالک",
  "role.editor": "ویرایشگر",
  "role.viewer": "بیننده",

  "login.title": "تی‌ادیتور | Tauditor",
  "login.subtitle": "ابزار حسابرسان داخلی و خارجی — ورود با شماره موبایل",
  "login.otp": "ورود با کد پیامک",
  "login.password": "ورود با رمز عبور",
  "login.phone": "شماره موبایل",
  "login.phoneHint": "مثال: 09121234567",
  "login.passwordLabel": "رمز عبور",
  "login.passwordPlaceholder": "رمز عبور",
  "login.submit": "ورود به تی‌ادیتور",
  "login.getCode": "دریافت کد تایید",
  "login.noPassword": "هنوز رمز عبور ندارید؟ با کد پیامک وارد شوید و در پروفایل رمز بسازید.",
  "login.accept": "با ورود، شرایط استفاده از سرویس را می‌پذیرید.",
  "login.codeSent": "کد ارسال‌شده به {phone} را وارد کنید.",
  "login.changePhone": "تغییر شماره",
  "login.code": "کد تایید",
  "login.resendIn": "ارسال مجدد کد تا {seconds} ثانیه دیگر",
  "login.resend": "ارسال مجدد کد",
  "login.phoneInvalid": "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.",
  "login.otpSent": "کد تایید پیامک شد. پیامک را بررسی کنید.",
  "login.sendFail": "ارسال کد ناموفق بود.",
  "login.codeInvalid": "کد تایید باید ۶ رقم باشد.",
  "login.codeWrong": "کد تایید نامعتبر است.",
  "login.passwordRequired": "رمز عبور را وارد کنید.",

  "dash.welcome": "خوش آمدید، {name}",
  "dash.pickService": "سرویس مورد نظر خود را از نوار بالا انتخاب کنید",
  "dash.enterWork": "ورود به مدیریت کار",
  "dash.enterExplanation": "ورود به تشریح سیستم",
  "dash.completeProfile": "تکمیل پروفایل",
  "dash.myFolders": "پوشه‌های من",
  "dash.sharedWithMe": "اشتراک‌شده با من",
  "dash.documentedProcesses": "فرایندهای مستندشده",
  "dash.workManage": "مدیریت کار",
  "dash.workHome": "پیشخوان کار",
  "dash.openTasks": "کارهای باز من",
  "dash.dueToday": "سررسید امروز",
  "dash.overdue": "عقب‌افتاده",
  "dash.recentFolders": "پوشه‌های اخیر من",
  "dash.viewAll": "مشاهده همه",
  "dash.noFolderYet": "هنوز پوشه‌ای نساخته‌اید. برای شروع به سرویس تشریح سیستم بروید.",
  "dash.createFirstFolder": "ساخت اولین پوشه",
  "dash.noShared": "هنوز پوشه‌ای با شما اشتراک گذاشته نشده است.",
  "dash.noCompany": "بدون نام شرکت",
  "dash.subfolders": "{count} زیرپوشه",
  "dash.processes": "{count} فرایند",
  "dash.profileTitle": "تکمیل پروفایل",
  "dash.profileHint": "برای همکاری راحت‌تر با دیگران، پروفایل خود را تکمیل کنید.",
  "dash.language": "زبان",

  "exp.title": "تشریح سیستم",
  "exp.subtitle": "پوشه بسازید، در آن فرایند تعریف کنید و گام‌های هر فرایند را مستند کنید.",
  "exp.treeView": "نمای درختی",
  "exp.newFolder": "پوشه جدید",
  "exp.createFolder": "ساخت پوشه",
  "exp.emptyTitle": "هنوز پوشه‌ای ندارید",
  "exp.emptyDesc": "برای شروع یک پوشه بسازید؛ مثل «سیستم دوشه» یا نام شرکت خودتان.",
  "exp.folderName": "نام پوشه",
  "exp.folderHint": "می‌تواند نام شرکت، یک حوزه کاری یا یک ایده شخصی باشد.",
  "exp.folderPlaceholder": "مثال: سیستم دوشه",
  "exp.companyOptional": "نام شرکت (اختیاری)",
  "exp.companyPlaceholder": "مثال: شرکت دوشه",
  "exp.description": "توضیحات",
  "exp.folderGoal": "هدف و دامنه این پوشه",
  "exp.editFolder": "ویرایش پوشه",
  "exp.deleteFolder": "حذف پوشه",
  "exp.deleteFolderConfirm": "پوشه «{name}» به همراه زیرپوشه‌ها و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟",
  "exp.loadFoldersFail": "دریافت پوشه‌ها ناموفق بود.",
  "exp.nameRequired": "نام پوشه الزامی است.",
  "exp.createFail": "ساخت پوشه ناموفق بود.",
  "exp.saveFail": "ذخیره پوشه ناموفق بود.",
  "exp.colorFail": "تغییر رنگ پوشه ناموفق بود.",
  "exp.deleteFail": "حذف پوشه ناموفق بود.",
  "exp.subfolders": "زیرپوشه‌ها",
  "exp.processes": "فرایندها",
  "exp.addProcess": "فرایند",
  "exp.addSubfolder": "زیرپوشه",
  "exp.share": "اشتراک‌گذاری",
  "exp.downloadPdf": "دانلود PDF",
  "exp.buildingPdf": "در حال ساخت PDF...",
  "exp.notFound": "پوشه پیدا نشد.",
  "exp.sharedWithMe": "اشتراک‌شده با من",
  "exp.accessHint": "دسترسی اعضا در پوشه اصلی تنظیم می‌شود.",
  "exp.goRoot": "رفتن به پوشه اصلی",
  "exp.rootFolder": "پوشه اصلی",
  "exp.noProcess": "فرایندی ثبت نشده است",
  "exp.noProcessDesc": "مثال: فرایند تدارکات، فرایند فروش، فرایند درآمد",
  "exp.createProcess": "ساخت فرایند",
  "exp.newSubfolder": "زیرپوشه جدید",
  "exp.subfolderName": "نام زیرپوشه",
  "exp.subfolderPlaceholder": "مثال: حوزه مالی",
  "exp.newProcess": "فرایند جدید",
  "exp.processName": "نام فرایند",
  "exp.processPlaceholder": "مثال: فرایند تدارکات",
  "exp.department": "واحد سازمانی",
  "exp.departmentPlaceholder": "مثال: بازرگانی",
  "exp.processOwner": "مالک فرایند",
  "exp.processOwnerPlaceholder": "نام مسئول فرایند",
  "exp.shareTitle": "اشتراک‌گذاری پوشه",
  "exp.shareHint": "با دعوت از طریق شماره موبایل، کل این پوشه (و زیرپوشه‌ها و فرایندها) برای همکار یا مدیر شما قابل مشاهده می‌شود.",
  "exp.noDept": "بدون واحد سازمانی",
  "exp.stepsCount": "{count} گام",
  "exp.notDocumented": "هنوز مستند نشده",
  "exp.allFolders": "همه پوشه‌ها",
  "exp.noFolders": "پوشه‌ای نیست.",
  "exp.currentStep": "گام فعلی",
  "exp.treeTitle": "نمای درختی",
  "exp.treeSubtitle": "کل ساختار کارتان در یک نگاه: پوشه، زیرپوشه، فرایند و گام.",
  "exp.treeEmpty": "پوشه‌ای برای نمایش نیست",
  "exp.treeEmptyDesc": "اول یک پوشه بسازید تا ساختار کارتان اینجا دیده شود.",
  "exp.showSteps": "نمایش گام‌ها",
  "exp.hideSteps": "بستن گام‌ها",
  "exp.openFolders": "باز کردن همه پوشه‌ها",
  "exp.layers": "ترتیب لایه‌ها:",
  "exp.treeHint": "روی هر کارت بزنید تا همان صفحه باز شود. با دکمه گِرد پایین هر کارت، زیرمجموعه‌های آن باز و بسته می‌شود.",
  "exp.folders": "پوشه‌ها",
};

const EN: Dict = {
  "brand.name": "Tauditor",
  "nav.home": "Home",
  "nav.work": "Work",
  "nav.explanation": "System explanation",
  "nav.contact": "Contact",
  "nav.profile": "Profile",
  "nav.services": "Services",
  "nav.soon": "Soon",
  "nav.workDesc": "Clear work, measurable progress",
  "nav.explanationDesc": "Document processes, risks and controls",
  "nav.auditPlan": "Audit plan",
  "nav.workingPapers": "Working papers",
  "nav.myProfile": "My profile",
  "nav.tools": "Tools",
  "nav.showTools": "Show tools panel",
  "nav.inbox": "Inbox",
  "nav.workHomeShort": "Home",
  "lang.fa": "فارسی",
  "lang.en": "English",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.later": "Later",
  "common.back": "Back",
  "common.loading": "Loading...",
  "common.status": "Status",
  "common.saving": "Saving...",
  "common.color": "Card color",
  "common.folder": "Folder",
  "common.subfolder": "Subfolder",
  "common.process": "Process",
  "common.step": "Step",
  "common.service": "Service",

  "status.draft": "Draft",
  "status.active": "Active",
  "status.on_hold": "On hold",
  "status.completed": "Completed",
  "status.cancelled": "Cancelled",
  "role.owner": "Owner",
  "role.editor": "Editor",
  "role.viewer": "Viewer",

  "login.title": "Tauditor",
  "login.subtitle": "For internal and external auditors — sign in with your phone number",
  "login.otp": "Sign in with SMS code",
  "login.password": "Sign in with password",
  "login.phone": "Phone number",
  "login.phoneHint": "Example: 09121234567",
  "login.passwordLabel": "Password",
  "login.passwordPlaceholder": "Password",
  "login.submit": "Sign in to Tauditor",
  "login.getCode": "Send verification code",
  "login.noPassword": "No password yet? Sign in with SMS, then set a password in your profile.",
  "login.accept": "By signing in you accept the terms of use.",
  "login.codeSent": "Enter the code sent to {phone}.",
  "login.changePhone": "Change number",
  "login.code": "Verification code",
  "login.resendIn": "Resend code in {seconds}s",
  "login.resend": "Resend code",
  "login.phoneInvalid": "Phone number must start with 09 and be 11 digits.",
  "login.otpSent": "Verification code sent. Check your SMS.",
  "login.sendFail": "Could not send the code.",
  "login.codeInvalid": "The code must be 6 digits.",
  "login.codeWrong": "The verification code is invalid.",
  "login.passwordRequired": "Enter your password.",

  "dash.welcome": "Welcome, {name}",
  "dash.pickService": "Choose a service from the top bar",
  "dash.enterWork": "Open Work",
  "dash.enterExplanation": "Open System explanation",
  "dash.completeProfile": "Complete profile",
  "dash.myFolders": "My folders",
  "dash.sharedWithMe": "Shared with me",
  "dash.documentedProcesses": "Documented processes",
  "dash.workManage": "Work",
  "dash.workHome": "Work dashboard",
  "dash.openTasks": "Open tasks",
  "dash.dueToday": "Due today",
  "dash.overdue": "Overdue",
  "dash.recentFolders": "Recent folders",
  "dash.viewAll": "View all",
  "dash.noFolderYet": "You have no folders yet. Start in System explanation.",
  "dash.createFirstFolder": "Create first folder",
  "dash.noShared": "Nothing has been shared with you yet.",
  "dash.noCompany": "No company name",
  "dash.subfolders": "{count} subfolders",
  "dash.processes": "{count} processes",
  "dash.profileTitle": "Complete your profile",
  "dash.profileHint": "Complete your profile so it is easier to collaborate.",
  "dash.language": "Language",

  "exp.title": "System explanation",
  "exp.subtitle": "Create a folder, add processes, and document each step.",
  "exp.treeView": "Tree view",
  "exp.newFolder": "New folder",
  "exp.createFolder": "Create folder",
  "exp.emptyTitle": "No folders yet",
  "exp.emptyDesc": "Create a folder to start — a company name, a work area, or a personal idea.",
  "exp.folderName": "Folder name",
  "exp.folderHint": "Can be a company, a work area, or a personal idea.",
  "exp.folderPlaceholder": "Example: Dooshe system",
  "exp.companyOptional": "Company name (optional)",
  "exp.companyPlaceholder": "Example: Dooshe",
  "exp.description": "Description",
  "exp.folderGoal": "Purpose and scope of this folder",
  "exp.editFolder": "Edit folder",
  "exp.deleteFolder": "Delete folder",
  "exp.deleteFolderConfirm": "Folder “{name}” and its subfolders and processes will be deleted. Continue?",
  "exp.loadFoldersFail": "Could not load folders.",
  "exp.nameRequired": "Folder name is required.",
  "exp.createFail": "Could not create the folder.",
  "exp.saveFail": "Could not save the folder.",
  "exp.colorFail": "Could not change the folder color.",
  "exp.deleteFail": "Could not delete the folder.",
  "exp.subfolders": "Subfolders",
  "exp.processes": "Processes",
  "exp.addProcess": "Process",
  "exp.addSubfolder": "Subfolder",
  "exp.share": "Share",
  "exp.downloadPdf": "Download PDF",
  "exp.buildingPdf": "Building PDF...",
  "exp.notFound": "Folder not found.",
  "exp.sharedWithMe": "Shared with me",
  "exp.accessHint": "Access is managed on the main folder.",
  "exp.goRoot": "Go to main folder",
  "exp.rootFolder": "Main folder",
  "exp.noProcess": "No processes yet",
  "exp.noProcessDesc": "Example: procurement, sales, revenue",
  "exp.createProcess": "Create process",
  "exp.newSubfolder": "New subfolder",
  "exp.subfolderName": "Subfolder name",
  "exp.subfolderPlaceholder": "Example: Finance",
  "exp.newProcess": "New process",
  "exp.processName": "Process name",
  "exp.processPlaceholder": "Example: Procurement process",
  "exp.department": "Department",
  "exp.departmentPlaceholder": "Example: Commerce",
  "exp.processOwner": "Process owner",
  "exp.processOwnerPlaceholder": "Name of the process owner",
  "exp.shareTitle": "Share folder",
  "exp.shareHint": "Invite by phone number to share this folder, its subfolders and processes.",
  "exp.noDept": "No department",
  "exp.stepsCount": "{count} steps",
  "exp.notDocumented": "Not documented yet",
  "exp.allFolders": "All folders",
  "exp.noFolders": "No folders.",
  "exp.currentStep": "Current step",
  "exp.treeTitle": "Tree view",
  "exp.treeSubtitle": "See the whole structure at a glance: folder, subfolder, process and step.",
  "exp.treeEmpty": "Nothing to show",
  "exp.treeEmptyDesc": "Create a folder first to see the structure here.",
  "exp.showSteps": "Show steps",
  "exp.hideSteps": "Hide steps",
  "exp.openFolders": "Expand all folders",
  "exp.layers": "Layers:",
  "exp.treeHint": "Click a card to open it. Use the round button under a card to expand or collapse it.",
  "exp.folders": "Folders",
};

const MESSAGES: Record<Locale, Dict> = { fa: FA, en: EN };

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

type I18nState = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  n: (value: number) => string;
};

const I18nContext = createContext<I18nState | null>(null);

function applyDocumentLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "fa" ? "rtl" : "ltr";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fa");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "fa") {
        setLocaleState(saved);
        applyDocumentLocale(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const table = MESSAGES[locale];
      return interpolate(table[key] ?? MESSAGES.fa[key] ?? key, vars);
    },
    [locale],
  );

  const n = useCallback(
    (value: number) => value.toLocaleString(locale === "fa" ? "fa-IR" : "en-US"),
    [locale],
  );

  const value = useMemo<I18nState>(
    () => ({
      locale,
      dir: locale === "fa" ? "rtl" : "ltr",
      setLocale,
      t,
      n,
    }),
    [locale, setLocale, t, n],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside LocaleProvider");
  }
  return ctx;
}

export function LanguageSwitch({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const { locale, setLocale } = useI18n();
  const dark = variant === "dark";

  return (
    <div
      className={
        dark
          ? "inline-flex rounded-lg bg-navy-800 p-0.5"
          : "inline-flex rounded-lg border border-gray-200 bg-white p-0.5"
      }
      role="group"
      aria-label="Language"
    >
      {(["fa", "en"] as Locale[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          className={
            locale === item
              ? dark
                ? "rounded-md bg-brand-500 px-2.5 py-1 text-xs font-bold text-ink"
                : "rounded-md bg-navy-900 px-2.5 py-1 text-xs font-bold text-white"
              : dark
                ? "rounded-md px-2.5 py-1 text-xs text-gray-300 hover:text-white"
                : "rounded-md px-2.5 py-1 text-xs text-gray-500 hover:text-ink"
          }
        >
          {item === "fa" ? "فا" : "EN"}
        </button>
      ))}
    </div>
  );
}

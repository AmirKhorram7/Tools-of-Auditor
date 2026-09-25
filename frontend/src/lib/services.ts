export type AppService = {
  key: string;
  href: string;
  available: boolean;
  labelKey: string;
  descKey: string;
  tone: "blue" | "green" | "amber" | "teal" | "rose" | "violet" | "navy" | "slate";
  icon: "home" | "work" | "minutes" | "docs" | "learn" | "contact" | "profile" | "plan" | "papers";
};

export const APP_SERVICES: AppService[] = [
  { key: "home", href: "/dashboard", available: true, labelKey: "nav.home", descKey: "nav.homeDesc", tone: "amber", icon: "home" },
  { key: "work", href: "/work", available: true, labelKey: "nav.work", descKey: "nav.workDesc", tone: "blue", icon: "work" },
  { key: "minutes", href: "/minutes", available: true, labelKey: "nav.minutes", descKey: "nav.minutesDesc", tone: "green", icon: "minutes" },
  { key: "explanation", href: "/explanation", available: true, labelKey: "nav.explanation", descKey: "nav.explanationDesc", tone: "navy", icon: "docs" },
  { key: "education", href: "/education", available: true, labelKey: "nav.education", descKey: "nav.educationDesc", tone: "teal", icon: "learn" },
  { key: "contact", href: "/contact", available: true, labelKey: "nav.contact", descKey: "nav.contactDesc", tone: "rose", icon: "contact" },
  { key: "profile", href: "/profile", available: true, labelKey: "nav.profile", descKey: "nav.profileDesc", tone: "violet", icon: "profile" },
  { key: "audit-plan", href: "#", available: false, labelKey: "nav.auditPlan", descKey: "nav.soon", tone: "slate", icon: "plan" },
  { key: "working-papers", href: "#", available: false, labelKey: "nav.workingPapers", descKey: "nav.soon", tone: "slate", icon: "papers" },
];

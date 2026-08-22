"use client";

import { useState } from "react";

import { Button } from "@/components/ui";

const COLUMNS = [
  { name: "برای انجام", color: "#14233A" },
  { name: "در حال انجام", color: "#1A2B49" },
  { name: "تست", color: "#243656" },
  { name: "در انتظار تأیید", color: "#C2940A" },
  { name: "بسته", color: "#1E3328" },
];

const SECTIONS = [
  {
    title: "بورد چیست؟",
    tone: "bg-[#EEF3FA] text-[#14233A] border-[#C5D3E8]",
    mark: "۱",
    body: "هر پروژه یک بورد دارد. کارها کارت هستند و ستون‌ها مرحله کار را نشان می‌دهند. کارت را بکشید و در ستون بعدی رها کنید.",
  },
  {
    title: "تنظیمات پروژه",
    tone: "bg-[#F3F0FA] text-[#3A2430] border-[#D8CDE6]",
    mark: "۲",
    body: "از تنظیمات می‌توانید برچسب رنگی بسازید، نام و رنگ ستون‌ها را عوض کنید، تیم را وصل کنید و بورد پیش‌فرض را انتخاب کنید.",
  },
  {
    title: "بورد استاندارد",
    tone: "bg-[#EEF6F1] text-[#1E3328] border-[#C5DCCE]",
    mark: "۳",
    body: "یک بورد آماده برای همه نوع کار: برای انجام، در حال انجام، تست، در انتظار تأیید، بسته. مدیر هنگام ساخت پروژه همین بورد را انتخاب می‌کند.",
  },
  {
    title: "سیاست تأیید",
    tone: "bg-[#FFF6E6] text-[#5C4308] border-[#E8D19A]",
    mark: "۴",
    body: "اگر روشن باشد، کارشناس کارت را فقط تا «در انتظار تأیید» می‌برد. مدیر اگر کار درست بود آن را به «بسته» می‌برد و کار تمام می‌شود. اگر کامل نبود، کارت را برمی‌گرداند. این سیاست را از تنظیمات روشن یا خاموش کنید.",
  },
  {
    title: "نقش‌ها",
    tone: "bg-[#FDECEC] text-[#6B1C1C] border-[#E8B4B4]",
    mark: "۵",
    body: "مالک و نگهدارنده مثل مدیر بورد هستند. توسعه‌دهنده و برنامه‌ریز کار می‌سازند و کارت جابه‌جا می‌کنند. مهمان فقط می‌بیند.",
  },
];

export default function WorkGuide({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant={compact ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        راهنما
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-[#14233A]/55"
            aria-label="بستن"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(20,35,58,0.28)]">
            <header className="shrink-0 bg-gradient-to-l from-[#1A2B49] to-[#14233A] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-wide text-white/70">
                    آموزش کوتاه
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold">راهنمای کار</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-white/10 px-2 py-1 text-sm text-white/80 hover:bg-white/20"
                  aria-label="بستن"
                >
                  ✕
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/85">
                شرکت بسازید، تیم دعوت کنید، پروژه باز کنید و کارها را روی بورد جلو ببرید.
              </p>
              <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
                {COLUMNS.map((column) => (
                  <span
                    key={column.name}
                    className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: column.color }}
                  >
                    {column.name}
                  </span>
                ))}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
              {SECTIONS.map((section) => (
                <section
                  key={section.title}
                  className={`rounded-xl border px-3 py-3 ${section.tone}`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-white/80 text-[11px] font-bold">
                      {section.mark}
                    </span>
                    <h3 className="text-sm font-bold">{section.title}</h3>
                  </div>
                  <p className="text-[13px] leading-7">{section.body}</p>
                </section>
              ))}
            </div>

            <footer className="shrink-0 border-t border-black/[0.06] bg-[#F7F8FA] px-4 py-3">
              <Button className="w-full" onClick={() => setOpen(false)}>
                متوجه شدم
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

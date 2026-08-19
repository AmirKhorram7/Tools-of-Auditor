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
const COOKIE_KEY = "ta_locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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
  "nav.hideTools": "پنهان",
  "nav.tools": "ابزارها",
  "nav.showTools": "نمایش پنل ابزارها",
  "nav.inbox": "اعلان‌ها",
  "nav.workHomeShort": "پیشخوان",
  "lang.fa": "فارسی",
  "lang.en": "English",

  "common.create": "ساخت",
  "common.add": "افزودن",
  "common.close": "بستن",
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
  "common.user": "کاربر",
  "common.invite": "دعوت",

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
  "exp.deleteFail": "حذف ناموفق بود.",
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
  "exp.colorThisFolder": "رنگ این پوشه",
  "exp.deleteSubfolder": "حذف زیرپوشه",
  "exp.deleteProcess": "حذف فرایند",
  "exp.editProcess": "ویرایش فرایند",
  "exp.editSubfolder": "ویرایش زیرپوشه",
  "exp.subfolderNameRequired": "نام زیرپوشه الزامی است.",
  "exp.processNameRequired": "نام فرایند الزامی است.",
  "exp.createSubfolderFail": "ساخت زیرپوشه ناموفق بود.",
  "exp.createProcessFail": "ساخت فرایند ناموفق بود.",
  "exp.role": "نقش",
  "exp.members": "اعضای فعلی",
  "exp.noMembers": "هنوز عضوی دعوت نشده است.",
  "exp.statusSaved": "وضعیت پوشه ذخیره شد.",
  "exp.phoneLookupHint": "با تایپ شماره، کاربران ثبت‌شده پیشنهاد می‌شوند.",
  "exp.searching": "در حال جستجو...",
  "exp.deleteSubfolderConfirm": "زیرپوشه «{name}» و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟",
  "exp.deleteProcessConfirm": "فرایند «{name}» و همه گام‌های آن حذف می‌شود. ادامه می‌دهید؟",
  "exp.deleteSelfConfirm": "«{name}» به همراه همه زیرپوشه‌ها و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟",
  "exp.colorThisProcess": "رنگ این فرایند",
  "exp.processNotFound": "فرایند پیدا نشد.",
  "exp.loadProcessFail": "دریافت فرایند ناموفق بود.",
  "exp.colorProcessFail": "تغییر رنگ فرایند ناموفق بود.",
  "exp.stepTitleRequired": "عنوان گام الزامی است.",
  "exp.addStepFail": "افزودن گام ناموفق بود.",
  "exp.connectFail": "ایجاد اتصال ناموفق بود.",
  "exp.disconnectFail": "حذف اتصال ناموفق بود.",
  "exp.pdfFail": "دانلود PDF ناموفق بود.",
  "exp.processOwnerLine": "مالک فرایند: {name}",
  "exp.addStep": "افزودن گام",
  "exp.canvasHintEdit": "شکل‌ها را با کشیدن جابه‌جا کنید و با کلیک روی هر شکل، صفحه مستندسازی آن گام (تشریح، ریسک، کنترل) را باز کنید. برای رسم فلش بین دو گام، دکمه «اتصال گام‌ها» را بزنید و ابتدا گام مبدأ و سپس گام مقصد را انتخاب کنید.",
  "exp.canvasHintView": "حالت مشاهده: روی هر شکل کلیک کنید تا تشریح، ریسک، کنترل و پیوست‌های آن گام را ببینید. امکان ویرایش یا بارگذاری فایل وجود ندارد.",
  "exp.stepList": "فهرست گام‌ها",
  "exp.stepTitle": "عنوان گام",
  "exp.stepTitlePlaceholder": "مثال: گام ۱ - درخواست خرید",
  "exp.shapeOnCanvas": "شکل روی نمودار",
  "exp.deleteStep": "حذف گام",
  "exp.deleteProcessDeepConfirm": "فرایند «{name}» به همراه همه گام‌ها، ریسک‌ها و کنترل‌های آن حذف می‌شود. ادامه می‌دهید؟",
  "exp.deleteStepConfirm": "گام «{name}» و مستندات و اتصال‌های آن حذف می‌شود. ادامه می‌دهید؟",
  "exp.stepNotFound": "گام پیدا نشد.",
  "exp.loadStepFail": "دریافت گام ناموفق بود.",
  "exp.stepHintEdit": "این گام را در سه بخش تشریح، ریسک و کنترل مستند کنید.",
  "exp.stepHintView": "حالت مشاهده: می‌توانید محتوا و پیوست‌ها را ببینید، اما ویرایش غیرفعال است.",
  "exp.tabExplanation": "تشریح سیستم",
  "exp.tabRisks": "ریسک‌ها",
  "exp.tabControls": "کنترل‌ها",
  "exp.explanationPlaceholder": "شرح کامل این گام از فرایند را بنویسید...",
  "exp.explanationSaved": "تشریح ذخیره شد.",
  "exp.saveExplanationFail": "ذخیره تشریح ناموفق بود.",
  "exp.saveExplanation": "ذخیره تشریح",
  "exp.titleRequired": "عنوان الزامی است.",
  "exp.createItemFail": "ثبت ناموفق بود.",
  "exp.newRisk": "ریسک جدید",
  "exp.newControl": "کنترل جدید",
  "exp.itemTitle": "عنوان",
  "exp.riskTitlePlaceholder": "مثال: خرید بدون تاییدیه مدیر",
  "exp.controlTitlePlaceholder": "مثال: تایید دو مرحله‌ای درخواست خرید",
  "exp.addRisk": "+ افزودن ریسک",
  "exp.addControl": "+ افزودن کنترل",
  "exp.noRisks": "ریسکی ثبت نشده است",
  "exp.noControls": "کنترلی ثبت نشده است",
  "exp.itemsHintEdit": "برای این گام موارد شناسایی‌شده را ثبت کنید.",
  "exp.itemsHintView": "برای این گام موردی ثبت نشده است.",
  "exp.saved": "ذخیره شد.",
  "exp.confirmDeleteItem": "این مورد حذف شود؟",
  "exp.riskContentPlaceholder": "توضیح ریسک، اثر و احتمال وقوع...",
  "exp.controlContentPlaceholder": "توضیح کنترل، نوع و دوره اجرا...",
  "exp.connectSteps": "اتصال گام‌ها",
  "exp.endConnect": "پایان اتصال",
  "exp.pickSource": "گام مبدأ را انتخاب کنید.",
  "exp.pickTarget": "حالا گام مقصد را انتخاب کنید.",
  "exp.dragHint": "شکل‌ها را بکشید تا جابه‌جا شوند، یا کلیک کنید تا مستندسازی باز شود.",
  "exp.viewClickHint": "حالت مشاهده: برای دیدن مستندات هر گام روی شکل کلیک کنید.",
  "exp.deleteConnection": "حذف این اتصال",
  "exp.clickToConnect": "برای اتصال کلیک کنید",
  "exp.clickToView": "برای دیدن مستندات کلیک کنید",
  "exp.dragOrClick": "برای جابه‌جایی بکشید، برای باز کردن کلیک کنید",
  "exp.noStepsOnCanvas": "هنوز گامی اضافه نشده است. با دکمه «افزودن گام» شروع کنید.",
  "shape.square": "مربع",
  "shape.rectangle": "مستطیل",
  "shape.circle": "دایره",
  "shape.diamond": "لوزی",
  "shape.oval": "بیضی",
  "media.attachments": "پیوست‌ها (لینک، تصویر، فایل)",
  "media.empty": "پیوستی ثبت نشده است.",
  "media.image": "تصویر",
  "media.file": "فایل",
  "media.link": "لینک",
  "media.titleOptional": "عنوان (اختیاری)",
  "media.linkRequired": "برای نوع لینک، آدرس الزامی است.",
  "media.fileOrUrl": "یک فایل انتخاب کنید یا آدرس وارد کنید.",
  "media.addFail": "افزودن پیوست ناموفق بود.",
  "media.deleteConfirm": "این پیوست حذف شود؟",
  "media.deleteFail": "حذف پیوست ناموفق بود.",
  "editor.bold": "درشت",
  "editor.italic": "کج",
  "editor.underline": "زیرخط",
  "editor.h1": "تیتر ۱",
  "editor.h2": "تیتر ۲",
  "editor.paragraph": "متن",
  "editor.paragraphTitle": "متن ساده",
  "editor.bullet": "• لیست",
  "editor.bulletTitle": "لیست نقطه‌ای",
  "editor.number": "۱. لیست",
  "editor.numberTitle": "لیست عددی",
  "editor.quote": "نقل‌قول",
  "editor.alignRight": "راست‌چین",
  "editor.alignCenter": "وسط",
  "editor.alignCenterTitle": "وسط‌چین",
  "editor.alignLeft": "چپ‌چین",
  "editor.clear": "پاک‌کردن",
  "editor.clearTitle": "حذف قالب‌بندی",
  "editor.font": "قلم",
  "editor.fontSize": "اندازه قلم",
  "editor.fontsFa": "فارسی",
  "editor.fontsEn": "English",
  "editor.sizeSmall": "کوچک",
  "editor.sizeNormal": "عادی",
  "editor.sizeMedium": "متوسط",
  "editor.sizeLarge": "بزرگ",
  "editor.sizeXLarge": "خیلی بزرگ",
  "editor.addLink": "🔗 لینک",
  "editor.addLinkTitle": "افزودن لینک با نام نمایشی",
  "editor.removeLink": "برداشتن لینک",
  "editor.removeLinkTitle": "حذف لینک",
  "editor.hint": "متن را انتخاب کنید، سپس قلم یا اندازه را عوض کنید. برای باز کردن لینک هنگام ویرایش: Ctrl+کلیک.",
  "editor.linkUrl": "آدرس لینک را وارد کنید:",
  "editor.linkLabel": "نام نمایشی لینک (متن کوتاه):",
  "editor.linkDefault": "لینک",
  "editor.placeholder": "متن خود را وارد کنید...",

  "profile.title": "پروفایل من",
  "profile.subtitle": "مشخصات، دعوت‌ها و فعالیت کار در یک جا.",
  "profile.tabInfo": "مشخصات",
  "profile.tabInvites": "دعوت‌ها",
  "profile.tabActivity": "فعالیت",
  "profile.noInvitesTitle": "دعوت بازی ندارید",
  "profile.noInvitesDesc": "دعوت به تیم اینجا دیده می‌شود.",
  "profile.from": "از طرف {name}",
  "profile.reject": "رد",
  "profile.accept": "پذیرش",
  "profile.previous": "قبلی:",
  "profile.noActivityTitle": "هنوز فعالیتی نیست",
  "profile.noActivityDesc": "کار و پروژه اینجا ثبت می‌شود.",
  "profile.photo": "تصویر پروفایل",
  "profile.photoHint": "فرمت‌های JPG یا PNG، حداکثر چند مگابایت",
  "profile.phoneLogin": "شماره موبایل (ورود)",
  "profile.passwordOn": "رمز عبور فعال است",
  "profile.passwordOff": "رمز عبور تنظیم نشده",
  "profile.firstName": "نام",
  "profile.lastName": "نام خانوادگی",
  "profile.company": "نام شرکت / سازمان",
  "profile.companyPlaceholder": "مثال: شرکت دوشه",
  "profile.job": "عنوان شغلی",
  "profile.jobPlaceholder": "مثال: حسابرس داخلی ارشد",
  "profile.birth": "تاریخ تولد",
  "profile.bio": "درباره من",
  "profile.bioPlaceholder": "سابقه کاری و حوزه تخصصی شما",
  "profile.saveChanges": "ذخیره تغییرات",
  "profile.changePassword": "تغییر رمز عبور",
  "profile.setPassword": "تعیین رمز عبور",
  "profile.changePasswordHint": "رمز عبور فعلی را وارد کنید و رمز جدید بسازید.",
  "profile.setPasswordHint": "با ساخت رمز عبور می‌توانید بدون پیامک و فقط با شماره موبایل وارد شوید.",
  "profile.currentPassword": "رمز عبور فعلی",
  "profile.newPassword": "رمز عبور جدید",
  "profile.passwordHint": "حداقل ۸ کاراکتر",
  "profile.confirmPassword": "تکرار رمز عبور جدید",
  "profile.savePassword": "ذخیره رمز عبور",
  "profile.loadFail": "دریافت پروفایل ناموفق بود.",
  "profile.saveOk": "پروفایل با موفقیت ذخیره شد.",
  "profile.saveFail": "ذخیره پروفایل ناموفق بود.",
  "profile.passwordMin": "رمز عبور باید حداقل ۸ کاراکتر باشد.",
  "profile.passwordMismatch": "تکرار رمز عبور با رمز جدید یکسان نیست.",
  "profile.currentRequired": "رمز عبور فعلی را وارد کنید.",
  "profile.passwordChanged": "رمز عبور با موفقیت تغییر کرد.",
  "profile.passwordSet": "رمز عبور ذخیره شد. از این پس می‌توانید با رمز عبور وارد شوید.",
  "profile.passwordFail": "ذخیره رمز عبور ناموفق بود.",
  "profile.inviteFail": "پاسخ به دعوت ناموفق بود.",
  "invite.pending": "در انتظار",
  "invite.accepted": "پذیرفته",
  "invite.rejected": "رد شده",
  "invite.expired": "منقضی",
  "invite.cancelled": "لغو",
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
  "nav.hideTools": "Hide",
  "nav.tools": "Tools",
  "nav.showTools": "Show tools panel",
  "nav.inbox": "Inbox",
  "nav.workHomeShort": "Home",
  "lang.fa": "فارسی",
  "lang.en": "English",

  "common.create": "Create",
  "common.add": "Add",
  "common.close": "Close",
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
  "common.user": "User",
  "common.invite": "Invite",

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
  "exp.deleteFail": "Could not delete.",
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
  "exp.colorThisFolder": "Color of this folder",
  "exp.deleteSubfolder": "Delete subfolder",
  "exp.deleteProcess": "Delete process",
  "exp.editProcess": "Edit process",
  "exp.editSubfolder": "Edit subfolder",
  "exp.subfolderNameRequired": "Subfolder name is required.",
  "exp.processNameRequired": "Process name is required.",
  "exp.createSubfolderFail": "Could not create the subfolder.",
  "exp.createProcessFail": "Could not create the process.",
  "exp.role": "Role",
  "exp.members": "Current members",
  "exp.noMembers": "No members invited yet.",
  "exp.statusSaved": "Folder status saved.",
  "exp.phoneLookupHint": "Type a phone number to see registered users.",
  "exp.searching": "Searching...",
  "exp.deleteSubfolderConfirm": "Subfolder “{name}” and its processes will be deleted. Continue?",
  "exp.deleteProcessConfirm": "Process “{name}” and all of its steps will be deleted. Continue?",
  "exp.deleteSelfConfirm": "“{name}” and all of its subfolders and processes will be deleted. Continue?",
  "exp.colorThisProcess": "Color of this process",
  "exp.processNotFound": "Process not found.",
  "exp.loadProcessFail": "Could not load the process.",
  "exp.colorProcessFail": "Could not change the process color.",
  "exp.stepTitleRequired": "Step title is required.",
  "exp.addStepFail": "Could not add the step.",
  "exp.connectFail": "Could not create the connection.",
  "exp.disconnectFail": "Could not delete the connection.",
  "exp.pdfFail": "Could not download the PDF.",
  "exp.processOwnerLine": "Process owner: {name}",
  "exp.addStep": "Add step",
  "exp.canvasHintEdit": "Drag shapes to move them. Click a shape to open its documentation (explanation, risk, control). To draw an arrow, tap Connect steps, then pick the start step and the end step.",
  "exp.canvasHintView": "View only: click a shape to see that step’s explanation, risks, controls and attachments. Editing and uploads are disabled.",
  "exp.stepList": "Steps",
  "exp.stepTitle": "Step title",
  "exp.stepTitlePlaceholder": "Example: Step 1 — purchase request",
  "exp.shapeOnCanvas": "Shape on the diagram",
  "exp.deleteStep": "Delete step",
  "exp.deleteProcessDeepConfirm": "Process “{name}” and all of its steps, risks and controls will be deleted. Continue?",
  "exp.deleteStepConfirm": "Step “{name}” and its documents and connections will be deleted. Continue?",
  "exp.stepNotFound": "Step not found.",
  "exp.loadStepFail": "Could not load the step.",
  "exp.stepHintEdit": "Document this step in three parts: explanation, risk and control.",
  "exp.stepHintView": "View only: you can read content and attachments, but editing is off.",
  "exp.tabExplanation": "Explanation",
  "exp.tabRisks": "Risks",
  "exp.tabControls": "Controls",
  "exp.explanationPlaceholder": "Write the full explanation of this process step...",
  "exp.explanationSaved": "Explanation saved.",
  "exp.saveExplanationFail": "Could not save the explanation.",
  "exp.saveExplanation": "Save explanation",
  "exp.titleRequired": "Title is required.",
  "exp.createItemFail": "Could not save this item.",
  "exp.newRisk": "New risk",
  "exp.newControl": "New control",
  "exp.itemTitle": "Title",
  "exp.riskTitlePlaceholder": "Example: Purchase without manager approval",
  "exp.controlTitlePlaceholder": "Example: Two-step approval of the purchase request",
  "exp.addRisk": "+ Add risk",
  "exp.addControl": "+ Add control",
  "exp.noRisks": "No risks yet",
  "exp.noControls": "No controls yet",
  "exp.itemsHintEdit": "Record the items identified for this step.",
  "exp.itemsHintView": "Nothing is recorded for this step.",
  "exp.saved": "Saved.",
  "exp.confirmDeleteItem": "Delete this item?",
  "exp.riskContentPlaceholder": "Describe the risk, impact and likelihood...",
  "exp.controlContentPlaceholder": "Describe the control, type and how often it runs...",
  "exp.connectSteps": "Connect steps",
  "exp.endConnect": "Stop connecting",
  "exp.pickSource": "Select the start step.",
  "exp.pickTarget": "Now select the end step.",
  "exp.dragHint": "Drag shapes to move them, or click to open documentation.",
  "exp.viewClickHint": "View only: click a shape to open that step’s documents.",
  "exp.deleteConnection": "Delete this connection",
  "exp.clickToConnect": "Click to connect",
  "exp.clickToView": "Click to view documents",
  "exp.dragOrClick": "Drag to move, click to open",
  "exp.noStepsOnCanvas": "No steps yet. Start with Add step.",
  "shape.square": "Square",
  "shape.rectangle": "Rectangle",
  "shape.circle": "Circle",
  "shape.diamond": "Diamond",
  "shape.oval": "Oval",
  "media.attachments": "Attachments (link, image, file)",
  "media.empty": "No attachments yet.",
  "media.image": "Image",
  "media.file": "File",
  "media.link": "Link",
  "media.titleOptional": "Title (optional)",
  "media.linkRequired": "A URL is required for a link.",
  "media.fileOrUrl": "Choose a file or enter a URL.",
  "media.addFail": "Could not add the attachment.",
  "media.deleteConfirm": "Delete this attachment?",
  "media.deleteFail": "Could not delete the attachment.",
  "editor.bold": "Bold",
  "editor.italic": "Italic",
  "editor.underline": "Underline",
  "editor.h1": "Heading 1",
  "editor.h2": "Heading 2",
  "editor.paragraph": "Text",
  "editor.paragraphTitle": "Normal text",
  "editor.bullet": "• List",
  "editor.bulletTitle": "Bullet list",
  "editor.number": "1. List",
  "editor.numberTitle": "Numbered list",
  "editor.quote": "Quote",
  "editor.alignRight": "Align right",
  "editor.alignCenter": "Center",
  "editor.alignCenterTitle": "Align center",
  "editor.alignLeft": "Align left",
  "editor.clear": "Clear",
  "editor.clearTitle": "Clear formatting",
  "editor.font": "Font",
  "editor.fontSize": "Font size",
  "editor.fontsFa": "Persian",
  "editor.fontsEn": "English",
  "editor.sizeSmall": "Small",
  "editor.sizeNormal": "Normal",
  "editor.sizeMedium": "Medium",
  "editor.sizeLarge": "Large",
  "editor.sizeXLarge": "Extra large",
  "editor.addLink": "🔗 Link",
  "editor.addLinkTitle": "Add a link with a display name",
  "editor.removeLink": "Remove link",
  "editor.removeLinkTitle": "Remove link",
  "editor.hint": "Select text, then change the font or size. To open a link while editing: Ctrl+click.",
  "editor.linkUrl": "Enter the link URL:",
  "editor.linkLabel": "Display name for the link (short text):",
  "editor.linkDefault": "Link",
  "editor.placeholder": "Enter your text...",

  "profile.title": "My profile",
  "profile.subtitle": "Your details, invitations and work activity in one place.",
  "profile.tabInfo": "Details",
  "profile.tabInvites": "Invitations",
  "profile.tabActivity": "Activity",
  "profile.noInvitesTitle": "No open invitations",
  "profile.noInvitesDesc": "Team invitations appear here.",
  "profile.from": "From {name}",
  "profile.reject": "Decline",
  "profile.accept": "Accept",
  "profile.previous": "Previous:",
  "profile.noActivityTitle": "No activity yet",
  "profile.noActivityDesc": "Work and projects will show up here.",
  "profile.photo": "Profile photo",
  "profile.photoHint": "JPG or PNG, a few megabytes max",
  "profile.phoneLogin": "Phone number (sign-in)",
  "profile.passwordOn": "Password is set",
  "profile.passwordOff": "No password set",
  "profile.firstName": "First name",
  "profile.lastName": "Last name",
  "profile.company": "Company / organization",
  "profile.companyPlaceholder": "Example: Dooshe",
  "profile.job": "Job title",
  "profile.jobPlaceholder": "Example: Senior internal auditor",
  "profile.birth": "Date of birth",
  "profile.bio": "About me",
  "profile.bioPlaceholder": "Your experience and specialist area",
  "profile.saveChanges": "Save changes",
  "profile.changePassword": "Change password",
  "profile.setPassword": "Set a password",
  "profile.changePasswordHint": "Enter your current password and choose a new one.",
  "profile.setPasswordHint": "With a password you can sign in with your phone number, without SMS.",
  "profile.currentPassword": "Current password",
  "profile.newPassword": "New password",
  "profile.passwordHint": "At least 8 characters",
  "profile.confirmPassword": "Confirm new password",
  "profile.savePassword": "Save password",
  "profile.loadFail": "Could not load profile.",
  "profile.saveOk": "Profile saved.",
  "profile.saveFail": "Could not save profile.",
  "profile.passwordMin": "Password must be at least 8 characters.",
  "profile.passwordMismatch": "Passwords do not match.",
  "profile.currentRequired": "Enter your current password.",
  "profile.passwordChanged": "Password changed.",
  "profile.passwordSet": "Password saved. You can now sign in with your password.",
  "profile.passwordFail": "Could not save password.",
  "profile.inviteFail": "Could not respond to the invitation.",
  "invite.pending": "Pending",
  "invite.accepted": "Accepted",
  "invite.rejected": "Declined",
  "invite.expired": "Expired",
  "invite.cancelled": "Cancelled",
};

const MESSAGES: Record<Locale, Dict> = { fa: FA, en: EN };

function isLocale(value: string | null | undefined): value is Locale {
  return value === "fa" || value === "en";
}

function persistLocale(next: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

function lookup(locale: Locale, key: string): string | undefined {
  const own = MESSAGES[locale][key];
  if (own !== undefined) return own;
  // Never show Farsi while English is selected.
  return undefined;
}

if (process.env.NODE_ENV !== "production") {
  const missingInEn = Object.keys(FA).filter((key) => EN[key] === undefined);
  if (missingInEn.length > 0) {
    console.warn("[i18n] English is missing keys:", missingInEn);
  }
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

export function LocaleProvider({
  children,
  initialLocale = "fa",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : "fa",
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved) && saved !== locale) {
        setLocaleState(saved);
        applyDocumentLocale(saved);
        persistLocale(saved);
        return;
      }
      persistLocale(locale);
    } catch {
      /* ignore */
    }
    applyDocumentLocale(locale);
    // First paint only: later locale changes are handled by setLocale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
    applyDocumentLocale(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const template = lookup(locale, key);
      if (template === undefined) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[i18n] missing "${key}" for locale "${locale}"`);
        }
        return interpolate(key, vars);
      }
      return interpolate(template, vars);
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

export type CharacterGender = "woman" | "man";
export type AgeBand = "child" | "adult" | "mature";

/** Original Tauditor portraits used as default avatars and home cards. */

export type Character = {
  id: string;
  gender: CharacterGender;
  ageBand: AgeBand;
  src: string;
  nameKey: string;
  adjKeys: [string, string] | [string, string, string];
  blurbKey: string;
  href: string;
};

export const CHARACTERS: Character[] = [
  { id: "neda", gender: "woman", ageBand: "adult", src: "/characters/neda.png", nameKey: "char.neda", adjKeys: ["char.adj.kind", "char.adj.smart"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "sara", gender: "woman", ageBand: "adult", src: "/characters/sara.png", nameKey: "char.sara", adjKeys: ["char.adj.pretty", "char.adj.curious"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
  { id: "maryam", gender: "woman", ageBand: "adult", src: "/characters/maryam.png", nameKey: "char.maryam", adjKeys: ["char.adj.calm", "char.adj.wise"], blurbKey: "dash.person.docsDesc", href: "/explanation" },
  { id: "leila", gender: "woman", ageBand: "adult", src: "/characters/leila.png", nameKey: "char.leila", adjKeys: ["char.adj.warm", "char.adj.brave"], blurbKey: "dash.person.startDesc", href: "/dashboard" },
  { id: "yasmin", gender: "woman", ageBand: "adult", src: "/characters/yasmin.png", nameKey: "char.yasmin", adjKeys: ["char.adj.patient", "char.adj.kind"], blurbKey: "dash.person.teamDesc", href: "/work" },
  { id: "hasti", gender: "woman", ageBand: "adult", src: "/characters/hasti.png", nameKey: "char.hasti", adjKeys: ["char.adj.hopeful", "char.adj.creative"], blurbKey: "dash.person.followDesc", href: "/work" },
  { id: "parisa", gender: "woman", ageBand: "adult", src: "/characters/parisa.png", nameKey: "char.parisa", adjKeys: ["char.adj.pretty", "char.adj.smart"], blurbKey: "dash.person.itemsDesc", href: "/minutes" },
  { id: "roya", gender: "woman", ageBand: "adult", src: "/characters/roya.png", nameKey: "char.roya", adjKeys: ["char.adj.warm", "char.adj.wise"], blurbKey: "dash.person.homeDesc", href: "/dashboard" },
  { id: "elahe", gender: "woman", ageBand: "adult", src: "/characters/elahe.png", nameKey: "char.elahe", adjKeys: ["char.adj.creative", "char.adj.funny"], blurbKey: "dash.person.startDesc", href: "/dashboard" },
  { id: "arash", gender: "man", ageBand: "adult", src: "/characters/arash.png", nameKey: "char.arash", adjKeys: ["char.adj.loyal", "char.adj.calm"], blurbKey: "dash.person.itemsDesc", href: "/minutes" },
  { id: "reza", gender: "man", ageBand: "adult", src: "/characters/reza.png", nameKey: "char.reza", adjKeys: ["char.adj.smart", "char.adj.honest"], blurbKey: "dash.person.homeDesc", href: "/dashboard" },
  { id: "milad", gender: "man", ageBand: "adult", src: "/characters/milad.png", nameKey: "char.milad", adjKeys: ["char.adj.funny", "char.adj.humorous"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "kian", gender: "man", ageBand: "adult", src: "/characters/kian.png", nameKey: "char.kian", adjKeys: ["char.adj.wise", "char.adj.honest"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
  { id: "navid", gender: "man", ageBand: "adult", src: "/characters/navid.png", nameKey: "char.navid", adjKeys: ["char.adj.hopeful", "char.adj.patient"], blurbKey: "dash.person.docsDesc", href: "/explanation" },
  { id: "pouya", gender: "man", ageBand: "adult", src: "/characters/pouya.png", nameKey: "char.pouya", adjKeys: ["char.adj.brave", "char.adj.loyal"], blurbKey: "dash.person.teamDesc", href: "/work" },
  { id: "kasra", gender: "man", ageBand: "adult", src: "/characters/kasra.png", nameKey: "char.kasra", adjKeys: ["char.adj.bold", "char.adj.stylish"], blurbKey: "dash.person.followDesc", href: "/work" },
  { id: "soheil", gender: "man", ageBand: "adult", src: "/characters/soheil.png", nameKey: "char.soheil", adjKeys: ["char.adj.energetic", "char.adj.honest"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "shayan", gender: "man", ageBand: "adult", src: "/characters/shayan.png", nameKey: "char.shayan", adjKeys: ["char.adj.brave", "char.adj.curious"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
  { id: "shahnaz", gender: "woman", ageBand: "mature", src: "/characters/shahnaz.png", nameKey: "char.shahnaz", adjKeys: ["char.adj.wise", "char.adj.calm"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
  { id: "parvin", gender: "woman", ageBand: "mature", src: "/characters/parvin.png", nameKey: "char.parvin", adjKeys: ["char.adj.patient", "char.adj.kind"], blurbKey: "dash.person.docsDesc", href: "/explanation" },
  { id: "fariba", gender: "woman", ageBand: "mature", src: "/characters/fariba.png", nameKey: "char.fariba", adjKeys: ["char.adj.warm", "char.adj.wise"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "sima", gender: "woman", ageBand: "mature", src: "/characters/sima.png", nameKey: "char.sima", adjKeys: ["char.adj.calm", "char.adj.honest"], blurbKey: "dash.person.homeDesc", href: "/dashboard" },
  { id: "mahin", gender: "woman", ageBand: "mature", src: "/characters/mahin.png", nameKey: "char.mahin", adjKeys: ["char.adj.kind", "char.adj.patient"], blurbKey: "dash.person.teamDesc", href: "/work" },
  { id: "soheila", gender: "woman", ageBand: "mature", src: "/characters/soheila.png", nameKey: "char.soheila", adjKeys: ["char.adj.smart", "char.adj.wise"], blurbKey: "dash.person.followDesc", href: "/work" },
  { id: "bahram", gender: "man", ageBand: "mature", src: "/characters/bahram.png", nameKey: "char.bahram", adjKeys: ["char.adj.loyal", "char.adj.wise"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
  { id: "dariush", gender: "man", ageBand: "mature", src: "/characters/dariush.png", nameKey: "char.dariush", adjKeys: ["char.adj.calm", "char.adj.honest"], blurbKey: "dash.person.docsDesc", href: "/explanation" },
  { id: "mansour", gender: "man", ageBand: "mature", src: "/characters/mansour.png", nameKey: "char.mansour", adjKeys: ["char.adj.patient", "char.adj.loyal"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "parviz", gender: "man", ageBand: "mature", src: "/characters/parviz.png", nameKey: "char.parviz", adjKeys: ["char.adj.wise", "char.adj.warm"], blurbKey: "dash.person.homeDesc", href: "/dashboard" },
  { id: "kamran", gender: "man", ageBand: "mature", src: "/characters/kamran.png", nameKey: "char.kamran", adjKeys: ["char.adj.smart", "char.adj.honest"], blurbKey: "dash.person.teamDesc", href: "/work" },
  { id: "farhad", gender: "man", ageBand: "mature", src: "/characters/farhad.png", nameKey: "char.farhad", adjKeys: ["char.adj.calm", "char.adj.loyal"], blurbKey: "dash.person.itemsDesc", href: "/minutes" },
];

/** Home testimonials: original 12 faces (6 women + 6 men). */
export const HOME_CHARACTERS = [
  ...CHARACTERS.filter((row) => row.ageBand === "adult" && row.gender === "woman").slice(0, 6),
  ...CHARACTERS.filter((row) => row.ageBand === "adult" && row.gender === "man").slice(0, 6),
];

const WOMAN_NAMES = new Set(
  [
    "فاطمه", "زهرا", "مریم", "سارا", "نرگس", "نسترن", "لیلا", "لیلی", "نسیم", "نازنین",
    "مهسا", "مهناز", "مهتاب", "الناز", "الهام", "حدیث", "هانیه", "هستی", "هدا", "هدیه",
    "یاسمن", "یلدا", "پریسا", "پرستو", "پگاه", "سمیرا", "سمیه", "سحر", "شیدا", "شیوا",
    "شبنم", "شادی", "رعنا", "رویا", "راضیه", "زینب", "زهره", "غزل", "فریبا", "فرشته",
    "فائزه", "کتایون", "گلناز", "لادن", "لاله", "مائده", "مونا", "مژگان", "ناهید",
    "نسرین", "نوشین", "نیلوفر", "نیکی", "هنگامه", "ویدا", "آیناز", "آیدا", "آتوسا",
    "آتنا", "آرزو", "آناهیتا", "بهار", "بهناز", "ترانه", "تینا", "دنیا", "ساناز",
    "سپیده", "ستاره", "شقایق", "شهرزاد", "غزاله", "کیمیا", "گلاره", "محدثه", "مرضیه",
    "نگین", "نیایش", "هلیا", "ندا", "مینا", "الهه", "عاطفه", "نیوشا",
    "کیانا", "دریا", "نورا", "نور", "ملیکا", "مبینا", "مهدیس", "سوگند",
    "شهناز", "پروین", "سیما", "مهین", "سهیلا", "شیرین", "پوران", "اقدس", "طاهره",
    "آزاده", "آذر", "آزیتا", "افسانه", "افروز", "اکرم", "المیرا", "امینه", "انیس",
    "ایران", "بتول", "بنفشه", "بهجت", "بهاره", "پری", "پریچهر", "پروانه", "پونه",
    "جمیله", "حوا", "خدیجه", "دلارا", "رباب", "ربابه", "رقیه", "زری", "ژاله", "ساجده",
    "ساغر", "سبا", "سوسن", "سودابه", "سولماز", "سیما", "شاپرک", "شعله", "شکوفه",
    "شکوه", "شهلا", "شهین", "صبا", "صدیقه", "طوبی", "عذرا", "عصمت", "فرخنده",
    "فرح", "فرحناز", "فرزانه", "فروغ", "فریال", "فریماه", "فوزیه", "قدسیه",
    "کبری", "کلثوم", "گیتی", "گیلدا", "لعیا", "ماهرخ", "محبوبه", "محترم", "مژده",
    "مستانه", "منصوره", "منیژه", "مهری", "مهوش", "مولود", "وجیهه", "هاجر", "هما",
    "یکتا", "نرگس", "نسترن", "نیلوفر", "ویدا", "طناز", "تارا", "باران", "هلنا",
    "حانیه", "حنانه", "کوثر", "مرجان", "مریم", "مینا", "نیکی", "یگانه", "زینب",
    "fatemeh", "fatimah", "zahra", "maryam", "sara", "sarah", "narges", "nastaran",
    "leila", "leyli", "leyila", "nasim", "nazanin", "mahsa", "mahnaz", "mahtab", "elnaz",
    "elham", "hadis", "hadiseh", "hanieh", "hasti", "hoda", "hodaa", "yasmin", "yasaman",
    "yalda", "parisa", "parastoo", "pegah", "samira", "somayeh", "sahar", "shiva",
    "shadi", "roya", "razieh", "zeynab", "zohreh", "ghazal", "fariba", "faezeh",
    "katayoun", "golnaz", "laleh", "maedeh", "mona", "mozhgan", "nahid", "nasrin",
    "noushin", "niloofar", "niloufar", "niki", "vida", "aynaz", "aida", "atoosa",
    "atena", "arezoo", "anahita", "bahar", "behnaz", "taraneh", "tina", "donya",
    "sanaz", "sepideh", "setareh", "shaghayegh", "shahrzad", "kimia", "marzieh",
    "negin", "helia", "neda", "mina", "elahe", "elaheh", "atefeh", "kiana", "darya",
    "malika", "mobina", "sogand", "nusha", "niusha",
    "shahnaz", "parvin", "sima", "mahin", "soheila", "shirin", "pouran", "tahereh",
    "azadeh", "azar", "azita", "afsaneh", "akram", "almira", "amineh", "iran",
    "batool", "banafsheh", "bahareh", "pari", "parvaneh", "jamileh", "khadijeh",
    "roghayeh", "zhaleh", "susan", "soudabeh", "solmaz", "shohreh", "shohla",
    "shahla", "shahin", "saba", "sedigheh", "farah", "farahnaz", "farzaneh",
    "forough", "mahboubeh", "mojdeh", "mansoureh", "manijeh", "mehri", "mahyar",
    "hajar", "homa", "yeganeh", "kosar", "marjan", "baran", "hananeh",
  ].map(normalizeName),
);

const MAN_NAMES = new Set(
  [
    "علی", "محمد", "حسین", "رضا", "مهدی", "امیر", "امیرحسین", "حسن", "عباس", "محسن",
    "مجید", "مسعود", "مصطفی", "مرتضی", "حمید", "حامد", "هادی", "هومن", "فرهاد", "فرشید",
    "فرزاد", "کاوه", "کوروش", "کیان", "کیانوش", "کامران", "بهرام", "بهزاد", "بهمن",
    "پرویز", "پویا", "پیمان", "جواد", "جلال", "خسرو", "داریوش", "رامین", "رسول",
    "سامان", "سعید", "سیامک", "سیاوش", "شهاب", "صادق", "علیرضا", "عرفان", "فرید",
    "قاسم", "کیوان", "مازیار", "مجتبی", "منصور", "مهرداد", "میلاد", "ناصر", "نیما",
    "وحید", "یاسین", "یوسف", "آرش", "افشین", "امید", "ایلیا", "بابک", "بهروز",
    "پارسا", "پدرام", "توحید", "حسام", "دانیال", "روزبه", "سهراب", "سهیل", "سینا",
    "شایان", "طاها", "کاظم", "محمدحسین", "محمدعلی", "نوید", "یاسر", "یونس",
    "ابراهیم", "احمد", "اسد", "اسماعیل", "اصغر", "اکبر", "البرز", "ایرج", "برزو",
    "تقی", "جعفر", "جهانگیر", "حبیب", "حمیدرضا", "خشایار", "داود", "داوود", "رستم",
    "رحیم", "روح‌الله", "زکریا", "ساسان", "سلمان", "شاهین", "شاهرخ", "شریف",
    "صمد", "طاهر", "عبدالله", "عزیز", "غلامرضا", "فرامرز", "فرخ", "فرهنگ",
    "قدرت", "کریم", "کیخسرو", "لطیف", "محمدرضا", "مسلم", "معین", "موسی", "نادر",
    "نعمت", "هوشنگ", "یحیی", "یدالله", "یعقوب", "آرمان", "آریا", "آریو", "بردیا",
    "پژمان", "تورج", "جمشید", "حکمت", "رئوف", "سیروس", "عادل", "فریدون", "کامبیز",
    "ماکان", "مهدیار", "نوید", "همایون", "هومن", "یاشار",
    "ali", "mohammad", "mohammed", "hossein", "reza", "mahdi", "mehdi", "amir",
    "amirhossein", "hassan", "abbas", "mohsen", "majid", "masoud", "mostafa",
    "morteza", "hamid", "hamed", "hadi", "hooman", "farhad", "farshid", "farzad",
    "kaveh", "kourosh", "kian", "kianoush", "kamran", "bahram", "behzad", "pouya",
    "peyman", "javad", "jalal", "dariush", "ramin", "saman", "saeed", "siavash",
    "shahab", "sadeq", "alireza", "erfan", "farid", "keyvan", "maziar", "mojtaba",
    "mansour", "mehrdad", "milad", "naser", "nima", "vahid", "yasin", "yousef",
    "yusef", "arash", "afshin", "omid", "ilia", "babak", "behrouz", "parsa",
    "pedram", "hesam", "daniel", "soheil", "sina", "shayan", "navid", "yasser",
    "ahmad", "ebrahim", "iman", "kasra", "radin", "arian", "aryan", "ashkan",
    "parviz", "esmail", "akbar", "asghar", "iraj", "taghi", "jafar", "habib",
    "hamidreza", "khashayar", "davood", "rahim", "sasan", "salman", "shahin",
    "shahrokh", "samad", "taher", "gholamreza", "faramarz", "karim",
    "mohammadreza", "moein", "nader", "houshang", "yahya", "arman", "arya",
    "bardia", "pejman", "tooraj", "jamshid", "sirous", "adel", "fereydoun",
    "kambiz", "homayoun", "yashar",
  ].map(normalizeName),
);

export function normalizeName(value: string): string {
  return value
    .trim()
    .split(/\s+/)[0]
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200d]/g, "")
    .toLowerCase();
}

function hashName(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFrom(list: Character[], seed: string): Character {
  return list[hashName(seed) % list.length];
}

export function hasPersonName(name: string | null | undefined): boolean {
  const first = normalizeName(name || "");
  return Boolean(first && !/^\d/.test(first));
}

export function guessGender(name: string): CharacterGender | null {
  if (!hasPersonName(name)) return null;
  const first = normalizeName(name);
  if (WOMAN_NAMES.has(first)) return "woman";
  if (MAN_NAMES.has(first)) return "man";
  return null;
}

export function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const hadBirthday =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

/** 5–14 child, 15–39 adult, 40+ mature. */
export function ageBandFromAge(age: number | null | undefined): AgeBand | null {
  if (age == null || !Number.isFinite(age)) return null;
  if (age < 15) return "child";
  if (age < 40) return "adult";
  return "mature";
}

export function ageBandFromBirthDate(iso: string | null | undefined): AgeBand | null {
  return ageBandFromAge(ageFromBirthDate(iso));
}

/** Child faces reuse the adult set until a dedicated youth gallery exists. */
export function portraitsForBand(band: AgeBand | null): Character[] {
  if (band === "mature") return CHARACTERS.filter((row) => row.ageBand === "mature");
  if (band === "adult" || band === "child") {
    return CHARACTERS.filter((row) => row.ageBand === "adult");
  }
  return CHARACTERS;
}

export function characterFitsBand(character: Character, band: AgeBand | null): boolean {
  if (!band) return true;
  if (band === "mature") return character.ageBand === "mature";
  return character.ageBand === "adult";
}

export function characterById(id: string | null | undefined): Character | null {
  if (!id) return null;
  return CHARACTERS.find((row) => row.id === id) ?? null;
}

/** Profile avatars use the realistic set; home cards keep the original artwork. */
export function profileCharacterSrc(character: Character): string {
  return `/characters/realistic-${character.id}.png`;
}

export function characterForName(name: string, birthDate?: string | null): Character | null {
  if (!hasPersonName(name)) return null;
  const gender = guessGender(name);
  if (!gender) return null;
  const seed = normalizeName(name);
  const pool = portraitsForBand(ageBandFromBirthDate(birthDate ?? null)).filter(
    (row) => row.gender === gender,
  );
  if (!pool.length) return null;
  return pickFrom(pool, seed);
}

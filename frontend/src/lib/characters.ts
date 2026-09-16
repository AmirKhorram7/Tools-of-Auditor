export type CharacterGender = "woman" | "man";

/** Original Tauditor portraits used as default avatars and home cards. */

export type Character = {
  id: string;
  gender: CharacterGender;
  src: string;
  nameKey: string;
  adjKeys: [string, string] | [string, string, string];
  blurbKey: string;
  href: string;
};

export const CHARACTERS: Character[] = [
  { id: "neda", gender: "woman", src: "/characters/neda.png", nameKey: "char.neda", adjKeys: ["char.adj.kind", "char.adj.smart"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "sara", gender: "woman", src: "/characters/sara.png", nameKey: "char.sara", adjKeys: ["char.adj.pretty", "char.adj.curious"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
  { id: "maryam", gender: "woman", src: "/characters/maryam.png", nameKey: "char.maryam", adjKeys: ["char.adj.calm", "char.adj.wise"], blurbKey: "dash.person.docsDesc", href: "/explanation" },
  { id: "leila", gender: "woman", src: "/characters/leila.png", nameKey: "char.leila", adjKeys: ["char.adj.warm", "char.adj.brave"], blurbKey: "dash.person.startDesc", href: "/dashboard" },
  { id: "yasmin", gender: "woman", src: "/characters/yasmin.png", nameKey: "char.yasmin", adjKeys: ["char.adj.patient", "char.adj.kind"], blurbKey: "dash.person.teamDesc", href: "/work" },
  { id: "hasti", gender: "woman", src: "/characters/hasti.png", nameKey: "char.hasti", adjKeys: ["char.adj.hopeful", "char.adj.creative"], blurbKey: "dash.person.followDesc", href: "/work" },
  { id: "parisa", gender: "woman", src: "/characters/parisa.png", nameKey: "char.parisa", adjKeys: ["char.adj.pretty", "char.adj.smart"], blurbKey: "dash.person.itemsDesc", href: "/minutes" },
  { id: "roya", gender: "woman", src: "/characters/roya.png", nameKey: "char.roya", adjKeys: ["char.adj.warm", "char.adj.wise"], blurbKey: "dash.person.homeDesc", href: "/dashboard" },
  { id: "elahe", gender: "woman", src: "/characters/elahe.png", nameKey: "char.elahe", adjKeys: ["char.adj.creative", "char.adj.funny"], blurbKey: "dash.person.startDesc", href: "/dashboard" },
  { id: "arash", gender: "man", src: "/characters/arash.png", nameKey: "char.arash", adjKeys: ["char.adj.loyal", "char.adj.calm"], blurbKey: "dash.person.itemsDesc", href: "/minutes" },
  { id: "reza", gender: "man", src: "/characters/reza.png", nameKey: "char.reza", adjKeys: ["char.adj.smart", "char.adj.honest"], blurbKey: "dash.person.homeDesc", href: "/dashboard" },
  { id: "milad", gender: "man", src: "/characters/milad.png", nameKey: "char.milad", adjKeys: ["char.adj.funny", "char.adj.humorous"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "kian", gender: "man", src: "/characters/kian.png", nameKey: "char.kian", adjKeys: ["char.adj.wise", "char.adj.honest"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
  { id: "navid", gender: "man", src: "/characters/navid.png", nameKey: "char.navid", adjKeys: ["char.adj.hopeful", "char.adj.patient"], blurbKey: "dash.person.docsDesc", href: "/explanation" },
  { id: "pouya", gender: "man", src: "/characters/pouya.png", nameKey: "char.pouya", adjKeys: ["char.adj.brave", "char.adj.loyal"], blurbKey: "dash.person.teamDesc", href: "/work" },
  { id: "kasra", gender: "man", src: "/characters/kasra.png", nameKey: "char.kasra", adjKeys: ["char.adj.bold", "char.adj.stylish"], blurbKey: "dash.person.followDesc", href: "/work" },
  { id: "soheil", gender: "man", src: "/characters/soheil.png", nameKey: "char.soheil", adjKeys: ["char.adj.energetic", "char.adj.honest"], blurbKey: "dash.person.workDesc", href: "/work" },
  { id: "shayan", gender: "man", src: "/characters/shayan.png", nameKey: "char.shayan", adjKeys: ["char.adj.brave", "char.adj.curious"], blurbKey: "dash.person.minutesDesc", href: "/minutes" },
];

/** Home testimonials: original 12 faces (6 women + 6 men). Profile keeps all 18. */
export const HOME_CHARACTERS = [
  ...CHARACTERS.filter((row) => row.gender === "woman").slice(0, 6),
  ...CHARACTERS.filter((row) => row.gender === "man").slice(0, 6),
];

const WOMEN = CHARACTERS.filter((row) => row.gender === "woman");
const MEN = CHARACTERS.filter((row) => row.gender === "man");

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
    "کیانا", "دریا", "ستاره", "نورا", "نور", "ملیکا", "مبینا", "مهدیس", "سوگند",
    "fatemeh", "fatimah", "zahra", "maryam", "sara", "sarah", "narges", "nastaran",
    "leila", "leyli", "nasim", "nazanin", "mahsa", "mahnaz", "mahtab", "elnaz",
    "elham", "hadis", "hadiseh", "hanieh", "hasti", "hoda", "yasmin", "yasaman",
    "yalda", "parisa", "parastoo", "pegah", "samira", "somayeh", "sahar", "shiva",
    "shadi", "roya", "razieh", "zeynab", "zohreh", "ghazal", "fariba", "faezeh",
    "katayoun", "golnaz", "laleh", "maedeh", "mona", "mozhgan", "nahid", "nasrin",
    "noushin", "niloofar", "niloufar", "niki", "vida", "aynaz", "aida", "atoosa",
    "atena", "arezoo", "anahita", "bahar", "behnaz", "taraneh", "tina", "donya",
    "sanaz", "sepideh", "setareh", "shaghayegh", "shahrzad", "kimia", "marzieh",
    "negin", "helia", "neda", "mina", "elahe", "elaheh", "atefeh", "kiana", "darya",
    "malika", "mobina", "sogand", "nusha", "niusha",
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
    "ali", "mohammad", "hossein", "reza", "mahdi", "mehdi", "amir", "amirhossein",
    "hassan", "abbas", "mohsen", "majid", "masoud", "mostafa", "morteza", "hamid",
    "hamed", "hadi", "hooman", "farhad", "farshid", "farzad", "kaveh", "kourosh",
    "kian", "kianoush", "kamran", "bahram", "behzad", "pouya", "peyman", "javad",
    "jalal", "dariush", "ramin", "saman", "saeed", "siavash", "shahab", "sadeq",
    "alireza", "erfan", "farid", "keyvan", "maziar", "mojtaba", "mansour",
    "mehrdad", "milad", "naser", "nima", "vahid", "yasin", "yousef", "arash",
    "afshin", "omid", "ilia", "babak", "behrouz", "parsa", "pedram", "hesam",
    "daniel", "soheil", "sina", "shayan", "navid", "yasser", "ahmad", "ebrahim",
    "iman", "kasra", "radin", "sam", "arian", "aryan", "ashkan",
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

export function guessGender(name: string): CharacterGender | null {
  const first = normalizeName(name);
  if (!first || /^\d/.test(first)) return null;
  if (WOMAN_NAMES.has(first)) return "woman";
  if (MAN_NAMES.has(first)) return "man";
  return null;
}

export function characterById(id: string | null | undefined): Character | null {
  if (!id) return null;
  return CHARACTERS.find((row) => row.id === id) ?? null;
}

export function characterForName(name: string): Character {
  const seed = normalizeName(name) || name.trim() || "user";
  const gender = guessGender(name);
  if (gender === "woman") return pickFrom(WOMEN, seed);
  if (gender === "man") return pickFrom(MEN, seed);
  return pickFrom(CHARACTERS, seed);
}

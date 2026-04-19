import { en, type DictionaryKey, type Dictionary } from "./locales/en";
import { ru } from "./locales/ru";

export type Locale = "en" | "ru";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, Dictionary> = { en, ru };

export function getDict(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

// Для Server Components: читает cookie из next/headers
// Импортируй только в Server Components (файлы без "use client")
export async function getLocale(): Promise<Locale> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const value = jar.get("locale")?.value;
  return (value === "ru" || value === "en") ? value : DEFAULT_LOCALE;
}

// Для Client Components: читает cookie из document
export function getLocaleClient(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  const value = match?.[1];
  return (value === "ru" || value === "en") ? value : DEFAULT_LOCALE;
}

export function t(
  dict: Dictionary,
  key: DictionaryKey,
  params?: Record<string, string | number>,
): string {
  let text: string = dict[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

// Русское склонение: plural(3, "гость", "гостя", "гостей") → "гостя"
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export type { DictionaryKey, Dictionary };

// Browser-side language switching. Pages are built once in English; on load (and on every
// change of the picker) every element tagged data-i18n="key" gets its text swapped, and
// data-i18n-ph swaps a placeholder. Scripts call t('key') for strings they build themselves.
import { STRINGS as SITE, LANGS, type Lang } from './strings';
import { STAFF } from './staff';

const STRINGS = { ...SITE, ...STAFF };

const KEY = 'gp-lang';
export { LANGS };
export type { Lang };

export function currentLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && LANGS.some((l) => l.code === saved)) return saved as Lang;
  } catch {}
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('zh-hk') || nav.startsWith('zh-tw') || nav.startsWith('yue')) return 'yue';
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('pt')) return 'pt';
  const two = nav.slice(0, 2);
  return (LANGS.some((l) => l.code === two) ? two : 'en') as Lang;
}

export function t(key: string, lang: Lang = currentLang()): string {
  const row = STRINGS[key];
  return row ? (row[lang] || row.en) : key;
}

/** t() with {name} slots filled in, for messages scripts build: tf('st.q.added', { id, price }). */
export function tf(key: string, vars: Record<string, string | number>, lang: Lang = currentLang()): string {
  return t(key, lang).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function setLang(lang: Lang) {
  try { localStorage.setItem(KEY, lang); } catch {}
  apply(lang);
}

const HTML_LANG: Record<Lang, string> = { en: 'en', es: 'es-DO', vi: 'vi', lo: 'lo', km: 'km', ko: 'ko', zh: 'zh-Hans', yue: 'zh-Hant-HK', ja: 'ja', th: 'th', pt: 'pt-BR', nl: 'nl', af: 'af', fr: 'fr-CA' };

export function apply(lang: Lang = currentLang(), root: ParentNode = document) {
  document.documentElement.lang = HTML_LANG[lang];
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n!;
    if (STRINGS[key]) el.textContent = t(key, lang);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-ph]').forEach((el) => {
    const key = el.dataset.i18nPh!;
    if (STRINGS[key]) (el as HTMLInputElement).placeholder = t(key, lang);
  });
  const sel = document.getElementById('lang') as HTMLSelectElement | null;
  if (sel && sel.value !== lang) sel.value = lang;
  document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

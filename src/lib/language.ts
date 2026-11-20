export type Language = "en" | "vi";

export function preferredLanguage(preferences: string): Language {
  const ranks = new Map<string, { quality: number; index: number }>();
  for (const [index, item] of preferences.split(",").entries()) {
    const match =
      /^(en|vi|\*)(?:-[a-z0-9-]+)?(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i.exec(
        item.trim(),
      );
    if (!match) continue;
    const lang = match[1]!.toLowerCase();
    const quality = Number(match[2] ?? 1);
    if (!ranks.has(lang) || ranks.get(lang)!.quality < quality) ranks.set(lang, { quality, index });
  }
  const fallback = ranks.get("*") ?? { quality: 0, index: Infinity };
  const en = ranks.get("en") ?? fallback;
  const vi = ranks.get("vi") ?? fallback;
  return vi.quality > 0 &&
    (vi.quality > en.quality || (vi.quality === en.quality && vi.index < en.index))
    ? "vi"
    : "en";
}

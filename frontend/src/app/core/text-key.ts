/**
 * The text used to compare two texts the way a person reads them: it ignores upper/lower case,
 * accents (diacritics), and surrounding and repeated spaces (line breaks count as spaces), so
 * "Jardín", "jardin" and " JARDIN " give the same key.
 * `normalize('NFD')` splits a letter with an accent into the letter and the accent mark, and
 * `\p{M}` matches those marks, so they can be removed.
 *
 * It is the one normalization of the app: categories are compared with it (`categoryKey`) and
 * the search uses it for names and descriptions.
 */
export function textKey(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

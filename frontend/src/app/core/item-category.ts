/**
 * Categories are free text and there is no separate list of them: the categories in use are the
 * ones of the existing items, in every room. This file has the rules to compare and reuse them.
 */
import { textKey } from './text-key';

/** A list of rooms, reduced to what is needed to read the categories of their items. */
type RoomsWithItems = readonly {
  containers: readonly { items: readonly { id?: string; category: string }[] }[];
}[];

/** A category as it is saved: without surrounding spaces, and with runs of spaces made one space. */
export function cleanCategory(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * The text used to compare two categories. It ignores upper/lower case, accents (diacritics)
 * and repeated spaces, so "Jardín", "jardin" and " JARDIN " are the same category.
 * The normalization itself is `textKey`, which the search shares.
 */
export function categoryKey(text: string): string {
  return textKey(text);
}

/**
 * The categories used by the items of all the rooms, without repeats and in alphabetical order.
 * When the same category is written in several ways, the first spelling found is kept.
 * Items without a category are skipped. The item with the id `ignoredItemId` is skipped too: when
 * an item is edited, its new category is compared with the categories of the other items.
 */
export function usedCategories(rooms: RoomsWithItems, ignoredItemId?: string): string[] {
  const byKey = new Map<string, string>();
  for (const room of rooms) {
    for (const container of room.containers) {
      for (const item of container.items) {
        if (ignoredItemId !== undefined && item.id === ignoredItemId) {
          continue;
        }
        const key = categoryKey(item.category);
        if (key !== '' && !byKey.has(key)) {
          byKey.set(key, cleanCategory(item.category));
        }
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/**
 * The category to save for what the user typed: the spelling already in use when the category
 * exists ("navidad" becomes "Navidad"), or the cleaned text when it is new.
 */
export function canonicalCategory(text: string, used: readonly string[]): string {
  const key = categoryKey(text);
  return used.find((category) => categoryKey(category) === key) ?? cleanCategory(text);
}

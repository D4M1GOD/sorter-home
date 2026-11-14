import { cleanCategory } from './item-category';

/**
 * One physical object inside one container. Its container keeps it in its `items` list.
 * Later steps add more fields (units that are out of the container, a photo): the loader gives
 * them a default value, so items saved today keep loading.
 */
export interface Item {
  id: string;
  name: string;
  /** How many units there are: a whole number from 0 to 9999. 0 means "None left". */
  quantity: number;
  /** Free text, it may have several lines. Empty when the item has no description. */
  description: string;
  /** A single category. Empty when the item has no category. */
  category: string;
}

/** What the user fills in to add an item. The id is created by `createItem`. */
export type ItemDraft = Omit<Item, 'id'>;

export const ITEM_NAME_MAX_LENGTH = 60;
export const ITEM_QUANTITY_MIN = 0;
export const ITEM_QUANTITY_MAX = 9999;
export const ITEM_QUANTITY_DEFAULT = 1;
export const ITEM_DESCRIPTION_MAX_LENGTH = 500;
export const ITEM_CATEGORY_MAX_LENGTH = 40;

/** A name is valid when it has 1 to 60 characters after removing surrounding spaces. */
export function isValidItemName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= ITEM_NAME_MAX_LENGTH;
}

/** A quantity is valid when it is a whole number from 0 to 9999. */
export function isValidItemQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity >= ITEM_QUANTITY_MIN &&
    quantity <= ITEM_QUANTITY_MAX
  );
}

/**
 * Reads the quantity the user typed. Only digits are accepted (surrounding spaces are ignored):
 * "1.5", "-1", "1e2" and "abc" give null, and so does a number above the maximum. Nothing is
 * rounded.
 */
export function parseItemQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }
  const quantity = Number(trimmed);
  return isValidItemQuantity(quantity) ? quantity : null;
}

/** A description is valid when it has at most 500 characters after removing surrounding spaces. */
export function isValidItemDescription(description: string): boolean {
  return description.trim().length <= ITEM_DESCRIPTION_MAX_LENGTH;
}

/** A category is valid when it has at most 40 characters once cleaned (see `cleanCategory`). */
export function isValidItemCategory(category: string): boolean {
  return cleanCategory(category).length <= ITEM_CATEGORY_MAX_LENGTH;
}

/** True when every field of the draft is valid. */
export function isValidItemDraft(draft: ItemDraft): boolean {
  return (
    isValidItemName(draft.name) &&
    isValidItemQuantity(draft.quantity) &&
    isValidItemDescription(draft.description) &&
    isValidItemCategory(draft.category)
  );
}

/**
 * Creates an item with a new id. The name and the description are trimmed (line breaks inside
 * the description are kept) and the category is cleaned. Throws if a field is not valid.
 */
export function createItem(draft: ItemDraft): Item {
  if (!isValidItemDraft(draft)) {
    throw new Error('Invalid item');
  }
  return {
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    quantity: draft.quantity,
    description: draft.description.trim(),
    category: cleanCategory(draft.category),
  };
}

/**
 * The items in the order the list shows them: by name, ignoring upper/lower case. Items with the
 * same name keep the order they were added in. Returns a new list: the stored order (the order
 * they were added in) does not change.
 */
export function sortItemsByName(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

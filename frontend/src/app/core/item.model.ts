import { cleanCategory } from './item-category';

/**
 * One physical object inside one container. Its container keeps it in its `items` list.
 * Later steps add more fields (units that are out of the container, a photo): the loader gives
 * them a default value, so items saved today keep loading.
 */
export interface Item {
  id: string;
  name: string;
  /**
   * How many units there are in total, inside the container and out of it: a whole number from
   * 0 to 9999. 0 means "None left".
   */
  quantity: number;
  /**
   * How many of those units are out of the container for a while: a whole number from 0 to
   * `quantity`. The units inside are `quantity - quantityOut` (see `unitsInside`).
   */
  quantityOut: number;
  /** Free text, it may have several lines. Empty when the item has no description. */
  description: string;
  /** A single category. Empty when the item has no category. */
  category: string;
  /**
   * The id of the photo of the item in the photo store (see `PhotoStore`), or null when it has
   * no photo. The photo itself is not kept here: only this reference.
   */
  photoId: string | null;
}

/**
 * What the user fills in to add or edit an item. The id is created by `createItem`. The units
 * that are out are not part of it: they only change with take out, put back and used.
 */
export type ItemDraft = Omit<Item, 'id' | 'quantityOut'>;

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

/** A photo id is valid when it is null (no photo) or a text that is not empty. */
export function isValidPhotoId(photoId: unknown): photoId is string | null {
  return photoId === null || (typeof photoId === 'string' && photoId.length > 0);
}

/** True when every field of the draft is valid. */
export function isValidItemDraft(draft: ItemDraft): boolean {
  return (
    isValidItemName(draft.name) &&
    isValidItemQuantity(draft.quantity) &&
    isValidItemDescription(draft.description) &&
    isValidItemCategory(draft.category) &&
    isValidPhotoId(draft.photoId)
  );
}

/** The units out are valid when they are a whole number from 0 to the total quantity. */
export function isValidQuantityOut(quantityOut: unknown, quantity: number): quantityOut is number {
  return (
    typeof quantityOut === 'number' &&
    Number.isInteger(quantityOut) &&
    quantityOut >= 0 &&
    quantityOut <= quantity
  );
}

/** How many units of the item are inside its container: the total minus the units that are out. */
export function unitsInside(item: Pick<Item, 'quantity' | 'quantityOut'>): number {
  return item.quantity - item.quantityOut;
}

/** True when `units` is a whole number from 1 to `max`: what the user can move in one action. */
export function isValidUnits(units: unknown, max: number): units is number {
  return typeof units === 'number' && Number.isInteger(units) && units >= 1 && units <= max;
}

/**
 * Reads the units the user typed for take out, put back or used. Only digits are accepted
 * (surrounding spaces are ignored) and nothing is rounded. Gives null when the text is not a
 * whole number from 1 to `max`.
 */
export function parseUnits(text: string, max: number): number | null {
  const trimmed = text.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }
  const units = Number(trimmed);
  return isValidUnits(units, max) ? units : null;
}

/**
 * Takes units out of the container: they stay part of the total and are counted as out.
 * Gives null, and changes nothing, when `units` is not a whole number from 1 to the units inside.
 */
export function takeOut(item: Item, units: number): Item | null {
  if (!isValidUnits(units, unitsInside(item))) {
    return null;
  }
  return { ...item, quantityOut: item.quantityOut + units };
}

/**
 * Puts units that are out back in the container. Gives null, and changes nothing, when `units`
 * is not a whole number from 1 to the units that are out.
 */
export function putBack(item: Item, units: number): Item | null {
  if (!isValidUnits(units, item.quantityOut)) {
    return null;
  }
  return { ...item, quantityOut: item.quantityOut - units };
}

/**
 * Marks units that are out as used: they will not return, so the total and the units out go
 * down by the same number. Gives null, and changes nothing, when `units` is not a whole number
 * from 1 to the units that are out.
 */
export function markUsedFromOut(item: Item, units: number): Item | null {
  if (!isValidUnits(units, item.quantityOut)) {
    return null;
  }
  return {
    ...item,
    quantity: item.quantity - units,
    quantityOut: item.quantityOut - units,
  };
}

/**
 * Marks units that are inside the container as used, without taking them out first: the total
 * goes down and the units out do not change. Gives null, and changes nothing, when `units` is
 * not a whole number from 1 to the units inside.
 */
export function markUsedFromInside(item: Item, units: number): Item | null {
  if (!isValidUnits(units, unitsInside(item))) {
    return null;
  }
  return { ...item, quantity: item.quantity - units };
}

/**
 * Creates an item with a new id and no units out. The name and the description are trimmed
 * (line breaks inside the description are kept) and the category is cleaned. Throws if a field
 * is not valid.
 */
export function createItem(draft: ItemDraft): Item {
  if (!isValidItemDraft(draft)) {
    throw new Error('Invalid item');
  }
  return {
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    quantity: draft.quantity,
    quantityOut: 0,
    description: draft.description.trim(),
    category: cleanCategory(draft.category),
    photoId: draft.photoId,
  };
}

/**
 * Compares names the way the list shows them: ignoring upper/lower case and accents, and
 * comparing the numbers inside a name by their value ("natural" order), so `Item 2` comes before
 * `Item 10`. One collator for every comparison: creating it is slower than using it.
 */
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * The items in the order the list shows them: by name, ignoring upper/lower case, with the
 * numbers inside the names compared by value (`Item 2` before `Item 10`, `Nails 2` before
 * `Nails 10`). Items with the same name keep the order they were added in. Returns a new list:
 * the stored order (the order they were added in) does not change.
 */
export function sortItemsByName(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => compareItemNames(a.name, b.name));
}

/**
 * Compares two item names the way the list orders them (see `sortItemsByName`): negative when
 * `a` goes first, positive when `b` does, 0 when they are the same for the order. The search
 * results use it too, so both lists order names in the same way.
 */
export function compareItemNames(a: string, b: string): number {
  return NAME_COLLATOR.compare(a, b);
}

/** The automatic name number `n`: "Item 1", "Item 2"... The one place that knows its shape. */
function defaultItemName(n: number): string {
  return `Item ${n}`;
}

/**
 * True when the name is an automatic name: exactly "Item N", where N is a positive whole number
 * written without leading zeros, ignoring upper/lower case ("item 3" counts; "Item 03", "Item"
 * and "My Item 3" do not). The items that keep such a name are the ones still "to complete".
 */
export function isDefaultItemName(name: string): boolean {
  const n = Number(name.slice(defaultItemName(1).length - 1));
  return (
    Number.isSafeInteger(n) && n >= 1 && name.toLowerCase() === defaultItemName(n).toLowerCase()
  );
}

/**
 * Automatic name for an item created from a photo: "Item N", where N is the lowest positive
 * number that no item in the list uses yet. Names are compared ignoring upper/lower case (so a
 * renamed "item 1" still counts as used), because the list ignores it too. Pass the items of
 * one container: the names of other containers do not count.
 */
export function nextItemName(items: readonly Pick<Item, 'name'>[]): string {
  const used = new Set(items.map((item) => item.name.toLowerCase()));
  let n = 1;
  while (used.has(defaultItemName(n).toLowerCase())) {
    n++;
  }
  return defaultItemName(n);
}

/** The quantity of an item as the lists show it: "Qty 3", or "None left" when it is 0. */
export function itemQuantityText(item: Pick<Item, 'quantity'>): string {
  return item.quantity === 0 ? 'None left' : `Qty ${item.quantity}`;
}

/**
 * The units of an item that are out of its container, as the lists show them: "20 of 100 out",
 * also when all the units are out ("4 of 4 out"). Empty when no unit is out.
 */
export function itemOutText(item: Pick<Item, 'quantity' | 'quantityOut'>): string {
  return item.quantityOut > 0 ? `${item.quantityOut} of ${item.quantity} out` : '';
}

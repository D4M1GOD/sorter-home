import { categoryKey } from './item-category';
import { stackOf } from './container-stack';
import { compareItemNames, isDefaultItemName, Item, itemOutText, itemQuantityText } from './item.model';
import { Room } from './room.model';
import { textKey } from './text-key';

/**
 * The rules of the search of items that do not need the browser: which items match a text and
 * the filters, in which order they are shown, and how a search is written in the address of the
 * page. Everything here is a pure function: the same input always gives the same result.
 */

/** How many results are drawn at first, and how many more "Show more" adds. */
export const SEARCH_PAGE_SIZE = 50;

/** What the user is searching for. Every part that is set must match (they are combined with "and"). */
export interface SearchQuery {
  /** The text as typed. Its words are looked for in the name and in the description. */
  text: string;
  /** Only the items of this category (compared like categories are). Null for any category. */
  category: string | null;
  /** Only the items without a category. When true, `category` is not used. */
  noCategory: boolean;
  /** Only the items of the room with this id. Null for all the rooms. */
  roomId: string | null;
  /** Only the items with units out of their container. */
  out: boolean;
  /** Only the items that keep an automatic name ("Item 3"): the ones still to complete. */
  toComplete: boolean;
}

/** The search with nothing in it: no text and no filter. */
export const EMPTY_QUERY: SearchQuery = {
  text: '',
  category: null,
  noCategory: false,
  roomId: null,
  out: false,
  toComplete: false,
};

/** An item that matches, with where it is. With a backend, the API would return this shape. */
export interface SearchResult {
  item: Item;
  roomId: string;
  roomName: string;
  containerId: string;
  containerName: string;
  /**
   * The level of the container in its stack, counted from 1 at the bottom. Null when the
   * container is alone: then the location does not mention a level.
   */
  level: number | null;
}

/** The words of the text, normalized (see `textKey`). Empty when the text has no words. */
export function searchWords(text: string): string[] {
  const key = textKey(text);
  return key === '' ? [] : key.split(' ');
}

/** True when the search has no text and no filter: then no item is listed. */
export function isEmptyQuery(query: SearchQuery): boolean {
  return (
    searchWords(query.text).length === 0 &&
    query.category === null &&
    !query.noCategory &&
    query.roomId === null &&
    !query.out &&
    !query.toComplete
  );
}

/** True when the two searches ask for the same thing (the text is compared by its words). */
export function sameQuery(a: SearchQuery, b: SearchQuery): boolean {
  return JSON.stringify(paramsOfQuery(a)) === JSON.stringify(paramsOfQuery(b));
}

/**
 * True when every word appears in the name or in the description of the item, in any order and
 * anywhere in the text ("cab" finds "Cable"). The category is not looked at: it has its filter.
 */
export function matchesWords(item: Pick<Item, 'name' | 'description'>, words: readonly string[]): boolean {
  const name = textKey(item.name);
  const description = textKey(item.description);
  return words.every((word) => name.includes(word) || description.includes(word));
}

/** True when the item passes every filter of the search that is set (the text is not checked here). */
export function matchesFilters(item: Item, roomId: string, query: SearchQuery): boolean {
  if (query.roomId !== null && query.roomId !== roomId) {
    return false;
  }
  if (query.noCategory) {
    if (categoryKey(item.category) !== '') {
      return false;
    }
  } else if (query.category !== null && categoryKey(item.category) !== categoryKey(query.category)) {
    // An item without a category never matches a chosen category.
    return false;
  }
  if (query.out && item.quantityOut <= 0) {
    return false;
  }
  return !query.toComplete || isDefaultItemName(item.name);
}

/**
 * The items of all the rooms that match the search, in the order they are shown: first the
 * items that have every word in their name, then the ones that match with the help of their
 * description; inside each group, by name in the order of the item lists (`compareItemNames`).
 * With no text there is one group. An empty search gives no results.
 */
export function searchItems(rooms: readonly Room[], query: SearchQuery): SearchResult[] {
  if (isEmptyQuery(query)) {
    return [];
  }
  const words = searchWords(query.text);
  const found: { result: SearchResult; inName: boolean }[] = [];
  for (const room of rooms) {
    for (const container of room.containers) {
      if (container.items.length === 0) {
        continue;
      }
      const stack = stackOf(room.containers, container.id);
      const level = stack && stack.members.length > 1 ? container.stackPosition + 1 : null;
      for (const item of container.items) {
        if (!matchesFilters(item, room.id, query) || !matchesWords(item, words)) {
          continue;
        }
        const name = textKey(item.name);
        found.push({
          result: {
            item,
            roomId: room.id,
            roomName: room.name,
            containerId: container.id,
            containerName: container.name,
            level,
          },
          inName: words.every((word) => name.includes(word)),
        });
      }
    }
  }
  return found
    .sort(
      (a, b) =>
        Number(b.inName) - Number(a.inName) ||
        compareItemNames(a.result.item.name, b.result.item.name),
    )
    .map((entry) => entry.result);
}

/** The parts of the location of a result: the room, the container and, in a stack, the level. */
function locationParts(result: SearchResult): string[] {
  const parts = [result.roomName, result.containerName];
  if (result.level !== null) {
    parts.push(`Level ${result.level}`);
  }
  return parts;
}

/** The location as it is shown: "Garage → Container 1", or "Garage → Container 1 → Level 2". */
export function locationText(result: SearchResult): string {
  return locationParts(result).join(' → ');
}

/** The location for screen readers, without arrows: "Garage, Container 1, Level 2". */
export function locationLabel(result: SearchResult): string {
  return locationParts(result).join(', ');
}

/**
 * The quantity of a result: "20 of 100 out" when units are out of the container, and otherwise
 * "Qty 3" or "None left".
 */
export function resultQuantityText(item: Item): string {
  return itemOutText(item) || itemQuantityText(item);
}

/** The text of the counter: "No results", "1 result", "12 results". */
export function resultsCountText(count: number): string {
  if (count === 0) {
    return 'No results';
  }
  return count === 1 ? '1 result' : `${count} results`;
}

/**
 * The text of the status line of the search: the counter, or "Showing 50 of 312 results" when
 * only some of the results are drawn.
 */
export function searchStatusText(shown: number, total: number): string {
  return shown < total ? `Showing ${shown} of ${resultsCountText(total)}` : resultsCountText(total);
}

/**
 * The search as the query parameters of the address (/search?q=cable&room=...). Only the parts
 * that are set are written, always in the same order, so two equal searches give the same address.
 */
export function paramsOfQuery(query: SearchQuery): Record<string, string> {
  const params: Record<string, string> = {};
  const text = searchWords(query.text).length > 0 ? query.text.trim().replace(/\s+/g, ' ') : '';
  if (text !== '') {
    params['q'] = text;
  }
  if (query.noCategory) {
    params['nocategory'] = '1';
  } else if (query.category !== null) {
    params['category'] = query.category;
  }
  if (query.roomId !== null) {
    params['room'] = query.roomId;
  }
  if (query.out) {
    params['out'] = '1';
  }
  if (query.toComplete) {
    params['todo'] = '1';
  }
  return params;
}

/**
 * Reads a search from the query parameters of the address. It is tolerant: a room that does not
 * exist or a category that no item uses is ignored (the filter is not set), and so is anything
 * it does not know. A known category takes the spelling that is in use.
 */
export function queryFromParams(
  param: (name: string) => string | null,
  known: { roomIds: readonly string[]; categories: readonly string[] },
): SearchQuery {
  const noCategory = param('nocategory') === '1';
  const wanted = param('category');
  const category =
    noCategory || wanted === null || categoryKey(wanted) === ''
      ? null
      : (known.categories.find((used) => categoryKey(used) === categoryKey(wanted)) ?? null);
  const room = param('room');
  return {
    text: param('q') ?? '',
    category,
    noCategory,
    roomId: room !== null && known.roomIds.includes(room) ? room : null,
    out: param('out') === '1',
    toComplete: param('todo') === '1',
  };
}

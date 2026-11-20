import { inject, Service } from '@angular/core';
import { SearchQuery, SearchResult, searchItems } from './item-search';
import { RoomStore } from './room-store';

/**
 * Searches the items of all the rooms. The search page only uses this service, so that when the
 * backend exists `search` can become a call to the API that returns the same results, without
 * changing how the page shows them (it will then need loading and error states, because a
 * network call is asynchronous).
 *
 * Today it reads the rooms of `RoomStore`, which is a signal: called inside a `computed`, the
 * results follow every change of the rooms by themselves.
 */
@Service()
export class ItemSearch {
  private readonly store = inject(RoomStore);

  search(query: SearchQuery): SearchResult[] {
    return searchItems(this.store.rooms(), query);
  }
}

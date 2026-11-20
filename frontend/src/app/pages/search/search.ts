import { Location } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY_QUERY,
  isEmptyQuery,
  paramsOfQuery,
  queryFromParams,
  SEARCH_PAGE_SIZE,
  SearchQuery,
  SearchResult,
  searchStatusText,
} from '../../core/item-search';
import { ItemSearch } from '../../core/item-search-service';
import { RoomStore } from '../../core/room-store';
import { PhotoViewer } from '../../photo-viewer/photo-viewer';
import { SearchResultRow } from '../../search-result/search-result';

/** How long the user must stop typing before the address and the counter are updated. */
export const SEARCH_PAUSE_MS = 300;

/** The values of the fixed options of the category filter. A category is "cat:" and its name. */
const ANY_CATEGORY = 'any';
const NO_CATEGORY = 'none';
const CATEGORY_PREFIX = 'cat:';

/**
 * The search page: a text and four filters, and the items of all the rooms that match them.
 *
 * The search is kept in two places. The state of this page (`query`) is what the list is made
 * from, so the list changes with every key. The address of the page (/search?q=cable&room=...)
 * is a copy of it, so the back button returns to the same search: it is read when the page opens
 * and written when the search changes. To keep the two from chasing each other, the address is
 * written without a navigation (`Location.replaceState`), so writing it never comes back as a
 * change to read. While the user types, the address and the counter that screen readers
 * announce wait for a short pause; a filter updates them at once.
 */
@Component({
  selector: 'app-search',
  imports: [PhotoViewer, SearchResultRow],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search {
  private readonly store = inject(RoomStore);
  private readonly itemSearch = inject(ItemSearch);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly textField = viewChild.required<ElementRef<HTMLInputElement>>('textField');

  /** The options of the room filter. Two rooms with the same name look the same here. */
  protected readonly rooms = this.store.rooms;
  /** The options of the category filter: the categories in use. */
  protected readonly categories = this.store.categories;

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  /** What is being searched for. The list is made from it at once. */
  protected readonly query = signal<SearchQuery>(EMPTY_QUERY);
  /** How many results are drawn. "Show more" raises it; a new search puts it back. */
  private readonly limit = signal(SEARCH_PAGE_SIZE);

  /** True with no text and no filter: no item is listed then. */
  protected readonly empty = computed(() => isEmptyQuery(this.query()));
  protected readonly results = computed(() => this.itemSearch.search(this.query()));
  protected readonly visible = computed(() => this.results().slice(0, this.limit()));
  protected readonly hasMore = computed(() => this.results().length > this.visible().length);

  /** The counter ("12 results"). It waits for a pause while the user types (see `settle`). */
  protected readonly status = signal('');

  /** The value of the category filter that is selected. */
  protected readonly categoryValue = computed(() => {
    const query = this.query();
    if (query.noCategory) {
      return NO_CATEGORY;
    }
    return query.category === null ? ANY_CATEGORY : CATEGORY_PREFIX + query.category;
  });
  protected readonly anyCategory = ANY_CATEGORY;
  protected readonly noCategory = NO_CATEGORY;
  protected readonly categoryPrefix = CATEGORY_PREFIX;

  /** The result whose photo is shown in the photo window, or null when it is closed. */
  protected readonly viewed = signal<SearchResult | null>(null);

  /** The pause that is running while the user types, or null. */
  private pause: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // The address was opened or changed by a navigation (a link, the back button): take the
    // search from it. Writing the address from here (`writeAddress`) does not come back this way.
    effect(() => {
      const params = this.params();
      untracked(() => {
        this.cancelPause();
        this.query.set(
          queryFromParams((name) => params.get(name), {
            roomIds: this.store.rooms().map((room) => room.id),
            categories: this.store.categories(),
          }),
        );
        this.limit.set(SEARCH_PAGE_SIZE);
      });
    });
    // The results changed for another reason than typing (a filter, "Show more", the rooms
    // themselves): the counter follows at once. While the user types it waits for the pause.
    effect(() => {
      this.results();
      this.limit();
      untracked(() => {
        if (this.pause === null) {
          this.updateStatus();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.cancelPause());
  }

  /** The user typed: the list changes now, the address and the counter after a pause. */
  protected onText(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.query.update((query) => ({ ...query, text }));
    this.limit.set(SEARCH_PAGE_SIZE);
    this.cancelPause();
    this.pause = setTimeout(() => {
      this.pause = null;
      this.settle();
    }, SEARCH_PAUSE_MS);
  }

  /** The user left the text field: do not wait for the rest of the pause. */
  protected onTextBlur(): void {
    if (this.pause !== null) {
      this.cancelPause();
      this.settle();
    }
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setFilters({
      noCategory: value === NO_CATEGORY,
      category: value.startsWith(CATEGORY_PREFIX) ? value.slice(CATEGORY_PREFIX.length) : null,
    });
  }

  protected onRoom(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setFilters({ roomId: value === '' ? null : value });
  }

  protected onOut(event: Event): void {
    this.setFilters({ out: (event.target as HTMLInputElement).checked });
  }

  protected onToComplete(event: Event): void {
    this.setFilters({ toComplete: (event.target as HTMLInputElement).checked });
  }

  /** "Clear": no text and no filter, and the focus goes to the text field. */
  protected clear(): void {
    this.setFilters(EMPTY_QUERY);
    this.textField().nativeElement.focus();
  }

  /** Draws 50 more results and puts the focus on the first of the new ones. */
  protected showMore(): void {
    const firstNew = this.visible().length;
    this.limit.update((limit) => limit + SEARCH_PAGE_SIZE);
    this.updateStatus();
    afterNextRender(
      () => this.host.querySelectorAll<HTMLElement>('.results .result-link')[firstNew]?.focus(),
      { injector: this.injector },
    );
  }

  protected openPhoto(result: SearchResult): void {
    this.viewed.set(result);
  }

  /** Closes the photo window and gives the focus back to the thumbnail that opened it. */
  protected closePhoto(): void {
    const itemId = this.viewed()?.item.id;
    this.viewed.set(null);
    afterNextRender(
      () => {
        const row = Array.from(this.host.querySelectorAll<HTMLElement>('.results > li')).find(
          (li) => li.dataset['itemId'] === itemId,
        );
        row?.querySelector<HTMLElement>('.item-photo')?.focus();
      },
      { injector: this.injector },
    );
  }

  /** A filter changed (or everything was cleared): the address and the counter follow at once. */
  private setFilters(change: Partial<SearchQuery>): void {
    this.query.update((query) => ({ ...query, ...change }));
    this.limit.set(SEARCH_PAGE_SIZE);
    this.cancelPause();
    this.settle();
  }

  /** Brings the counter and the address up to date with the search. */
  private settle(): void {
    this.updateStatus();
    this.writeAddress();
  }

  private updateStatus(): void {
    this.status.set(
      this.empty() ? '' : searchStatusText(this.visible().length, this.results().length),
    );
  }

  /**
   * Writes the search in the address of the page, replacing the current entry of the history
   * (typing does not add entries: "back" leaves the search page). `replaceState` changes the
   * address without a navigation, so it is done at once: a result link pressed right after
   * typing cannot overtake it.
   */
  private writeAddress(): void {
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: paramsOfQuery(this.query()),
    });
    const url = this.router.serializeUrl(tree);
    if (url !== this.location.path()) {
      this.location.replaceState(url, '', this.location.getState());
    }
  }

  private cancelPause(): void {
    if (this.pause !== null) {
      clearTimeout(this.pause);
      this.pause = null;
    }
  }
}

/**
 * jsdom has no `window.matchMedia`. This puts a fake one in its place, for the unit tests of the
 * touch screen check. It is only used by tests: the app never imports this file.
 */
export interface PointerQueryStub {
  /** The media queries that were asked for, in order. */
  queries: string[];
  /** Changes the answer and tells the listeners, as the browser does when the screen changes. */
  setMatches(matches: boolean): void;
  /** How many "change" listeners are attached now. */
  listenerCount(): number;
  /** Puts back what `window.matchMedia` had before. */
  restore(): void;
}

export function stubMatchMedia(initialMatches: boolean): PointerQueryStub {
  const original = window.matchMedia;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;
  const stub: PointerQueryStub = {
    queries: [],
    setMatches(value) {
      matches = value;
      for (const listener of [...listeners]) {
        listener({ matches: value } as MediaQueryListEvent);
      }
    },
    listenerCount: () => listeners.size,
    restore: () => {
      window.matchMedia = original;
    },
  };
  window.matchMedia = ((query: string) => {
    stub.queries.push(query);
    return {
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') {
          listeners.add(listener);
        }
      },
      removeEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') {
          listeners.delete(listener);
        }
      },
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return stub;
}

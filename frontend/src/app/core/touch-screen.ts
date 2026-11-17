import { DestroyRef, inject, Service, signal } from '@angular/core';

/** The media query that tells a touch screen: the main way to point is a finger. */
export const TOUCH_SCREEN_QUERY = '(pointer: coarse)';

/**
 * Tells whether the device is used with a touch screen (a phone or a tablet) and not with a
 * mouse. It reads the media query once when it is created and then follows its changes, so a
 * screen that changes (for example the device mode of the browser tools) is noticed without
 * reloading the page. Without `matchMedia` (a test environment) it says no.
 *
 * It is a service, so the whole app has one listener, and a test can replace it with a fake one.
 */
@Service()
export class TouchScreen {
  private readonly state = signal(false);

  /** True while the main pointer is coarse (a finger). */
  readonly coarse = this.state.asReadonly();

  constructor() {
    if (typeof matchMedia !== 'function') {
      return;
    }
    const query = matchMedia(TOUCH_SCREEN_QUERY);
    this.state.set(query.matches);
    const onChange = (event: MediaQueryListEvent) => this.state.set(event.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }
}

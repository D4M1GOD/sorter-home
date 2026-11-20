import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Container, createContainer, TOUGH_BOX_27_GAL } from '../../core/container.model';
import { createItem, Item, ItemDraft } from '../../core/item.model';
import { PhotoStore } from '../../core/photo-store';
import { FakePhotoStore, ObjectUrls, settle, stubObjectUrls } from '../../core/photo-store.testing';
import { createRoom } from '../../core/room.model';
import { RoomStore } from '../../core/room-store';
import { SEARCH_PAUSE_MS } from './search';

describe('Search', () => {
  let photos: FakePhotoStore;
  let urls: ObjectUrls;

  beforeEach(() => {
    localStorage.clear();
    photos = new FakePhotoStore();
    urls = stubObjectUrls();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: PhotoStore, useValue: photos }],
    });
  });

  afterEach(() => {
    urls.restore();
    document.body.replaceChildren();
  });

  function draft(name: string, values: Partial<ItemDraft> = {}): ItemDraft {
    return { name, quantity: 1, description: '', category: '', photoId: null, ...values };
  }

  /**
   * Two rooms. "Garage" has the container "Toys" with "Cable", "Hammer", "Nails" (20 of its 100
   * units out) and "Item 1". "Attic" has the container "Lights" with "Christmas lights".
   */
  function fill() {
    const store = TestBed.inject(RoomStore);
    const garage = createRoom('Garage');
    const attic = createRoom('Attic');
    store.add(garage);
    store.add(attic);
    const toys = createContainer(TOUGH_BOX_27_GAL.id, 'Toys', 0, 0);
    const lights = createContainer(TOUGH_BOX_27_GAL.id, 'Lights', 0, 0);
    store.addContainer(garage.id, toys);
    store.addContainer(attic.id, lights);
    const add = (roomId: string, container: Container, values: ItemDraft): Item => {
      const item = createItem(values);
      store.addItem(roomId, container.id, item);
      return item;
    };
    const cable = add(garage.id, toys, draft('Cable', { description: 'USB-C, white', category: 'Electronics', quantity: 3 }));
    const hammer = add(garage.id, toys, draft('Hammer', { category: 'Tools' }));
    const nails = add(garage.id, toys, draft('Nails', { quantity: 100, category: 'Hardware' }));
    store.takeOutItem(garage.id, toys.id, nails.id, 20);
    const item1 = add(garage.id, toys, draft('Item 1'));
    const christmas = add(attic.id, lights, draft('Christmas lights', { description: 'with a cable of 5 m', category: 'Navidad', quantity: 4 }));
    return { store, garage, attic, toys, lights, cable, hammer, nails, item1, christmas };
  }

  /** Opens the page through the real router, so the address is read like in the real app. */
  async function open(url = '/search') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    const fixture = harness.fixture;
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const address = () => TestBed.inject(Location).path();

  function textField(element: HTMLElement): HTMLInputElement {
    return element.querySelector('#search-text') as HTMLInputElement;
  }

  /** Types in the text field. The list follows at once; the address and the counter, after a pause. */
  function type(fixture: ComponentFixture<unknown>, element: HTMLElement, text: string): void {
    const field = textField(element);
    field.value = text;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Waits until the pause after typing is over. */
  async function pause(fixture: ComponentFixture<unknown>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS + 40));
    fixture.detectChanges();
  }

  function choose(fixture: ComponentFixture<unknown>, element: HTMLElement, id: string, value: string): void {
    const select = element.querySelector(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function check(fixture: ComponentFixture<unknown>, element: HTMLElement, id: string, checked = true): void {
    const box = element.querySelector(`#${id}`) as HTMLInputElement;
    box.checked = checked;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function names(element: HTMLElement): (string | undefined)[] {
    return Array.from(element.querySelectorAll('.results .result-link')).map((a) => a.textContent?.trim());
  }

  function status(element: HTMLElement): string | undefined {
    return element.querySelector('.search-status')?.textContent?.trim();
  }

  function hint(element: HTMLElement): string | undefined {
    return element.querySelector('.search-hint')?.textContent?.trim();
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  }

  describe('when it opens', () => {
    it('is at /search, loaded like the other pages', async () => {
      fill();
      const { element } = await open();
      expect(element.querySelector('h1')?.textContent?.trim()).toBe('Search items');
      expect(address()).toBe('/search');
    });

    it('has a labelled search field, two labelled lists, two labelled checkboxes and "Clear"', async () => {
      fill();
      const { element } = await open();
      const labels = Array.from(element.querySelectorAll('label')).map((label) => [
        label.textContent?.trim(),
        label.getAttribute('for'),
      ]);
      expect(labels).toEqual([
        ['Search items', 'search-text'],
        ['Category', 'search-category'],
        ['Room', 'search-room'],
        ['Out of the container', 'search-out'],
        ['To complete', 'search-todo'],
      ]);
      for (const [, id] of labels) {
        expect(element.querySelector(`#${id}`)).not.toBeNull();
      }
      expect(textField(element).type).toBe('search');
      expect(element.querySelector('#search-category')?.tagName).toBe('SELECT');
      expect(element.querySelector('#search-room')?.tagName).toBe('SELECT');
      expect((element.querySelector('#search-out') as HTMLInputElement).type).toBe('checkbox');
      expect(button(element, 'Clear')?.type).toBe('button');
      // The search runs while the user types: there is no search button.
      expect(element.querySelector('button[type="submit"]')).toBeNull();
    });

    it('lists no item and says what to do, with an empty status line', async () => {
      fill();
      const { element } = await open();
      expect(hint(element)).toBe('Type to search or choose a filter.');
      expect(element.querySelector('.results')).toBeNull();
      const line = element.querySelector('.search-status') as HTMLElement;
      expect(line.getAttribute('role')).toBe('status');
      expect(status(element)).toBe('');
    });

    it('offers "Any category", "No category" and the categories in use', async () => {
      fill();
      const { element } = await open();
      const options = Array.from(element.querySelectorAll('#search-category option')).map((o) => [
        o.textContent?.trim(),
        o.getAttribute('value'),
      ]);
      expect(options).toEqual([
        ['Any category', 'any'],
        ['No category', 'none'],
        ['Electronics', 'cat:Electronics'],
        ['Hardware', 'cat:Hardware'],
        ['Navidad', 'cat:Navidad'],
        ['Tools', 'cat:Tools'],
      ]);
      expect((element.querySelector('#search-category') as HTMLSelectElement).value).toBe('any');
    });

    it('offers "All rooms" and every room, by its id', async () => {
      const { garage, attic } = fill();
      const { element } = await open();
      const options = Array.from(element.querySelectorAll('#search-room option')).map((o) => [
        o.textContent?.trim(),
        o.getAttribute('value'),
      ]);
      expect(options).toEqual([
        ['All rooms', ''],
        ['Garage', garage.id],
        ['Attic', attic.id],
      ]);
    });
  });

  describe('typing', () => {
    it('lists the items that match at once, name matches first', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'cable');
      expect(names(element)).toEqual(['Cable', 'Christmas lights']);
      expect(element.querySelector('.search-hint')).toBeNull();
    });

    it('ignores accents and capitals, and needs every word', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'CÁBLE');
      expect(names(element)).toEqual(['Cable', 'Christmas lights']);
      type(fixture, element, 'white cable');
      expect(names(element)).toEqual(['Cable']);
      type(fixture, element, 'cable hammer');
      expect(names(element)).toEqual([]);
    });

    it('does not find an item by its category', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'tools');
      expect(names(element)).toEqual([]);
    });

    it('updates the counter and the address only after a pause', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'cab');
      type(fixture, element, 'cable');
      await settle();
      fixture.detectChanges();
      expect(status(element)).toBe('');
      expect(address()).toBe('/search');

      await pause(fixture);
      expect(status(element)).toBe('2 results');
      expect(address()).toBe('/search?q=cable');
    });

    it('does not wait for the pause when the user leaves the field', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'hammer');
      textField(element).dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(status(element)).toBe('1 result');
      expect(address()).toBe('/search?q=hammer');
    });

    it('says "No results" and explains, when nothing matches', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'zzz');
      await pause(fixture);
      expect(status(element)).toBe('No results');
      expect(hint(element)).toBe('No items match. Try other words or change the filters.');
      expect(element.querySelector('.results')).toBeNull();
    });

    it('goes back to the empty state when the text is deleted', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'cable');
      await pause(fixture);
      type(fixture, element, '');
      await pause(fixture);
      expect(hint(element)).toBe('Type to search or choose a filter.');
      expect(status(element)).toBe('');
      expect(address()).toBe('/search');
    });

    it('keeps what the user typed in the field, also its spaces', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'usb ');
      await pause(fixture);
      expect(textField(element).value).toBe('usb ');
      expect(address()).toBe('/search?q=usb');
    });
  });

  describe('filters', () => {
    it('lists the items of a filter alone, and updates the counter and the address at once', async () => {
      const { garage } = fill();
      const { fixture, element } = await open();
      choose(fixture, element, 'search-room', garage.id);
      expect(names(element)).toEqual(['Cable', 'Hammer', 'Item 1', 'Nails']);
      expect(status(element)).toBe('4 results');
      expect(address()).toBe(`/search?room=${garage.id}`);
    });

    it('filters by category, and by "No category"', async () => {
      fill();
      const { fixture, element } = await open();
      choose(fixture, element, 'search-category', 'cat:Tools');
      expect(names(element)).toEqual(['Hammer']);
      expect(address()).toBe('/search?category=Tools');
      choose(fixture, element, 'search-category', 'none');
      expect(names(element)).toEqual(['Item 1']);
      expect(address()).toBe('/search?nocategory=1');
      choose(fixture, element, 'search-category', 'any');
      expect(hint(element)).toBe('Type to search or choose a filter.');
      expect(address()).toBe('/search');
    });

    it('filters the items with units out of the container', async () => {
      fill();
      const { fixture, element } = await open();
      check(fixture, element, 'search-out');
      expect(names(element)).toEqual(['Nails']);
      expect(status(element)).toBe('1 result');
      expect(address()).toBe('/search?out=1');
    });

    it('filters the items still to complete', async () => {
      fill();
      const { fixture, element } = await open();
      check(fixture, element, 'search-todo');
      expect(names(element)).toEqual(['Item 1']);
      expect(address()).toBe('/search?todo=1');
    });

    it('combines the text and every filter', async () => {
      const { garage, attic } = fill();
      const { fixture, element } = await open();
      type(fixture, element, 'cable');
      choose(fixture, element, 'search-room', attic.id);
      expect(names(element)).toEqual(['Christmas lights']);
      // A filter writes the address at once, with the text that was being typed.
      expect(address()).toBe(`/search?q=cable&room=${attic.id}`);
      choose(fixture, element, 'search-room', garage.id);
      check(fixture, element, 'search-out');
      expect(names(element)).toEqual([]);
      expect(status(element)).toBe('No results');
    });
  });

  describe('the address', () => {
    it('restores the text, the filters and the results when the page opens with a search', async () => {
      const { garage } = fill();
      const { element } = await open(`/search?q=nails&room=${garage.id}&category=hardware&out=1`);
      expect(textField(element).value).toBe('nails');
      expect((element.querySelector('#search-room') as HTMLSelectElement).value).toBe(garage.id);
      expect((element.querySelector('#search-category') as HTMLSelectElement).value).toBe('cat:Hardware');
      expect((element.querySelector('#search-out') as HTMLInputElement).checked).toBe(true);
      expect((element.querySelector('#search-todo') as HTMLInputElement).checked).toBe(false);
      expect(names(element)).toEqual(['Nails']);
      expect(status(element)).toBe('1 result');
    });

    it('restores "No category" and "To complete"', async () => {
      fill();
      const { element } = await open('/search?nocategory=1&todo=1');
      expect((element.querySelector('#search-category') as HTMLSelectElement).value).toBe('none');
      expect((element.querySelector('#search-todo') as HTMLInputElement).checked).toBe(true);
      expect(names(element)).toEqual(['Item 1']);
    });

    it('ignores a room and a category that do not exist', async () => {
      fill();
      const { element } = await open('/search?q=cable&room=deleted&category=unknown');
      expect((element.querySelector('#search-room') as HTMLSelectElement).value).toBe('');
      expect((element.querySelector('#search-category') as HTMLSelectElement).value).toBe('any');
      expect(names(element)).toEqual(['Cable', 'Christmas lights']);
    });

    it('does not change the address by just opening it', async () => {
      fill();
      await open('/search?q=cable');
      expect(address()).toBe('/search?q=cable');
    });
  });

  describe('"Clear"', () => {
    it('empties the text and every filter, and puts the focus on the text field', async () => {
      const { garage } = fill();
      const { fixture, element } = await open(`/search?q=nails&room=${garage.id}&out=1&todo=1&nocategory=1`);
      button(element, 'Clear')?.click();
      fixture.detectChanges();
      expect(textField(element).value).toBe('');
      expect((element.querySelector('#search-room') as HTMLSelectElement).value).toBe('');
      expect((element.querySelector('#search-category') as HTMLSelectElement).value).toBe('any');
      expect((element.querySelector('#search-out') as HTMLInputElement).checked).toBe(false);
      expect((element.querySelector('#search-todo') as HTMLInputElement).checked).toBe(false);
      expect(hint(element)).toBe('Type to search or choose a filter.');
      expect(status(element)).toBe('');
      expect(address()).toBe('/search');
      expect(document.activeElement).toBe(textField(element));
    });

    it('is there also when there is nothing to clear', async () => {
      fill();
      const { fixture, element } = await open();
      button(element, 'Clear')?.click();
      fixture.detectChanges();
      expect(button(element, 'Clear')).toBeDefined();
      expect(document.activeElement).toBe(textField(element));
    });

    it('drops a text that was still waiting for the pause', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'cable');
      button(element, 'Clear')?.click();
      await pause(fixture);
      expect(address()).toBe('/search');
      expect(status(element)).toBe('');
    });
  });

  describe('a result', () => {
    it('links to the room page with its container and its item', async () => {
      const { garage, toys, cable } = fill();
      const { fixture, element } = await open();
      type(fixture, element, 'usb');
      const link = element.querySelector('.results .result-link') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(`/rooms/${garage.id}?container=${toys.id}&item=${cable.id}`);
    });

    it('shows the quantity, the category, the description and the location', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'usb');
      const row = element.querySelector('.results li') as HTMLElement;
      expect(row.querySelector('.result-quantity')?.textContent?.trim()).toBe('Qty 3');
      const details = Array.from(row.querySelectorAll('.result-detail')).map((p) => p.textContent?.trim());
      expect(details).toEqual(['Category: Electronics', 'USB-C, white']);
      expect(row.querySelector('.result-location [aria-hidden="true"]')?.textContent?.trim()).toBe(
        'Garage → Toys',
      );
    });

    it('shows "N of M out" for an item with units out', async () => {
      fill();
      const { fixture, element } = await open();
      type(fixture, element, 'nails');
      expect(element.querySelector('.results .result-quantity')?.textContent?.trim()).toBe('20 of 100 out');
    });

    it('shows the level of a container that is in a stack with others', async () => {
      const { store, garage, toys } = fill();
      const onTop = createContainer(TOUGH_BOX_27_GAL.id, 'Top box', 0, 0);
      store.addContainerOnStack(garage.id, onTop, toys.id);
      store.addItem(garage.id, onTop.id, createItem(draft('Rope')));
      const { fixture, element } = await open();
      type(fixture, element, 'rope');
      const location = () =>
        element.querySelector('.results .result-location [aria-hidden="true"]')?.textContent?.trim();
      expect(location()).toBe('Garage → Top box → Level 2');
      type(fixture, element, 'hammer');
      expect(location()).toBe('Garage → Toys → Level 1');
    });

    it('follows the rooms: an item that is removed leaves the results and the counter', async () => {
      const { store, garage, toys, cable } = fill();
      const { fixture, element } = await open('/search?q=cable');
      expect(status(element)).toBe('2 results');
      store.removeItem(garage.id, toys.id, cable.id);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(names(element)).toEqual(['Christmas lights']);
      expect(status(element)).toBe('1 result');
    });
  });

  describe('many results', () => {
    /** Adds `count` items "Thing 1", "Thing 2"... to the container "Toys". */
    function many(count: number) {
      const filled = fill();
      for (let i = 1; i <= count; i++) {
        filled.store.addItem(filled.garage.id, filled.toys.id, createItem(draft(`Thing ${i}`)));
      }
      return filled;
    }

    it('draws all of them when there are 50 or fewer, without "Show more"', async () => {
      many(50);
      const { element } = await open('/search?q=thing');
      expect(names(element).length).toBe(50);
      expect(status(element)).toBe('50 results');
      expect(button(element, 'Show more')).toBeUndefined();
    });

    it('draws the first 50, in order, and says how many there are', async () => {
      many(120);
      const { element } = await open('/search?q=thing');
      const shown = names(element);
      expect(shown.length).toBe(50);
      expect(shown.slice(0, 3)).toEqual(['Thing 1', 'Thing 2', 'Thing 3']);
      expect(shown.at(-1)).toBe('Thing 50');
      expect(status(element)).toBe('Showing 50 of 120 results');
      expect(button(element, 'Show more')?.type).toBe('button');
    });

    it('"Show more" draws 50 more and puts the focus on the first new result', async () => {
      many(120);
      const { fixture, element } = await open('/search?q=thing');
      button(element, 'Show more')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(names(element).length).toBe(100);
      expect(status(element)).toBe('Showing 100 of 120 results');
      expect(document.activeElement?.textContent?.trim()).toBe('Thing 51');

      button(element, 'Show more')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(names(element).length).toBe(120);
      expect(status(element)).toBe('120 results');
      expect(button(element, 'Show more')).toBeUndefined();
      expect(document.activeElement?.textContent?.trim()).toBe('Thing 101');
    });

    it('goes back to 50 when the search changes', async () => {
      many(120);
      const { fixture, element } = await open('/search?q=thing');
      button(element, 'Show more')?.click();
      fixture.detectChanges();
      type(fixture, element, 'thing 1');
      await pause(fixture);
      // A word matches anywhere, so "1" finds every name with a 1 in it: Thing 1, 10 to 19,
      // 21, 31... 91, and 100 to 120. 40 items.
      expect(names(element).length).toBe(40);
      type(fixture, element, 'thing');
      await pause(fixture);
      expect(names(element).length).toBe(50);
      expect(status(element)).toBe('Showing 50 of 120 results');
    });

    it('does not put "Show more" in the address', async () => {
      many(120);
      const { fixture, element } = await open('/search?q=thing');
      button(element, 'Show more')?.click();
      fixture.detectChanges();
      expect(address()).toBe('/search?q=thing');
    });
  });

  describe('photos', () => {
    async function openWithPhoto() {
      const filled = fill();
      photos.add('p-drill');
      const drill = createItem(draft('Drill', { photoId: 'p-drill' }));
      filled.store.addItem(filled.garage.id, filled.toys.id, drill);
      const opened = await open('/search?q=drill');
      await settle();
      opened.fixture.detectChanges();
      return { ...filled, ...opened, drill };
    }

    it('shows the thumbnail of a result that has a photo, and none for the others', async () => {
      const { fixture, element } = await openWithPhoto();
      expect(element.querySelector('.results app-item-photo img')).not.toBeNull();
      type(fixture, element, 'hammer');
      expect(element.querySelector('.results app-item-photo')).toBeNull();
    });

    it('opens the photo window from the thumbnail, without leaving the search', async () => {
      const { fixture, element } = await openWithPhoto();
      expect(element.querySelector('app-photo-viewer')).toBeNull();
      (element.querySelector('.results .item-photo') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      await settle();
      fixture.detectChanges();
      const viewer = element.querySelector('app-photo-viewer') as HTMLElement;
      expect(viewer.querySelector('h2')?.textContent?.trim()).toBe('Drill');
      expect(viewer.querySelector('img')?.getAttribute('alt')).toBe('Photo of Drill');
      expect(address()).toBe('/search?q=drill');
    });

    it('closes the photo window and gives the focus back to the thumbnail', async () => {
      const { fixture, element } = await openWithPhoto();
      (element.querySelector('.results .item-photo') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      element.querySelector('app-photo-viewer dialog')?.dispatchEvent(new Event('close'));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.querySelector('app-photo-viewer')).toBeNull();
      expect(document.activeElement).toBe(element.querySelector('.results .item-photo'));
    });

    it('revokes the address of a thumbnail when its result leaves the list', async () => {
      const { fixture, element } = await openWithPhoto();
      expect(urls.alive().length).toBe(1);
      type(fixture, element, 'hammer');
      expect(urls.alive()).toEqual([]);
    });

    it('does not load the thumbnail again while the result stays in the list', async () => {
      const { fixture, element } = await openWithPhoto();
      type(fixture, element, 'dril');
      type(fixture, element, 'dri');
      await settle();
      fixture.detectChanges();
      expect(urls.created.length).toBe(1);
    });
  });
});

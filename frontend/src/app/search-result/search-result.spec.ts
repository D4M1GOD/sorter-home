import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Item } from '../core/item.model';
import { SearchResult } from '../core/item-search';
import { PhotoStore } from '../core/photo-store';
import { FakePhotoStore, ObjectUrls, settle, stubObjectUrls } from '../core/photo-store.testing';
import { SearchResultRow } from './search-result';

describe('SearchResultRow', () => {
  let photos: FakePhotoStore;
  let urls: ObjectUrls;

  beforeEach(() => {
    photos = new FakePhotoStore();
    photos.add('p-cable');
    urls = stubObjectUrls();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PhotoStore, useValue: photos }],
    });
  });

  afterEach(() => {
    urls.restore();
  });

  function result(item: Partial<Item> = {}, level: number | null = null): SearchResult {
    return {
      item: {
        id: 'item-1',
        name: 'Cable',
        quantity: 3,
        quantityOut: 0,
        description: '',
        category: '',
        photoId: null,
        ...item,
      },
      roomId: 'room-1',
      roomName: 'Garage',
      containerId: 'container-1',
      containerName: 'Container 1',
      level,
    };
  }

  async function setup(shown: SearchResult) {
    const fixture = TestBed.createComponent(SearchResultRow);
    fixture.componentRef.setInput('result', shown);
    const photoOpened = vi.fn();
    fixture.componentInstance.photoOpened.subscribe(photoOpened);
    fixture.detectChanges();
    await fixture.whenStable();
    await settle();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, photoOpened };
  }

  function text(element: HTMLElement, selector: string): string | undefined {
    return element.querySelector(selector)?.textContent?.trim();
  }

  it('shows the name as a link to the room, with the container and the item to open', async () => {
    const { element } = await setup(result());
    const link = element.querySelector('a.result-link') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Cable');
    expect(link.getAttribute('href')).toBe('/rooms/room-1?container=container-1&item=item-1');
    expect(element.querySelectorAll('a').length).toBe(1);
  });

  it('shows the quantity as "Qty N", or "None left" for 0', async () => {
    expect(text((await setup(result({ quantity: 3 }))).element, '.result-quantity')).toBe('Qty 3');
    expect(text((await setup(result({ quantity: 0 }))).element, '.result-quantity')).toBe('None left');
  });

  it('shows "N of M out" when units are out, in a box and not with color alone', async () => {
    const { element } = await setup(result({ quantity: 100, quantityOut: 20 }));
    const quantity = element.querySelector('.result-quantity') as HTMLElement;
    expect(quantity.textContent?.trim()).toBe('20 of 100 out');
    expect(quantity.classList.contains('result-out')).toBe(true);
    expect(element.textContent).not.toContain('Qty 100');
  });

  it('does not draw the box when no unit is out', async () => {
    const { element } = await setup(result());
    expect(element.querySelector('.result-out')).toBeNull();
  });

  it('shows the category and the description when the item has them', async () => {
    const { element } = await setup(result({ category: 'Electronics', description: 'USB-C\n2 m' }));
    const details = Array.from(element.querySelectorAll('.result-detail')).map((p) => p.textContent);
    expect(details.map((detail) => detail?.trim())).toEqual(['Category: Electronics', 'USB-C\n2 m']);
  });

  it('shows neither for an item without category or description', async () => {
    const { element } = await setup(result());
    expect(element.querySelector('.result-detail')).toBeNull();
  });

  it('shows the location as "Room → Container", without a level for a container that is alone', async () => {
    const { element } = await setup(result());
    expect(text(element, '.result-location [aria-hidden="true"]')).toBe('Garage → Container 1');
  });

  it('adds the level when the container is in a stack', async () => {
    const { element } = await setup(result({}, 2));
    expect(text(element, '.result-location [aria-hidden="true"]')).toBe(
      'Garage → Container 1 → Level 2',
    );
  });

  it('gives screen readers the location without arrows', async () => {
    const { element } = await setup(result({}, 2));
    expect(text(element, '.result-location .visually-hidden')).toBe(
      'Location: Garage, Container 1, Level 2',
    );
    // The arrows are hidden from screen readers, so the location is not read twice.
    expect(element.querySelector('.result-location [aria-hidden="true"]')).not.toBeNull();
  });

  describe('photo', () => {
    it('shows no thumbnail for an item without a photo', async () => {
      const { element } = await setup(result());
      expect(element.querySelector('app-item-photo')).toBeNull();
    });

    it('shows the thumbnail of the item, before its text, as a button named with the item', async () => {
      const { element } = await setup(result({ photoId: 'p-cable' }));
      const thumbnail = element.querySelector('app-item-photo button') as HTMLButtonElement;
      expect(thumbnail.getAttribute('aria-label')).toBe('View photo of Cable');
      expect(thumbnail.querySelector('img')?.getAttribute('src')).toBe(urls.created[0]);
      const link = element.querySelector('a.result-link') as Element;
      expect(thumbnail.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // A button inside a link is not valid: the thumbnail is outside the link.
      expect(link.querySelector('button')).toBeNull();
    });

    it('emits "photoOpened" when the thumbnail is pressed', async () => {
      const { element, photoOpened } = await setup(result({ photoId: 'p-cable' }));
      (element.querySelector('app-item-photo button') as HTMLButtonElement).click();
      expect(photoOpened).toHaveBeenCalledTimes(1);
    });

    it('shows no thumbnail when the photo does not exist any more', async () => {
      const { element } = await setup(result({ photoId: 'p-lost' }));
      expect(element.querySelector('app-item-photo')).toBeNull();
      expect(element.querySelector('a.result-link')).not.toBeNull();
    });
  });
});

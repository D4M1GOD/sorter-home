import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PhotoStore } from '../core/photo-store';
import { FakePhotoStore, ObjectUrls, settle, stubObjectUrls } from '../core/photo-store.testing';
import { PhotoViewer } from './photo-viewer';

/**
 * jsdom does not open a `<dialog>` as a real modal: the Escape key, the focus kept inside the
 * window and the dimmed page are the browser's work and are checked by hand. These tests check
 * what the component does: what it shows, that it asks for a modal, and when it emits "closed".
 */
describe('PhotoViewer', () => {
  let photos: FakePhotoStore;
  let urls: ObjectUrls;

  beforeEach(() => {
    photos = new FakePhotoStore();
    photos.add('p-hammer');
    urls = stubObjectUrls();
    TestBed.configureTestingModule({ providers: [{ provide: PhotoStore, useValue: photos }] });
  });

  afterEach(() => {
    urls.restore();
    document.body.replaceChildren();
  });

  /** Creates the viewer, attached to the page, without waiting for its photo to load. */
  async function create(photoId: string) {
    const fixture = TestBed.createComponent(PhotoViewer);
    fixture.componentRef.setInput('photoId', photoId);
    fixture.componentRef.setInput('name', 'Hammer');
    document.body.appendChild(fixture.nativeElement);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, closed };
  }

  async function setup(photoId = 'p-hammer') {
    const result = await create(photoId);
    await settle();
    result.fixture.detectChanges();
    return result;
  }

  function button(element: HTMLElement): HTMLButtonElement {
    return element.querySelector('dialog button') as HTMLButtonElement;
  }

  it('is a dialog named with its title, the name of the item', async () => {
    const { element } = await setup();
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    const title = dialog.querySelector('h2') as HTMLElement;
    expect(title.textContent?.trim()).toBe('Hammer');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('opens when it is created', async () => {
    const { element } = await setup();
    expect((element.querySelector('dialog') as HTMLDialogElement).hasAttribute('open')).toBe(true);
  });

  it('asks the browser for a modal window when the browser has them', async () => {
    const prototype = HTMLDialogElement.prototype as { showModal?: () => void };
    const original = prototype.showModal;
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    prototype.showModal = showModal;
    try {
      await setup();
      expect(showModal).toHaveBeenCalledTimes(1);
    } finally {
      if (original) {
        prototype.showModal = original;
      } else {
        delete prototype.showModal;
      }
    }
  });

  it('puts the keyboard focus on "Close"', async () => {
    const { element } = await setup();
    expect(button(element).textContent?.trim()).toBe('Close');
    expect(button(element).type).toBe('button');
    expect(document.activeElement).toBe(button(element));
  });

  it('says the photo is loading, and then shows the full photo with a text for screen readers', async () => {
    const load = vi.spyOn(photos, 'load');
    const { fixture, element } = await create('p-hammer');
    expect(element.querySelector('.viewer-status')?.textContent?.trim()).toBe('Loading photo…');
    expect(element.querySelector('img')).toBeNull();

    await settle();
    fixture.detectChanges();
    expect(load).toHaveBeenCalledWith('p-hammer', 'full');
    const image = element.querySelector('dialog img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe(urls.created[0]);
    expect(image.getAttribute('alt')).toBe('Photo of Hammer');
    expect(element.querySelector('.viewer-status')).toBeNull();
  });

  it('says so when the photo cannot be loaded, and can still be closed', async () => {
    const { element, closed } = await setup('p-lost');
    const status = element.querySelector('.viewer-status') as HTMLElement;
    expect(status.textContent?.trim()).toBe("Couldn't load the photo.");
    expect(status.getAttribute('role')).toBe('alert');
    expect(element.querySelector('img')).toBeNull();
    button(element).click();
    await settle();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('emits "closed" once with "Close"', async () => {
    const { element, closed } = await setup();
    button(element).click();
    await settle();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('emits "closed" when the browser closes the dialog, as the Escape key does', async () => {
    const { element, closed } = await setup();
    element.querySelector('dialog')?.dispatchEvent(new Event('close'));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('revokes the address of the photo when it is destroyed', async () => {
    const { fixture } = await setup();
    expect(urls.created.length).toBe(1);
    fixture.destroy();
    expect(urls.alive()).toEqual([]);
  });
});

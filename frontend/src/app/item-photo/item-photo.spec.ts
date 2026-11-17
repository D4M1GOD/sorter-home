import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PhotoStore } from '../core/photo-store';
import { FakePhotoStore, ObjectUrls, settle, stubObjectUrls } from '../core/photo-store.testing';
import { ItemPhoto } from './item-photo';

describe('ItemPhoto', () => {
  let photos: FakePhotoStore;
  let urls: ObjectUrls;

  beforeEach(() => {
    photos = new FakePhotoStore();
    photos.add('p-hammer');
    photos.add('p-nails');
    urls = stubObjectUrls();
    TestBed.configureTestingModule({ providers: [{ provide: PhotoStore, useValue: photos }] });
  });

  afterEach(() => {
    urls.restore();
  });

  /** Creates the thumbnail without waiting for its photo to load. */
  function create(photoId: string) {
    const fixture = TestBed.createComponent(ItemPhoto);
    fixture.componentRef.setInput('photoId', photoId);
    fixture.componentRef.setInput('name', 'Hammer');
    const opened = vi.fn();
    const missing = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);
    fixture.componentInstance.missing.subscribe(missing);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, opened, missing };
  }

  async function setup(photoId = 'p-hammer') {
    const result = create(photoId);
    await settle();
    result.fixture.detectChanges();
    return result;
  }

  it('is a button named with the item name, with a tooltip', async () => {
    const { element } = await setup();
    const button = element.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('View photo of Hammer');
    expect(button.getAttribute('title')).toBe('View photo of Hammer');
    expect(button.type).toBe('button');
    expect(element.querySelectorAll('button').length).toBe(1);
  });

  it('draws the button at once, without the image, while the photo loads', () => {
    const { element } = create('p-hammer');
    expect(element.querySelector('button.item-photo')).not.toBeNull();
    expect(element.querySelector('img')).toBeNull();
  });

  it('shows the thumbnail when it is loaded, as decoration for screen readers', async () => {
    const load = vi.spyOn(photos, 'load');
    const { element } = await setup();
    expect(load).toHaveBeenCalledWith('p-hammer', 'thumbnail');
    const image = element.querySelector('button img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe(urls.created[0]);
    // The button already has the name: the image adds nothing for a screen reader.
    expect(image.getAttribute('alt')).toBe('');
  });

  it('emits "opened" when it is pressed', async () => {
    const { element, opened } = await setup();
    element.querySelector('button')?.click();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('emits "missing" with the id, and shows no image, when the photo does not exist', async () => {
    const { element, missing } = await setup('p-lost');
    expect(missing).toHaveBeenCalledTimes(1);
    expect(missing).toHaveBeenCalledWith('p-lost');
    expect(element.querySelector('img')).toBeNull();
    expect(urls.created).toEqual([]);
  });

  it('does not emit "missing" for a photo that exists', async () => {
    const { missing } = await setup();
    expect(missing).not.toHaveBeenCalled();
  });

  describe('object URLs', () => {
    it('creates one address for the photo', async () => {
      await setup();
      expect(urls.created.length).toBe(1);
      expect(urls.revoked).toEqual([]);
    });

    it('revokes the address when the thumbnail is destroyed', async () => {
      const { fixture } = await setup();
      fixture.destroy();
      expect(urls.alive()).toEqual([]);
      expect(urls.revoked).toEqual(urls.created);
    });

    it('revokes the old address and loads the new photo when the photo changes', async () => {
      const { fixture, element } = await setup();
      fixture.componentRef.setInput('photoId', 'p-nails');
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      expect(urls.created.length).toBe(2);
      expect(urls.revoked).toEqual([urls.created[0]]);
      expect(element.querySelector('img')?.getAttribute('src')).toBe(urls.created[1]);
    });

    it('creates no address when it is destroyed before the photo is loaded', async () => {
      const { fixture } = create('p-hammer');
      fixture.destroy();
      await settle();
      expect(urls.created).toEqual([]);
    });
  });
});

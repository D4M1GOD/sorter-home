import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Item } from '../core/item.model';
import { PhotoError, PhotoProcessor } from '../core/photo-processor';
import { PhotoStore, ProcessedPhoto } from '../core/photo-store';
import {
  fakePhoto,
  FakePhotoStore,
  ObjectUrls,
  settle,
  stubObjectUrls,
} from '../core/photo-store.testing';
import { TouchScreen } from '../core/touch-screen';
import { PointerQueryStub, stubMatchMedia } from '../core/touch-screen.testing';
import { ItemForm } from './item-form';

describe('ItemForm', () => {
  async function setup(categories: string[] = []) {
    const fixture = TestBed.createComponent(ItemForm);
    fixture.componentRef.setInput('categories', categories);
    // The form is attached to the page so the keyboard focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const added = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.added.subscribe(added);
    fixture.componentInstance.closed.subscribe(closed);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, added, closed };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  function field(element: HTMLElement, id: string): HTMLInputElement | HTMLTextAreaElement {
    return element.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement;
  }

  function type(element: HTMLElement, id: string, text: string): void {
    const input = field(element, id);
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    );
  }

  async function submitForm(fixture: ComponentFixture<unknown>, element: HTMLElement) {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function errors(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.field-error')).map(
      (e) => e.textContent?.trim() ?? '',
    );
  }

  describe('when it opens', () => {
    it('has the four fields with their labels, empty, and the quantity pre-filled with 1', async () => {
      const { element } = await setup();
      const labels = Array.from(element.querySelectorAll('label')).map((label) => [
        label.textContent?.trim(),
        label.getAttribute('for'),
      ]);
      expect(labels).toEqual([
        ['Name', 'item-name'],
        ['Quantity', 'item-quantity'],
        ['Description (optional)', 'item-description'],
        ['Category (optional)', 'item-category'],
      ]);
      expect(field(element, 'item-name').value).toBe('');
      expect(field(element, 'item-quantity').value).toBe('1');
      expect(field(element, 'item-description').value).toBe('');
      expect(field(element, 'item-category').value).toBe('');
    });

    it('offers "Add" and "Done"', async () => {
      const { element } = await setup();
      const labels = Array.from(element.querySelectorAll('button')).map((b) =>
        b.textContent?.trim(),
      );
      expect(labels).toEqual(['Add photo', 'Add', 'Done']);
      expect(button(element, 'Add')?.type).toBe('submit');
      expect(button(element, 'Done')?.type).toBe('button');
    });

    it('puts the keyboard focus on the name', async () => {
      const { element } = await setup();
      expect(document.activeElement).toBe(field(element, 'item-name'));
    });

    it('shows no errors and an empty status area', async () => {
      const { element } = await setup();
      expect(errors(element)).toEqual([]);
      const status = element.querySelector('.status');
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.textContent?.trim()).toBe('');
    });

    it('uses a text field with a numeric keyboard for the quantity, and a multi-line description', async () => {
      const { element } = await setup();
      expect(field(element, 'item-quantity').getAttribute('type')).toBe('text');
      expect(field(element, 'item-quantity').getAttribute('inputmode')).toBe('numeric');
      expect(field(element, 'item-description').tagName).toBe('TEXTAREA');
    });

    it('limits the length of the name, the description and the category in the browser', async () => {
      const { element } = await setup();
      expect(field(element, 'item-name').getAttribute('maxlength')).toBe('60');
      expect(field(element, 'item-description').getAttribute('maxlength')).toBe('500');
      expect(field(element, 'item-category').getAttribute('maxlength')).toBe('40');
    });
  });

  describe('adding', () => {
    it('emits what the user filled in, with the quantity as a number', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', 'Nails');
      type(element, 'item-quantity', '100');
      type(element, 'item-description', 'Box of 100\n2 in');
      type(element, 'item-category', 'Hardware');
      await submitForm(fixture, element);
      expect(added).toHaveBeenCalledTimes(1);
      expect(added).toHaveBeenCalledWith({
        name: 'Nails',
        quantity: 100,
        description: 'Box of 100\n2 in',
        category: 'Hardware',
        photoId: null,
      });
    });

    it('needs only the name: the quantity stays 1 and the rest is empty', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', '  Nails  ');
      await submitForm(fixture, element);
      expect(added).toHaveBeenCalledWith({
        name: 'Nails',
        quantity: 1,
        description: '',
        category: '',
        photoId: null,
      });
    });

    it('accepts the quantities 0 and 9999', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', 'Nails');
      type(element, 'item-quantity', '0');
      await submitForm(fixture, element);
      type(element, 'item-name', 'Screws');
      type(element, 'item-quantity', '9999');
      await submitForm(fixture, element);
      expect(added.mock.calls.map(([draft]) => draft.quantity)).toEqual([0, 9999]);
    });

    it('stays open and clean after adding, with "Added <name>" and the focus on the name', async () => {
      const { fixture, element, closed } = await setup();
      type(element, 'item-name', 'Nails');
      type(element, 'item-quantity', '100');
      type(element, 'item-description', 'Box of 100');
      type(element, 'item-category', 'Hardware');
      field(element, 'item-category').focus();
      await submitForm(fixture, element);

      expect(closed).not.toHaveBeenCalled();
      expect(field(element, 'item-name').value).toBe('');
      expect(field(element, 'item-quantity').value).toBe('1');
      expect(field(element, 'item-description').value).toBe('');
      expect(field(element, 'item-category').value).toBe('');
      expect(element.querySelector('.status')?.textContent?.trim()).toBe('Added Nails');
      expect(document.activeElement).toBe(field(element, 'item-name'));
      // The clean form does not complain about the empty name.
      expect(errors(element)).toEqual([]);
      expect(field(element, 'item-name').getAttribute('aria-invalid')).not.toBe('true');
    });

    it('adds several items in a row', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', 'Nails');
      await submitForm(fixture, element);
      type(element, 'item-name', 'Screws');
      await submitForm(fixture, element);
      expect(added.mock.calls.map(([draft]) => draft.name)).toEqual(['Nails', 'Screws']);
      expect(element.querySelector('.status')?.textContent?.trim()).toBe('Added Screws');
    });
  });

  describe('errors', () => {
    it('does not add an item without a name and says the name is required', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', '   ');
      await submitForm(fixture, element);
      expect(added).not.toHaveBeenCalled();
      expect(errors(element)).toEqual(['Item name is required.']);
      expect(field(element, 'item-name').getAttribute('aria-invalid')).toBe('true');
      expect(element.querySelector('.status')?.textContent?.trim()).toBe('');
    });

    it('does not add an item with a name that is too long', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', 'a'.repeat(61));
      await submitForm(fixture, element);
      expect(added).not.toHaveBeenCalled();
      expect(errors(element)).toEqual(['Item name must have at most 60 characters.']);
    });

    it('says the quantity is required when it is empty', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', 'Nails');
      type(element, 'item-quantity', '');
      await submitForm(fixture, element);
      expect(added).not.toHaveBeenCalled();
      expect(errors(element)).toEqual(['Quantity is required.']);
      expect(field(element, 'item-quantity').getAttribute('aria-invalid')).toBe('true');
    });

    it('rejects a quantity that is not a whole number from 0 to 9999, without rounding it', async () => {
      const { fixture, element, added } = await setup();
      type(element, 'item-name', 'Nails');
      for (const text of ['1.5', '-1', '10000', 'abc', '1e2']) {
        type(element, 'item-quantity', text);
        await submitForm(fixture, element);
        expect(errors(element)).toEqual(['Quantity must be a whole number from 0 to 9999.']);
      }
      expect(added).not.toHaveBeenCalled();
    });

    it('keeps what was typed when there is an error', async () => {
      const { fixture, element } = await setup();
      type(element, 'item-name', 'Nails');
      type(element, 'item-quantity', '1.5');
      type(element, 'item-description', 'Box');
      await submitForm(fixture, element);
      expect(field(element, 'item-name').value).toBe('Nails');
      expect(field(element, 'item-quantity').value).toBe('1.5');
      expect(field(element, 'item-description').value).toBe('Box');
    });

    it('links each field to its error area for screen readers', async () => {
      const { element } = await setup();
      for (const id of ['item-name', 'item-quantity']) {
        const describedBy = field(element, id).getAttribute('aria-describedby') as string;
        expect(element.querySelector(`#${describedBy}`)?.getAttribute('role')).toBe('alert');
      }
    });
  });

  describe('description counter', () => {
    it('shows how many of the 500 characters are used', async () => {
      const { fixture, element } = await setup();
      const counter = element.querySelector('.counter');
      expect(counter?.textContent?.trim()).toBe('0/500');
      type(element, 'item-description', 'Box of 100');
      fixture.detectChanges();
      expect(counter?.textContent?.trim()).toBe('10/500');
      expect(field(element, 'item-description').getAttribute('aria-describedby')).toBe(counter?.id);
    });
  });

  describe('category suggestions', () => {
    it('offers the categories in use through a datalist linked to the field', async () => {
      const { element } = await setup(['Hardware', 'Navidad']);
      const listId = field(element, 'item-category').getAttribute('list') as string;
      const options = Array.from(element.querySelectorAll(`datalist#${listId} option`)).map((o) =>
        o.getAttribute('value'),
      );
      expect(options).toEqual(['Hardware', 'Navidad']);
    });

    it('has no suggestions when no category is in use, and still accepts free text', async () => {
      const { fixture, element, added } = await setup([]);
      expect(element.querySelectorAll('datalist option').length).toBe(0);
      type(element, 'item-name', 'Nails');
      type(element, 'item-category', 'Brand new');
      await submitForm(fixture, element);
      expect(added.mock.calls[0][0].category).toBe('Brand new');
    });

    it('follows the categories when they change', async () => {
      const { fixture, element } = await setup(['Hardware']);
      fixture.componentRef.setInput('categories', ['Hardware', 'Toys']);
      fixture.detectChanges();
      expect(element.querySelectorAll('datalist option').length).toBe(2);
    });
  });

  describe('closing', () => {
    it('emits "closed" with Done, without adding anything', async () => {
      const { element, added, closed } = await setup();
      type(element, 'item-name', 'Nails');
      button(element, 'Done')?.click();
      expect(closed).toHaveBeenCalledTimes(1);
      expect(added).not.toHaveBeenCalled();
    });

    it('emits "closed" with the Escape key from any field', async () => {
      const { element, added, closed } = await setup();
      field(element, 'item-description').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      expect(closed).toHaveBeenCalledTimes(1);
      expect(added).not.toHaveBeenCalled();
    });
  });

  describe('editing an item', () => {
    const nails: Item = {
      id: 'item-1',
      name: 'Nails',
      quantity: 100,
      quantityOut: 0,
      description: 'Box of 100\n2 in',
      category: 'Hardware',
      photoId: null,
    };

    async function setupEdit(item: Item = nails, categories: string[] = []) {
      const fixture = TestBed.createComponent(ItemForm);
      fixture.componentRef.setInput('categories', categories);
      fixture.componentRef.setInput('item', item);
      document.body.appendChild(fixture.nativeElement);
      fixture.detectChanges();
      await fixture.whenStable();
      const added = vi.fn();
      const saved = vi.fn();
      const closed = vi.fn();
      fixture.componentInstance.added.subscribe(added);
      fixture.componentInstance.saved.subscribe(saved);
      fixture.componentInstance.closed.subscribe(closed);
      const element = fixture.nativeElement as HTMLElement;
      return { fixture, element, added, saved, closed };
    }

    it('has the title "Edit item" and offers "Save" and "Cancel"', async () => {
      const { element } = await setupEdit();
      expect(element.querySelector('h4')?.textContent?.trim()).toBe('Edit item');
      expect(element.querySelector('form')?.getAttribute('aria-labelledby')).toBe(
        element.querySelector('h4')?.id,
      );
      const labels = Array.from(element.querySelectorAll('button')).map((b) =>
        b.textContent?.trim(),
      );
      expect(labels).toEqual(['Add photo', 'Save', 'Cancel']);
      expect(button(element, 'Save')?.type).toBe('submit');
      expect(button(element, 'Cancel')?.type).toBe('button');
    });

    it('keeps the title "Add item" when there is no item to edit', async () => {
      const { element } = await setup();
      expect(element.querySelector('h4')?.textContent?.trim()).toBe('Add item');
    });

    it('starts with the data of the item, and the focus on the name', async () => {
      const { element } = await setupEdit();
      expect(field(element, 'item-name').value).toBe('Nails');
      expect(field(element, 'item-quantity').value).toBe('100');
      expect(field(element, 'item-description').value).toBe('Box of 100\n2 in');
      expect(field(element, 'item-category').value).toBe('Hardware');
      expect(document.activeElement).toBe(field(element, 'item-name'));
      expect(element.querySelector('.counter')?.textContent?.trim()).toBe('15/500');
      expect(errors(element)).toEqual([]);
    });

    it('shows the quantity 0 of an item with none left', async () => {
      const { element } = await setupEdit({ ...nails, quantity: 0 });
      expect(field(element, 'item-quantity').value).toBe('0');
    });

    it('emits "saved" with the new values, the quantity as a number, and does not emit "added"', async () => {
      const { fixture, element, added, saved } = await setupEdit();
      type(element, 'item-name', '  Screws ');
      type(element, 'item-quantity', '85');
      type(element, 'item-description', '');
      type(element, 'item-category', 'Tools');
      await submitForm(fixture, element);
      expect(saved).toHaveBeenCalledTimes(1);
      expect(saved).toHaveBeenCalledWith({
        name: 'Screws',
        quantity: 85,
        description: '',
        category: 'Tools',
        photoId: null,
      });
      expect(added).not.toHaveBeenCalled();
    });

    it('emits "saved" with the same values when nothing was changed', async () => {
      const { fixture, element, saved } = await setupEdit();
      await submitForm(fixture, element);
      expect(saved).toHaveBeenCalledWith({
        name: 'Nails',
        quantity: 100,
        description: 'Box of 100\n2 in',
        category: 'Hardware',
        photoId: null,
      });
    });

    it('does not clean the form or show "Added" after saving: whoever shows the form closes it', async () => {
      const { fixture, element } = await setupEdit();
      type(element, 'item-name', 'Screws');
      await submitForm(fixture, element);
      expect(field(element, 'item-name').value).toBe('Screws');
      expect(element.querySelector('.status')?.textContent?.trim()).toBe('');
    });

    it('has the same rules and errors as adding, and saves nothing while there is an error', async () => {
      const { fixture, element, saved } = await setupEdit();
      type(element, 'item-name', '   ');
      type(element, 'item-quantity', '1.5');
      await submitForm(fixture, element);
      expect(saved).not.toHaveBeenCalled();
      expect(errors(element)).toEqual([
        'Item name is required.',
        'Quantity must be a whole number from 0 to 9999.',
      ]);
      expect(field(element, 'item-name').getAttribute('maxlength')).toBe('60');
      expect(field(element, 'item-description').getAttribute('maxlength')).toBe('500');
      expect(field(element, 'item-category').getAttribute('maxlength')).toBe('40');
    });

    it('offers the categories in use as suggestions', async () => {
      const { element } = await setupEdit(nails, ['Hardware', 'Navidad']);
      const options = Array.from(element.querySelectorAll('datalist option')).map((o) =>
        o.getAttribute('value'),
      );
      expect(options).toEqual(['Hardware', 'Navidad']);
    });

    it('emits "closed" with Cancel and with the Escape key, without saving', async () => {
      const { element, saved, closed } = await setupEdit();
      type(element, 'item-name', 'Screws');
      button(element, 'Cancel')?.click();
      expect(closed).toHaveBeenCalledTimes(1);
      field(element, 'item-quantity').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      expect(closed).toHaveBeenCalledTimes(2);
      expect(saved).not.toHaveBeenCalled();
    });

    describe('with units out of the container', () => {
      const withOut: Item = { ...nails, quantityOut: 20 };

      it('says under the quantity how many units are out, linked to the field', async () => {
        const { element } = await setupEdit(withOut);
        const hint = element.querySelector('#item-quantity-out');
        expect(hint?.textContent?.trim()).toBe('20 are out of the container.');
        expect(field(element, 'item-quantity').getAttribute('aria-describedby')).toBe(
          'item-quantity-out item-quantity-status',
        );
        // The quantity is the total, not the units inside.
        expect(field(element, 'item-quantity').value).toBe('100');
      });

      it('has no such text when no unit is out, or when adding', async () => {
        const edit = await setupEdit();
        expect(edit.element.querySelector('#item-quantity-out')).toBeNull();
        expect(field(edit.element, 'item-quantity').getAttribute('aria-describedby')).toBe(
          'item-quantity-status',
        );
        document.body.replaceChildren();
        const add = await setup();
        expect(add.element.querySelector('#item-quantity-out')).toBeNull();
      });

      it('blocks a quantity lower than the units out, with its own error, and saves nothing', async () => {
        const { fixture, element, saved } = await setupEdit(withOut);
        for (const quantity of ['19', '0']) {
          type(element, 'item-quantity', quantity);
          await submitForm(fixture, element);
          expect(errors(element)).toEqual([
            "Quantity can't be lower than the units that are out (20).",
          ]);
        }
        expect(saved).not.toHaveBeenCalled();
        expect(field(element, 'item-quantity').getAttribute('aria-invalid')).toBe('true');
      });

      it('accepts a quantity equal to or above the units out', async () => {
        const { fixture, element, saved } = await setupEdit(withOut);
        type(element, 'item-quantity', '20');
        await submitForm(fixture, element);
        expect(errors(element)).toEqual([]);
        expect(saved).toHaveBeenCalledTimes(1);
        expect(saved.mock.calls[0][0].quantity).toBe(20);
      });

      it('shows only the usual error for a quantity that is not a whole number', async () => {
        const { fixture, element } = await setupEdit(withOut);
        type(element, 'item-quantity', '1.5');
        await submitForm(fixture, element);
        expect(errors(element)).toEqual(['Quantity must be a whole number from 0 to 9999.']);
      });

      it('does not put the units out in what it emits', async () => {
        const { fixture, element, saved } = await setupEdit(withOut);
        await submitForm(fixture, element);
        expect(saved.mock.calls[0][0]).not.toHaveProperty('quantityOut');
      });

      it('lets a new item have the quantity 0', async () => {
        const { fixture, element, added } = await setup();
        type(element, 'item-name', 'Nails');
        type(element, 'item-quantity', '0');
        await submitForm(fixture, element);
        expect(added).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('photo', () => {
    const hammer: Item = {
      id: 'item-1',
      name: 'Hammer',
      quantity: 1,
      quantityOut: 0,
      description: '',
      category: '',
      photoId: null,
    };

    let photos: FakePhotoStore;
    let urls: ObjectUrls;
    /** What the fake processor does with the chosen file. By default it gives a photo. */
    let process: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      photos = new FakePhotoStore();
      urls = stubObjectUrls();
      process = vi.fn(async () => fakePhoto('chosen'));
      TestBed.configureTestingModule({
        providers: [
          { provide: PhotoStore, useValue: photos },
          { provide: PhotoProcessor, useValue: { process } },
        ],
      });
    });

    afterEach(() => {
      urls.restore();
    });

    async function setupPhoto(options: { item?: Item; focusOn?: 'name' | 'photo' } = {}) {
      const fixture = TestBed.createComponent(ItemForm);
      if (options.item) {
        fixture.componentRef.setInput('item', options.item);
      }
      if (options.focusOn) {
        fixture.componentRef.setInput('focusOn', options.focusOn);
      }
      document.body.appendChild(fixture.nativeElement);
      fixture.detectChanges();
      await fixture.whenStable();
      await settle();
      fixture.detectChanges();
      const added = vi.fn();
      const saved = vi.fn();
      fixture.componentInstance.added.subscribe(added);
      fixture.componentInstance.saved.subscribe(saved);
      const element = fixture.nativeElement as HTMLElement;
      return { fixture, element, added, saved };
    }

    function fileInput(element: HTMLElement): HTMLInputElement {
      return element.querySelector('input[type="file"]') as HTMLInputElement;
    }

    const picture = new File(['pixels'], 'hammer.jpg', { type: 'image/jpeg' });

    /** What the browser does after the user picks a file: it fills the field and fires "change". */
    async function choose(
      fixture: ComponentFixture<unknown>,
      element: HTMLElement,
      file = picture,
      input = fileInput(element),
    ) {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    async function submitAndSettle(fixture: ComponentFixture<unknown>, element: HTMLElement) {
      element.querySelector('form')?.dispatchEvent(new Event('submit'));
      await settle();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    function photoButtons(element: HTMLElement): (string | undefined)[] {
      return Array.from(element.querySelectorAll('[role="group"] button')).map((b) =>
        b.textContent?.trim(),
      );
    }

    function photoErrors(element: HTMLElement): string[] {
      return Array.from(element.querySelectorAll('#item-photo-status .field-error')).map(
        (e) => e.textContent?.trim() ?? '',
      );
    }

    describe('the field', () => {
      it('is a group named "Photo (optional)", after the category and before the buttons', async () => {
        const { element } = await setupPhoto();
        const group = element.querySelector('[role="group"]') as HTMLElement;
        const label = element.querySelector(`#${group.getAttribute('aria-labelledby')}`);
        expect(label?.textContent?.trim()).toBe('Photo (optional)');
        const parts = [field(element, 'item-category'), group, button(element, 'Add')] as Element[];
        for (let i = 0; i < parts.length - 1; i++) {
          expect(
            parts[i].compareDocumentPosition(parts[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
          ).toBeTruthy();
        }
      });

      it('has one hidden file field that accepts images, without "capture"', async () => {
        const { element } = await setupPhoto();
        const input = fileInput(element);
        expect(element.querySelectorAll('input[type="file"]').length).toBe(1);
        expect(input.getAttribute('accept')).toBe('image/*');
        expect(input.hasAttribute('capture')).toBe(false);
        expect(input.hasAttribute('multiple')).toBe(false);
        // Out of the way of the keyboard and of screen readers: the buttons stand for it.
        expect(input.hidden).toBe(true);
        expect(input.getAttribute('tabindex')).toBe('-1');
      });

      it('offers "Add photo" when there is no photo, and it opens the file field', async () => {
        const { element } = await setupPhoto();
        expect(photoButtons(element)).toEqual(['Add photo']);
        expect(element.querySelector('.photo-preview')).toBeNull();
        const click = vi.spyOn(fileInput(element), 'click').mockImplementation(() => undefined);
        (element.querySelector('.photo-add') as HTMLButtonElement).click();
        expect(click).toHaveBeenCalledTimes(1);
        expect((element.querySelector('.photo-add') as HTMLButtonElement).type).toBe('button');
      });

      it('has empty areas for the status and the error', async () => {
        const { element } = await setupPhoto();
        const status = element.querySelector('.photo-status') as HTMLElement;
        expect(status.getAttribute('role')).toBe('status');
        expect(status.textContent?.trim()).toBe('');
        expect(element.querySelector('#item-photo-status')?.getAttribute('role')).toBe('alert');
        expect(photoErrors(element)).toEqual([]);
      });
    });

    describe('choosing a photo', () => {
      it('prepares the chosen file and shows its preview, with "Replace" and "Remove"', async () => {
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        expect(process).toHaveBeenCalledTimes(1);
        expect(process).toHaveBeenCalledWith(picture);
        const image = element.querySelector('.photo-preview img') as HTMLImageElement;
        expect(image.getAttribute('src')).toBe(urls.created[0]);
        expect(image.getAttribute('alt')).toBe('Photo preview');
        expect(photoButtons(element)).toEqual(['Replace', 'Remove']);
        expect(element.querySelector('.photo-replace')?.getAttribute('aria-label')).toBe(
          'Replace photo',
        );
        expect(element.querySelector('.photo-remove')?.getAttribute('aria-label')).toBe(
          'Remove photo',
        );
      });

      it('saves nothing and emits nothing until "Add"', async () => {
        const { fixture, element, added } = await setupPhoto();
        await choose(fixture, element);
        expect(photos.saved.size).toBe(0);
        expect(added).not.toHaveBeenCalled();
      });

      it('puts the focus on "Replace", because "Add photo" is gone', async () => {
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        expect(document.activeElement).toBe(element.querySelector('.photo-replace'));
      });

      it('empties the file field, so the same file can be chosen again', async () => {
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        expect(fileInput(element).value).toBe('');
      });

      it('does nothing when the user closes the file picker without choosing', async () => {
        const { fixture, element } = await setupPhoto();
        fileInput(element).dispatchEvent(new Event('change'));
        await settle();
        fixture.detectChanges();
        expect(process).not.toHaveBeenCalled();
        expect(photoButtons(element)).toEqual(['Add photo']);
      });

      it('says "Preparing photo…" while the file is prepared, and "Add" waits', async () => {
        let finish: (photo: ProcessedPhoto) => void = () => undefined;
        process.mockImplementation(() => new Promise<ProcessedPhoto>((resolve) => (finish = resolve)));
        const { fixture, element, added } = await setupPhoto();
        type(element, 'item-name', 'Hammer');
        await choose(fixture, element);
        expect(element.querySelector('.photo-status')?.textContent?.trim()).toBe('Preparing photo…');

        await submitAndSettle(fixture, element);
        expect(added).not.toHaveBeenCalled();
        expect(field(element, 'item-name').value).toBe('Hammer');

        finish(fakePhoto('chosen'));
        await settle();
        fixture.detectChanges();
        expect(element.querySelector('.photo-status')?.textContent?.trim()).toBe('');
        await submitAndSettle(fixture, element);
        expect(added).toHaveBeenCalledTimes(1);
      });

      it('"Replace" opens the file field, and the new photo takes the place of the other', async () => {
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        const click = vi.spyOn(fileInput(element), 'click').mockImplementation(() => undefined);
        (element.querySelector('.photo-replace') as HTMLButtonElement).click();
        expect(click).toHaveBeenCalledTimes(1);

        process.mockResolvedValue(fakePhoto('second'));
        await choose(fixture, element);
        expect(urls.created.length).toBe(2);
        expect(urls.revoked).toEqual([urls.created[0]]);
        expect(element.querySelector('.photo-preview img')?.getAttribute('src')).toBe(
          urls.created[1],
        );
      });

      it('"Remove" takes the photo out, revokes its address and puts the focus on "Add photo"', async () => {
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        (element.querySelector('.photo-remove') as HTMLButtonElement).click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(photoButtons(element)).toEqual(['Add photo']);
        expect(element.querySelector('.photo-preview')).toBeNull();
        expect(urls.alive()).toEqual([]);
        expect(document.activeElement).toBe(element.querySelector('.photo-add'));
      });
    });

    describe('a file with a problem', () => {
      const messages = [
        'This file is not an image.',
        'This photo is too large. The maximum is 30 MB.',
        "Couldn't read this image. Try a JPEG or PNG photo.",
      ];

      it('shows the error of the file, and leaves the form without a photo', async () => {
        for (const message of messages) {
          process.mockRejectedValueOnce(new PhotoError(message));
          const { fixture, element } = await setupPhoto();
          await choose(fixture, element);
          expect(photoErrors(element)).toEqual([message]);
          expect(photoButtons(element)).toEqual(['Add photo']);
          expect(element.querySelector('.photo-status')?.textContent?.trim()).toBe('');
          document.body.replaceChildren();
        }
      });

      it('says the image could not be read for any other failure', async () => {
        process.mockRejectedValueOnce(new Error('out of memory'));
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        expect(photoErrors(element)).toEqual(["Couldn't read this image. Try a JPEG or PNG photo."]);
      });

      it('keeps the photo that was already chosen', async () => {
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        process.mockRejectedValueOnce(new PhotoError(messages[0]));
        await choose(fixture, element);
        expect(photoErrors(element)).toEqual([messages[0]]);
        expect(element.querySelector('.photo-preview img')?.getAttribute('src')).toBe(
          urls.created[0],
        );
      });

      it('clears the error when a good file is chosen, or the photo is removed', async () => {
        process.mockRejectedValueOnce(new PhotoError(messages[0]));
        const { fixture, element } = await setupPhoto();
        await choose(fixture, element);
        await choose(fixture, element);
        expect(photoErrors(element)).toEqual([]);

        process.mockRejectedValueOnce(new PhotoError(messages[1]));
        await choose(fixture, element);
        expect(photoErrors(element)).toEqual([messages[1]]);
        (element.querySelector('.photo-remove') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(photoErrors(element)).toEqual([]);
      });

      it('still adds the item, without a photo', async () => {
        process.mockRejectedValueOnce(new PhotoError(messages[0]));
        const { fixture, element, added } = await setupPhoto();
        type(element, 'item-name', 'Hammer');
        await choose(fixture, element);
        await submitAndSettle(fixture, element);
        expect(added).toHaveBeenCalledTimes(1);
        expect(added.mock.calls[0][0].photoId).toBeNull();
      });
    });

    describe('adding an item', () => {
      it('emits no photo, and saves none, for an item without a photo', async () => {
        const { fixture, element, added } = await setupPhoto();
        type(element, 'item-name', 'Hammer');
        await submitAndSettle(fixture, element);
        expect(added.mock.calls[0][0].photoId).toBeNull();
        expect(photos.saved.size).toBe(0);
      });

      it('saves the photo first, and then emits the item with the id of the photo', async () => {
        const { fixture, element, added } = await setupPhoto();
        const save = vi.spyOn(photos, 'save');
        added.mockImplementation(() => {
          // The photo is already saved when the item is emitted.
          expect(photos.saved.has('photo-1')).toBe(true);
        });
        type(element, 'item-name', 'Hammer');
        await choose(fixture, element);
        await submitAndSettle(fixture, element);
        expect(save).toHaveBeenCalledTimes(1);
        expect(added).toHaveBeenCalledTimes(1);
        expect(added).toHaveBeenCalledWith({
          name: 'Hammer',
          quantity: 1,
          description: '',
          category: '',
          photoId: 'photo-1',
        });
        expect(await photos.saved.get('photo-1')?.thumbnail.text()).toBe('chosen-thumbnail');
        expect(await photos.saved.get('photo-1')?.full.text()).toBe('chosen-full');
      });

      it('goes back to a clean form, without the photo, and revokes its address', async () => {
        const { fixture, element } = await setupPhoto();
        type(element, 'item-name', 'Hammer');
        await choose(fixture, element);
        await submitAndSettle(fixture, element);
        expect(element.querySelector('.status')?.textContent?.trim()).toBe('Added Hammer');
        expect(photoButtons(element)).toEqual(['Add photo']);
        expect(urls.alive()).toEqual([]);
        expect(document.activeElement).toBe(field(element, 'item-name'));

        // The next item does not get the photo of the one before.
        type(element, 'item-name', 'Nails');
        await submitAndSettle(fixture, element);
        expect(photos.saved.size).toBe(1);
      });

      it('says "Couldn\'t save the photo." and does not add the item when the photo cannot be saved', async () => {
        photos.failSave = true;
        const { fixture, element, added } = await setupPhoto();
        type(element, 'item-name', 'Hammer');
        type(element, 'item-quantity', '3');
        await choose(fixture, element);
        await submitAndSettle(fixture, element);
        expect(added).not.toHaveBeenCalled();
        expect(photoErrors(element)).toEqual(["Couldn't save the photo."]);
        expect(element.querySelector('.status')?.textContent?.trim()).toBe('');
        // Nothing the user typed or chose is lost.
        expect(field(element, 'item-name').value).toBe('Hammer');
        expect(field(element, 'item-quantity').value).toBe('3');
        expect(photoButtons(element)).toEqual(['Replace', 'Remove']);
      });

      it('adds the item when the save works on a second try, and clears the error', async () => {
        photos.failSave = true;
        const { fixture, element, added } = await setupPhoto();
        type(element, 'item-name', 'Hammer');
        await choose(fixture, element);
        await submitAndSettle(fixture, element);
        photos.failSave = false;
        await submitAndSettle(fixture, element);
        expect(added).toHaveBeenCalledTimes(1);
        expect(added.mock.calls[0][0].photoId).toBe('photo-1');
        expect(photoErrors(element)).toEqual([]);
      });

      it('saves no photo when the form has an error in another field', async () => {
        const { fixture, element, added } = await setupPhoto();
        await choose(fixture, element); // the name is empty
        await submitAndSettle(fixture, element);
        expect(added).not.toHaveBeenCalled();
        expect(photos.saved.size).toBe(0);
      });

      it('saves the photo once when "Add" is pressed twice in a row', async () => {
        const { fixture, element, added } = await setupPhoto();
        type(element, 'item-name', 'Hammer');
        await choose(fixture, element);
        element.querySelector('form')?.dispatchEvent(new Event('submit'));
        element.querySelector('form')?.dispatchEvent(new Event('submit'));
        await settle();
        fixture.detectChanges();
        expect(photos.saved.size).toBe(1);
        expect(added).toHaveBeenCalledTimes(1);
      });
    });

    describe('editing an item', () => {
      const withPhoto: Item = { ...hammer, photoId: 'p-old' };

      beforeEach(() => {
        photos.add('p-old');
      });

      it('shows the photo of the item, loaded from its thumbnail', async () => {
        const load = vi.spyOn(photos, 'load');
        const { element } = await setupPhoto({ item: withPhoto });
        expect(load).toHaveBeenCalledWith('p-old', 'thumbnail');
        expect(element.querySelector('.photo-preview img')?.getAttribute('src')).toBe(
          urls.created[0],
        );
        expect(photoButtons(element)).toEqual(['Replace', 'Remove']);
      });

      it('offers "Add photo" for an item without a photo', async () => {
        const { element } = await setupPhoto({ item: hammer });
        expect(photoButtons(element)).toEqual(['Add photo']);
      });

      it('keeps the photo, and saves no new one, when the photo is not touched', async () => {
        const { fixture, element, saved } = await setupPhoto({ item: withPhoto });
        type(element, 'item-name', 'Claw hammer');
        await submitAndSettle(fixture, element);
        expect(saved.mock.calls[0][0].photoId).toBe('p-old');
        expect([...photos.saved.keys()]).toEqual(['p-old']);
      });

      it('saves the new photo and emits its id when the photo is replaced', async () => {
        const { fixture, element, saved } = await setupPhoto({ item: withPhoto });
        await choose(fixture, element);
        expect(element.querySelector('.photo-preview img')?.getAttribute('src')).toBe(
          urls.created[1],
        );
        expect(photos.saved.size).toBe(1); // nothing saved until "Save"
        await submitAndSettle(fixture, element);
        expect(saved).toHaveBeenCalledTimes(1);
        expect(saved.mock.calls[0][0].photoId).toBe('photo-1');
        // The form does not delete the old photo: the photo cleanup does, once the item is saved.
        expect(photos.deleted).toEqual([]);
        expect(photos.saved.has('p-old')).toBe(true);
      });

      it('emits no photo when the photo is removed, without deleting it', async () => {
        const { fixture, element, saved } = await setupPhoto({ item: withPhoto });
        (element.querySelector('.photo-remove') as HTMLButtonElement).click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(photoButtons(element)).toEqual(['Add photo']);
        expect(document.activeElement).toBe(element.querySelector('.photo-add'));
        expect(photos.deleted).toEqual([]);
        await submitAndSettle(fixture, element);
        expect(saved.mock.calls[0][0].photoId).toBeNull();
        expect(photos.deleted).toEqual([]);
      });

      it('leaves everything as it was when a photo is chosen and the form is cancelled', async () => {
        const { fixture, element, saved } = await setupPhoto({ item: withPhoto });
        const closed = vi.fn();
        fixture.componentInstance.closed.subscribe(closed);
        await choose(fixture, element);
        button(element, 'Cancel')?.click();
        expect(closed).toHaveBeenCalledTimes(1);
        expect(saved).not.toHaveBeenCalled();
        expect([...photos.saved.keys()]).toEqual(['p-old']);
        expect(photos.deleted).toEqual([]);
      });

      it('does not save the item when the new photo cannot be saved', async () => {
        photos.failSave = true;
        const { fixture, element, saved } = await setupPhoto({ item: withPhoto });
        await choose(fixture, element);
        await submitAndSettle(fixture, element);
        expect(saved).not.toHaveBeenCalled();
        expect(photoErrors(element)).toEqual(["Couldn't save the photo."]);
      });

      it('treats a photo that does not exist any more as no photo', async () => {
        const { fixture, element, saved } = await setupPhoto({
          item: { ...hammer, photoId: 'p-lost' },
        });
        expect(photoButtons(element)).toEqual(['Add photo']);
        expect(element.querySelector('.photo-preview')).toBeNull();
        await submitAndSettle(fixture, element);
        expect(saved.mock.calls[0][0].photoId).toBeNull();
      });
    });

    describe('the camera button', () => {
      const withPhoto: Item = { ...hammer, photoId: 'p-old' };
      const messages = [
        'This file is not an image.',
        'This photo is too large. The maximum is 30 MB.',
        "Couldn't read this image. Try a JPEG or PNG photo.",
      ];
      let touch: WritableSignal<boolean>;

      function cameraInput(element: HTMLElement): HTMLInputElement | null {
        return element.querySelector('input[capture]');
      }

      /**
       * What the user does: presses a button of the photo field (the picker is not really
       * opened) and then the browser reports the chosen file on the field of that button.
       */
      async function pick(
        fixture: ComponentFixture<unknown>,
        element: HTMLElement,
        buttonSelector: string,
        file = picture,
      ) {
        const input = buttonSelector === '.photo-camera' ? cameraInput(element)! : fileInput(element);
        const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
        (element.querySelector(buttonSelector) as HTMLButtonElement).click();
        click.mockRestore();
        await choose(fixture, element, file, input);
      }

      beforeEach(() => {
        photos.add('p-old');
        touch = signal(true);
        TestBed.configureTestingModule({
          providers: [{ provide: TouchScreen, useValue: { coarse: touch } }],
        });
      });

      describe('where it is shown', () => {
        it('shows "Take photo" next to "Add photo" when there is no photo', async () => {
          const { element } = await setupPhoto();
          expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
        });

        it('shows "Replace", "Take photo" and "Remove" when there is a photo, in that order', async () => {
          const { element } = await setupPhoto({ item: withPhoto });
          expect(photoButtons(element)).toEqual(['Replace', 'Take photo', 'Remove']);
        });

        it('shows it after a photo is chosen, and again after it is removed', async () => {
          const { fixture, element } = await setupPhoto();
          await choose(fixture, element);
          expect(photoButtons(element)).toEqual(['Replace', 'Take photo', 'Remove']);
          (element.querySelector('.photo-remove') as HTMLButtonElement).click();
          fixture.detectChanges();
          expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
        });

        it('shows no camera button with a mouse: one button, as before', async () => {
          touch.set(false);
          const empty = await setupPhoto();
          expect(photoButtons(empty.element)).toEqual(['Add photo']);
          expect(cameraInput(empty.element)).toBeNull();
          expect(empty.element.querySelectorAll('input[type="file"]').length).toBe(1);
          document.body.replaceChildren();
          const filled = await setupPhoto({ item: withPhoto });
          expect(photoButtons(filled.element)).toEqual(['Replace', 'Remove']);
          expect(filled.element.querySelector('.photo-camera')).toBeNull();
        });

        it('appears and disappears when the screen changes, without reopening the form', async () => {
          const { fixture, element } = await setupPhoto();
          touch.set(false);
          fixture.detectChanges();
          expect(photoButtons(element)).toEqual(['Add photo']);
          expect(cameraInput(element)).toBeNull();
          touch.set(true);
          fixture.detectChanges();
          expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
          expect(cameraInput(element)).not.toBeNull();
        });

        it('keeps its group: the buttons are in the photo field, before the Add and Done buttons', async () => {
          const { element } = await setupPhoto();
          const camera = element.querySelector('[role="group"] .photo-camera') as HTMLElement;
          expect(camera).not.toBeNull();
          expect(
            camera.compareDocumentPosition(button(element, 'Add') as Element) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ).toBeTruthy();
        });

        it('puts the buttons of the field in a row that can wrap, with and without a photo', async () => {
          const empty = await setupPhoto();
          expect(empty.element.querySelector('[role="group"] .actions .photo-camera')).not.toBeNull();
          expect(empty.element.querySelector('[role="group"] .actions .photo-add')).not.toBeNull();
          document.body.replaceChildren();
          const filled = await setupPhoto({ item: withPhoto });
          expect(filled.element.querySelector('[role="group"] .actions .photo-camera')).not.toBeNull();
        });
      });

      describe('its field and its name', () => {
        it('is a second hidden file field that accepts images and uses the rear camera', async () => {
          const { element } = await setupPhoto();
          const camera = cameraInput(element) as HTMLInputElement;
          expect(camera.type).toBe('file');
          expect(camera.getAttribute('accept')).toBe('image/*');
          expect(camera.getAttribute('capture')).toBe('environment');
          expect(camera.hasAttribute('multiple')).toBe(false);
          expect(camera.hidden).toBe(true);
          expect(camera.getAttribute('tabindex')).toBe('-1');
          expect(camera.getAttribute('aria-hidden')).toBe('true');
          expect(element.querySelectorAll('input[type="file"]').length).toBe(2);
        });

        it('leaves the field of "Add photo" and "Replace" without "capture"', async () => {
          const { element } = await setupPhoto();
          expect(fileInput(element).hasAttribute('capture')).toBe(false);
          expect(fileInput(element)).not.toBe(cameraInput(element));
        });

        it('is a button whose name is its visible text, with no aria-label', async () => {
          const { element } = await setupPhoto();
          const camera = element.querySelector('.photo-camera') as HTMLButtonElement;
          expect(camera.textContent?.trim()).toBe('Take photo');
          expect(camera.hasAttribute('aria-label')).toBe(false);
          expect(camera.type).toBe('button');
        });

        it('opens the camera field, and only that one', async () => {
          const { element } = await setupPhoto();
          const camera = vi.spyOn(cameraInput(element) as HTMLInputElement, 'click').mockImplementation(() => undefined);
          const files = vi.spyOn(fileInput(element), 'click').mockImplementation(() => undefined);
          (element.querySelector('.photo-camera') as HTMLButtonElement).click();
          expect(camera).toHaveBeenCalledTimes(1);
          expect(files).not.toHaveBeenCalled();
        });

        it('leaves "Add photo" and "Replace" opening the file field, and not the camera', async () => {
          const { fixture, element } = await setupPhoto();
          const camera = vi.spyOn(cameraInput(element) as HTMLInputElement, 'click').mockImplementation(() => undefined);
          const files = vi.spyOn(fileInput(element), 'click').mockImplementation(() => undefined);
          (element.querySelector('.photo-add') as HTMLButtonElement).click();
          expect(files).toHaveBeenCalledTimes(1);
          await choose(fixture, element);
          (element.querySelector('.photo-replace') as HTMLButtonElement).click();
          expect(files).toHaveBeenCalledTimes(2);
          expect(camera).not.toHaveBeenCalled();
        });
      });

      describe('a photo taken with it', () => {
        it('goes through the same steps: prepared, previewed, and saved only with "Add"', async () => {
          const { fixture, element, added } = await setupPhoto();
          type(element, 'item-name', 'Hammer');
          await pick(fixture, element, '.photo-camera');
          expect(process).toHaveBeenCalledTimes(1);
          expect(process).toHaveBeenCalledWith(picture);
          expect(element.querySelector('.photo-preview img')?.getAttribute('src')).toBe(urls.created[0]);
          expect(photos.saved.size).toBe(1); // only the old photo of the test store
          expect(added).not.toHaveBeenCalled();

          await submitAndSettle(fixture, element);
          expect(added).toHaveBeenCalledTimes(1);
          expect(added.mock.calls[0][0].photoId).toBe('photo-1');
          expect(await photos.saved.get('photo-1')?.full.text()).toBe('chosen-full');
        });

        it('replaces the photo the item already had, and is saved with "Save"', async () => {
          const { fixture, element, saved } = await setupPhoto({ item: withPhoto });
          await pick(fixture, element, '.photo-camera');
          expect(element.querySelector('.photo-preview img')?.getAttribute('src')).toBe(urls.created[1]);
          await submitAndSettle(fixture, element);
          expect(saved.mock.calls[0][0].photoId).toBe('photo-1');
          expect(photos.deleted).toEqual([]);
        });

        it('empties its field, so the same photo can be taken again', async () => {
          const { fixture, element } = await setupPhoto();
          await pick(fixture, element, '.photo-camera');
          expect((cameraInput(element) as HTMLInputElement).value).toBe('');
        });

        it('says "Couldn\'t save the photo." and adds nothing when it cannot be saved', async () => {
          photos.failSave = true;
          const { fixture, element, added } = await setupPhoto();
          type(element, 'item-name', 'Hammer');
          await pick(fixture, element, '.photo-camera');
          await submitAndSettle(fixture, element);
          expect(added).not.toHaveBeenCalled();
          expect(photoErrors(element)).toEqual(["Couldn't save the photo."]);
        });

        it('shows the errors of the file, leaves the photo as it was, and says nothing is being prepared', async () => {
          for (const message of messages) {
            process.mockRejectedValueOnce(new PhotoError(message));
            const { fixture, element } = await setupPhoto();
            await pick(fixture, element, '.photo-camera');
            expect(photoErrors(element)).toEqual([message]);
            expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
            expect(element.querySelector('.photo-status')?.textContent?.trim()).toBe('');
            document.body.replaceChildren();
          }
        });

        it('says the image could not be read for any other failure', async () => {
          process.mockRejectedValueOnce(new Error('out of memory'));
          const { fixture, element } = await setupPhoto();
          await pick(fixture, element, '.photo-camera');
          expect(photoErrors(element)).toEqual(["Couldn't read this image. Try a JPEG or PNG photo."]);
        });

        it('does nothing when the user comes back from the camera without a photo', async () => {
          const { fixture, element } = await setupPhoto();
          const camera = cameraInput(element) as HTMLInputElement;
          Object.defineProperty(camera, 'files', { value: [], configurable: true });
          camera.dispatchEvent(new Event('change'));
          await settle();
          fixture.detectChanges();
          expect(process).not.toHaveBeenCalled();
          expect(photoErrors(element)).toEqual([]);
          expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
        });
      });

      describe('focus', () => {
        const focused = (element: HTMLElement, selector: string) =>
          expect(document.activeElement).toBe(element.querySelector(selector));

        it('goes to "Add photo" when the form is opened to add a photo, and the camera button is there too', async () => {
          const { element } = await setupPhoto({ item: hammer, focusOn: 'photo' });
          focused(element, '.photo-add');
          expect(element.querySelector('.photo-camera')).not.toBeNull();
        });

        it('goes to "Replace" after a valid photo when there was no photo (taken or from a file)', async () => {
          for (const opener of ['.photo-camera', '.photo-add']) {
            const { fixture, element } = await setupPhoto();
            await pick(fixture, element, opener);
            focused(element, '.photo-replace');
            document.body.replaceChildren();
          }
        });

        it('stays on "Take photo" after a valid photo taken when the form already had a photo', async () => {
          const { fixture, element } = await setupPhoto({ item: withPhoto });
          await pick(fixture, element, '.photo-camera');
          focused(element, '.photo-camera');
        });

        it('stays on "Replace" after a valid photo chosen with it', async () => {
          const { fixture, element } = await setupPhoto({ item: withPhoto });
          await pick(fixture, element, '.photo-replace');
          focused(element, '.photo-replace');
        });

        it('goes back to the button that opened the picker after an error: "Take photo"', async () => {
          process.mockRejectedValueOnce(new PhotoError(messages[0]));
          const { fixture, element } = await setupPhoto();
          await pick(fixture, element, '.photo-camera');
          focused(element, '.photo-camera');
        });

        it('goes back to the button that opened the picker after an error: "Add photo"', async () => {
          process.mockRejectedValueOnce(new PhotoError(messages[1]));
          const { fixture, element } = await setupPhoto();
          await pick(fixture, element, '.photo-add');
          focused(element, '.photo-add');
        });

        it('goes back to the button that opened the picker after an error: "Replace" and "Take photo" with a photo', async () => {
          for (const opener of ['.photo-replace', '.photo-camera']) {
            process.mockRejectedValueOnce(new PhotoError(messages[2]));
            const { fixture, element } = await setupPhoto({ item: withPhoto });
            await pick(fixture, element, opener);
            focused(element, opener);
            expect(photoButtons(element)).toEqual(['Replace', 'Take photo', 'Remove']);
            document.body.replaceChildren();
          }
        });

        it('goes to "Add photo" after "Remove"', async () => {
          const { fixture, element } = await setupPhoto({ item: withPhoto });
          (element.querySelector('.photo-remove') as HTMLButtonElement).click();
          fixture.detectChanges();
          await fixture.whenStable();
          focused(element, '.photo-add');
          expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
        });
      });
    });

    describe('the camera button with the real touch screen check', () => {
      let media: PointerQueryStub;

      beforeEach(() => {
        media = stubMatchMedia(true);
      });

      afterEach(() => {
        media.restore();
      });

      it('is shown when the browser says the main pointer is coarse', async () => {
        const { element } = await setupPhoto();
        expect(media.queries).toEqual(['(pointer: coarse)']);
        expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
      });

      it('is not shown when it is a mouse, and follows the change of the screen', async () => {
        media.setMatches(false);
        const { fixture, element } = await setupPhoto();
        expect(photoButtons(element)).toEqual(['Add photo']);
        media.setMatches(true);
        fixture.detectChanges();
        expect(photoButtons(element)).toEqual(['Add photo', 'Take photo']);
      });
    });

    describe('focus when the form opens', () => {
      it('goes to the name by default', async () => {
        const { element } = await setupPhoto({ item: hammer });
        expect(document.activeElement).toBe(field(element, 'item-name'));
      });

      it('goes to "Add photo" of the photo field when the form is opened to add a photo', async () => {
        const { element } = await setupPhoto({ item: hammer, focusOn: 'photo' });
        expect(document.activeElement).toBe(element.querySelector('.photo-add'));
      });
    });

    it('revokes every address it created when the form is destroyed', async () => {
      photos.add('p-old');
      const { fixture, element } = await setupPhoto({ item: { ...hammer, photoId: 'p-old' } });
      await choose(fixture, element);
      expect(urls.created.length).toBe(2);
      fixture.destroy();
      expect(urls.alive()).toEqual([]);
    });
  });
});

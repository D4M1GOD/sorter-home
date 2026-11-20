import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Item } from '../core/item.model';
import { PhotoStore } from '../core/photo-store';
import { FakePhotoStore, ObjectUrls, settle, stubObjectUrls } from '../core/photo-store.testing';
import { ItemList } from './item-list';

describe('ItemList', () => {
  function item(name: string, values: Partial<Item> = {}): Item {
    return {
      id: `id-${name}`,
      name,
      quantity: 1,
      quantityOut: 0,
      description: '',
      category: '',
      photoId: null,
      ...values,
    };
  }

  async function setup(items: Item[]) {
    const fixture = TestBed.createComponent(ItemList);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function rows(element: HTMLElement): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('.item'));
  }

  it('shows "No items yet." and no list when the container has no items', async () => {
    const { element } = await setup([]);
    expect(element.querySelector('.empty')?.textContent?.trim()).toBe('No items yet.');
    expect(element.querySelector('ul')).toBeNull();
  });

  it('shows the items in a list, without the empty text', async () => {
    const { element } = await setup([item('Nails'), item('Cables')]);
    expect(element.querySelector('.empty')).toBeNull();
    expect(element.querySelectorAll('ul > li').length).toBe(2);
  });

  it('orders the rows by name, ignoring upper/lower case, whatever the stored order', async () => {
    const { element } = await setup([
      item('nails'),
      item('Zip ties'),
      item('Batteries'),
      item('cables'),
    ]);
    const names = rows(element).map((row) => row.querySelector('.item-name')?.textContent?.trim());
    expect(names).toEqual(['Batteries', 'cables', 'nails', 'Zip ties']);
  });

  it('orders the numbers inside the names by value: "Item 2" before "Item 10"', async () => {
    const { element } = await setup([
      item('Item 10'),
      item('Nails 10'),
      item('Item 2'),
      item('Nails 2'),
      item('item 1'),
      item('Hammer'),
    ]);
    const names = rows(element).map((row) => row.querySelector('.item-name')?.textContent?.trim());
    expect(names).toEqual(['Hammer', 'item 1', 'Item 2', 'Item 10', 'Nails 2', 'Nails 10']);
  });

  it('keeps that order when there are more than ten items', async () => {
    const stored = Array.from({ length: 12 }, (_, index) => item(`Item ${index + 1}`)).reverse();
    const { element } = await setup(stored);
    const names = rows(element).map((row) => row.querySelector('.item-name')?.textContent?.trim());
    expect(names).toEqual(Array.from({ length: 12 }, (_, index) => `Item ${index + 1}`));
  });

  it('shows the quantity as "Qty N"', async () => {
    const { element } = await setup([item('Nails', { quantity: 100 })]);
    expect(element.querySelector('.item-quantity')?.textContent?.trim()).toBe('Qty 100');
  });

  it('shows "None left" for the quantity 0', async () => {
    const { element } = await setup([item('Nails', { quantity: 0 })]);
    expect(element.querySelector('.item-quantity')?.textContent?.trim()).toBe('None left');
    expect(element.textContent).not.toContain('Qty 0');
  });

  it('shows the category and the full description', async () => {
    const description = `Line 1\n${'a'.repeat(480)}`;
    const { element } = await setup([item('Nails', { category: 'Hardware', description })]);
    expect(element.querySelector('.item-category')?.textContent?.trim()).toBe('Category: Hardware');
    expect(element.querySelector('.item-description')?.textContent).toBe(description);
  });

  it('shows only the name and the quantity for an item without category or description', async () => {
    const { element } = await setup([item('Nails')]);
    expect(element.querySelector('.item-category')).toBeNull();
    expect(element.querySelector('.item-description')).toBeNull();
    const text = rows(element)[0].querySelector('.item-text')?.textContent;
    expect(text?.replace(/\s+/g, ' ').trim()).toBe('Nails Qty 1');
  });

  it('shows two items with the same name as two rows', async () => {
    const { element } = await setup([
      { ...item('Cable'), id: 'a', description: 'USB-C' },
      { ...item('Cable'), id: 'b', description: 'HDMI' },
    ]);
    expect(rows(element).length).toBe(2);
  });

  it('follows the items when they change', async () => {
    const { fixture, element } = await setup([]);
    fixture.componentRef.setInput('items', [item('Nails')]);
    fixture.detectChanges();
    expect(element.querySelector('.empty')).toBeNull();
    expect(rows(element).length).toBe(1);
  });

  describe('row buttons', () => {
    function outputs(fixture: ComponentFixture<ItemList>) {
      const spies = {
        editRequested: vi.fn(),
        editSaved: vi.fn(),
        editCancelled: vi.fn(),
        deleteRequested: vi.fn(),
        deleteConfirmed: vi.fn(),
        deleteCancelled: vi.fn(),
      };
      const list = fixture.componentInstance;
      list.editRequested.subscribe(spies.editRequested);
      list.editSaved.subscribe(spies.editSaved);
      list.editCancelled.subscribe(spies.editCancelled);
      list.deleteRequested.subscribe(spies.deleteRequested);
      list.deleteConfirmed.subscribe(spies.deleteConfirmed);
      list.deleteCancelled.subscribe(spies.deleteCancelled);
      return spies;
    }

    function buttonLabels(row: HTMLElement): (string | null)[] {
      return Array.from(row.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    }

    it('has a "Take out", an "Edit" and a "Delete" button in each row, named with the item name', async () => {
      const { element } = await setup([item('Nails'), item('Hammer')]);
      expect(buttonLabels(rows(element)[0])).toEqual([
        'Add photo to Hammer',
        'Take out Hammer',
        'Edit Hammer',
        'Delete Hammer',
      ]);
      expect(buttonLabels(rows(element)[1])).toEqual([
        'Add photo to Nails',
        'Take out Nails',
        'Edit Nails',
        'Delete Nails',
      ]);
    });

    it('gives each icon button a tooltip with the same text, and type "button"', async () => {
      const { element } = await setup([item('Hammer')]);
      for (const button of Array.from(
        rows(element)[0].querySelectorAll<HTMLButtonElement>('.icon-button'),
      )) {
        expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'));
        expect(button.type).toBe('button');
      }
    });

    it('draws each icon as an SVG that screen readers skip, with a different drawing for each', async () => {
      const { element } = await setup([item('Hammer')]);
      const icons = Array.from(rows(element)[0].querySelectorAll('button svg'));
      expect(icons.length).toBe(3);
      for (const icon of icons) {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
        expect(icon.getAttribute('focusable')).toBe('false');
      }
      // The meaning does not rely on color: the two drawings are different.
      expect(new Set(icons.map((icon) => icon.innerHTML)).size).toBe(3);
      expect(element.querySelector('img')).toBeNull();
    });

    it('puts the buttons below the text of the row, in the order "Take out", "Edit", "Delete"', async () => {
      const { element } = await setup([item('Hammer', { category: 'Tools', description: 'Steel' })]);
      const row = rows(element)[0];
      const description = row.querySelector('.item-description') as Element;
      const actions = row.querySelector('.item-actions') as Element;
      expect(
        description.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(buttonLabels(actions as HTMLElement)).toEqual([
        'Take out Hammer',
        'Edit Hammer',
        'Delete Hammer',
      ]);
    });

    it('emits the id of the item when "Edit" or "Delete" is pressed, and changes nothing by itself', async () => {
      const { fixture, element } = await setup([item('Nails'), item('Hammer')]);
      const spies = outputs(fixture);
      (rows(element)[0].querySelector('.item-edit') as HTMLButtonElement).click();
      expect(spies.editRequested).toHaveBeenCalledWith('id-Hammer');
      (rows(element)[1].querySelector('.item-delete') as HTMLButtonElement).click();
      expect(spies.deleteRequested).toHaveBeenCalledWith('id-Nails');
      fixture.detectChanges();
      expect(element.querySelector('app-item-form')).toBeNull();
      expect(element.querySelector('.confirm')).toBeNull();
      expect(spies.deleteConfirmed).not.toHaveBeenCalled();
    });

    it('tells apart two items with the same name by their id', async () => {
      const { fixture, element } = await setup([
        { ...item('Cable'), id: 'a' },
        { ...item('Cable'), id: 'b' },
      ]);
      const spies = outputs(fixture);
      expect(buttonLabels(rows(element)[1])).toEqual([
        'Add photo to Cable',
        'Take out Cable',
        'Edit Cable',
        'Delete Cable',
      ]);
      (rows(element)[1].querySelector('.item-edit') as HTMLButtonElement).click();
      expect(spies.editRequested).toHaveBeenCalledWith('b');
    });
  });

  describe('editing a row', () => {
    async function setupEditing() {
      const result = await setup([
        item('Nails', { quantity: 100, category: 'Hardware' }),
        item('Hammer'),
      ]);
      result.fixture.componentRef.setInput('categories', ['Hardware', 'Tools']);
      result.fixture.componentRef.setInput('editingId', 'id-Nails');
      result.fixture.detectChanges();
      await result.fixture.whenStable();
      return result;
    }

    it('shows the form, filled with the item, in place of that row only', async () => {
      const { element } = await setupEditing();
      const [hammer, nails] = rows(element);
      expect(nails.querySelector('app-item-form')).not.toBeNull();
      expect(nails.querySelector('.item-head')).toBeNull();
      expect(nails.querySelector('.item-actions')).toBeNull();
      expect((nails.querySelector('#item-name') as HTMLInputElement).value).toBe('Nails');
      expect((nails.querySelector('#item-quantity') as HTMLInputElement).value).toBe('100');
      expect(nails.querySelector('h4')?.textContent?.trim()).toBe('Edit item');
      expect(hammer.querySelector('app-item-form')).toBeNull();
      expect(hammer.querySelector('.item-actions')).not.toBeNull();
      expect(element.querySelectorAll('app-item-form').length).toBe(1);
    });

    it('passes the categories to the form as suggestions', async () => {
      const { element } = await setupEditing();
      const options = Array.from(element.querySelectorAll('datalist option')).map((o) =>
        o.getAttribute('value'),
      );
      expect(options).toEqual(['Hardware', 'Tools']);
    });

    it('emits "editSaved" with the values of the form', async () => {
      const { fixture, element } = await setupEditing();
      const spies = outputs(fixture);
      const name = element.querySelector('#item-name') as HTMLInputElement;
      name.value = 'Screws';
      name.dispatchEvent(new Event('input'));
      element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(spies.editSaved).toHaveBeenCalledWith({
        name: 'Screws',
        quantity: 100,
        description: '',
        category: 'Hardware',
        photoId: null,
      });
    });

    it('emits "editCancelled" with Cancel', async () => {
      const { fixture, element } = await setupEditing();
      const spies = outputs(fixture);
      const cancel = Array.from(element.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Cancel',
      );
      cancel?.click();
      expect(spies.editCancelled).toHaveBeenCalledTimes(1);
      expect(spies.editSaved).not.toHaveBeenCalled();
    });

    it('shows the row again when no item is being edited', async () => {
      const { fixture, element } = await setupEditing();
      fixture.componentRef.setInput('editingId', null);
      fixture.detectChanges();
      expect(element.querySelector('app-item-form')).toBeNull();
      expect(rows(element)[1].querySelector('.item-name')?.textContent?.trim()).toBe('Nails');
    });

    function outputs(fixture: ComponentFixture<ItemList>) {
      const spies = { editSaved: vi.fn(), editCancelled: vi.fn() };
      fixture.componentInstance.editSaved.subscribe(spies.editSaved);
      fixture.componentInstance.editCancelled.subscribe(spies.editCancelled);
      return spies;
    }
  });

  describe('delete confirmation of a row', () => {
    async function setupDeleting() {
      const result = await setup([item('Nails', { quantity: 100 }), item('Hammer')]);
      result.fixture.componentRef.setInput('deletingId', 'id-Nails');
      result.fixture.detectChanges();
      const deleteConfirmed = vi.fn();
      const deleteCancelled = vi.fn();
      result.fixture.componentInstance.deleteConfirmed.subscribe(deleteConfirmed);
      result.fixture.componentInstance.deleteCancelled.subscribe(deleteCancelled);
      return { ...result, deleteConfirmed, deleteCancelled };
    }

    function textButtons(row: HTMLElement): (string | undefined)[] {
      return Array.from(row.querySelectorAll('button')).map((b) => b.textContent?.trim());
    }

    it('asks inline, in that row only, in place of its icon buttons', async () => {
      const { element } = await setupDeleting();
      const [hammer, nails] = rows(element);
      const confirm = nails.querySelector('.confirm') as HTMLElement;
      expect(confirm.getAttribute('role')).toBe('alert');
      expect(confirm.querySelector('span')?.textContent?.trim()).toBe(
        'Delete "Nails"? This cannot be undone.',
      );
      expect(textButtons(nails)).toEqual(['Yes, delete', 'Cancel']);
      expect(nails.querySelector('.item-actions')).toBeNull();
      // The row keeps its text, so the user sees what is about to be deleted.
      expect(nails.querySelector('.item-name')?.textContent?.trim()).toBe('Nails');
      expect(hammer.querySelector('.confirm')).toBeNull();
      expect(hammer.querySelector('.item-actions')).not.toBeNull();
    });

    it('emits "deleteConfirmed" with the id only after "Yes, delete"', async () => {
      const { element, deleteConfirmed, deleteCancelled } = await setupDeleting();
      expect(deleteConfirmed).not.toHaveBeenCalled();
      (element.querySelector('.item-confirm-delete') as HTMLButtonElement).click();
      expect(deleteConfirmed).toHaveBeenCalledTimes(1);
      expect(deleteConfirmed).toHaveBeenCalledWith('id-Nails');
      expect(deleteCancelled).not.toHaveBeenCalled();
    });

    it('emits "deleteCancelled" with Cancel and with the Escape key', async () => {
      const { element, deleteConfirmed, deleteCancelled } = await setupDeleting();
      (element.querySelector('.item-cancel-delete') as HTMLButtonElement).click();
      expect(deleteCancelled).toHaveBeenCalledTimes(1);
      element
        .querySelector('.item-confirm-delete')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(deleteCancelled).toHaveBeenCalledTimes(2);
      expect(deleteConfirmed).not.toHaveBeenCalled();
    });

    it('never uses window.confirm', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      const { element } = await setupDeleting();
      (element.querySelector('.item-confirm-delete') as HTMLButtonElement).click();
      expect(confirmSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('units out of the container', () => {
    function buttonNames(row: HTMLElement): (string | null)[] {
      return Array.from(row.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    }

    function text(row: HTMLElement, selector: string): string | undefined {
      return row.querySelector(selector)?.textContent?.trim();
    }

    it('all inside: shows "Qty 100", no "out" line, and "Take out", "Edit" and "Delete"', async () => {
      const { element } = await setup([item('Nails', { quantity: 100 })]);
      const row = rows(element)[0];
      expect(text(row, '.item-quantity')).toBe('Qty 100');
      expect(row.querySelector('.item-out')).toBeNull();
      expect(buttonNames(row)).toEqual([
        'Add photo to Nails',
        'Take out Nails',
        'Edit Nails',
        'Delete Nails',
      ]);
    });

    it('some out: shows "Qty 100" and "20 of 100 out", with all the buttons', async () => {
      const { element } = await setup([item('Nails', { quantity: 100, quantityOut: 20 })]);
      const row = rows(element)[0];
      expect(text(row, '.item-quantity')).toBe('Qty 100');
      expect(text(row, '.item-out')).toBe('20 of 100 out');
      expect(buttonNames(row)).toEqual([
        'Put back Nails',
        'Used Nails',
        'Add photo to Nails',
        'Take out Nails',
        'Edit Nails',
        'Delete Nails',
      ]);
    });

    it('all out: shows "Qty 4" and "4 of 4 out" (not "None left"), without "Take out"', async () => {
      const { element } = await setup([item('Lights', { quantity: 4, quantityOut: 4 })]);
      const row = rows(element)[0];
      expect(text(row, '.item-quantity')).toBe('Qty 4');
      expect(text(row, '.item-out')).toBe('4 of 4 out');
      expect(row.textContent).not.toContain('None left');
      expect(buttonNames(row)).toEqual([
        'Put back Lights',
        'Used Lights',
        'Add photo to Lights',
        'Edit Lights',
        'Delete Lights',
      ]);
    });

    it('quantity 0: shows "None left", with only "Edit" and "Delete"', async () => {
      const { element } = await setup([item('Nails', { quantity: 0 })]);
      const row = rows(element)[0];
      expect(text(row, '.item-quantity')).toBe('None left');
      expect(row.querySelector('.item-out')).toBeNull();
      expect(buttonNames(row)).toEqual(['Add photo to Nails', 'Edit Nails', 'Delete Nails']);
    });

    it('"Put back" and "Used" are text buttons, below the "out" line and above the icons', async () => {
      const { element } = await setup([item('Nails', { quantity: 100, quantityOut: 20 })]);
      const row = rows(element)[0];
      const putBack = row.querySelector('.item-put-back') as HTMLButtonElement;
      const used = row.querySelector('.item-used') as HTMLButtonElement;
      expect(putBack.textContent?.trim()).toBe('Put back');
      expect(used.textContent?.trim()).toBe('Used');
      expect(putBack.type).toBe('button');
      expect(used.type).toBe('button');
      // The visible text is part of the accessible name, so voice control finds the button.
      expect(putBack.getAttribute('aria-label')).toContain('Put back');
      const parts = [
        row.querySelector('.item-out'),
        putBack,
        used,
        row.querySelector('.item-take-out'),
      ] as Element[];
      for (let i = 0; i < parts.length - 1; i++) {
        expect(
          parts[i].compareDocumentPosition(parts[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });

    it('"Take out" is an icon button like the others: SVG hidden from screen readers, tooltip, first', async () => {
      const { element } = await setup([item('Nails', { quantity: 100 })]);
      const row = rows(element)[0];
      const takeOut = row.querySelector('.item-take-out') as HTMLButtonElement;
      expect(takeOut.classList.contains('icon-button')).toBe(true);
      expect(takeOut.type).toBe('button');
      expect(takeOut.getAttribute('title')).toBe('Take out Nails');
      const icon = takeOut.querySelector('svg') as SVGElement;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('focusable')).toBe('false');
      const drawings = Array.from(row.querySelectorAll('.item-actions svg')).map((s) => s.innerHTML);
      expect(new Set(drawings).size).toBe(3); // three different drawings
      expect(row.querySelector('.item-actions button')).toBe(takeOut);
    });

    it('emits what was asked for, with the id of the item, and changes nothing by itself', async () => {
      const { fixture, element } = await setup([item('Nails', { quantity: 100, quantityOut: 20 })]);
      const requested = vi.fn();
      fixture.componentInstance.unitsRequested.subscribe(requested);
      const row = rows(element)[0];
      (row.querySelector('.item-take-out') as HTMLButtonElement).click();
      (row.querySelector('.item-put-back') as HTMLButtonElement).click();
      (row.querySelector('.item-used') as HTMLButtonElement).click();
      expect(requested.mock.calls.map((call) => call[0])).toEqual([
        { itemId: 'id-Nails', mode: 'take-out' },
        { itemId: 'id-Nails', mode: 'put-back' },
        { itemId: 'id-Nails', mode: 'used' },
      ]);
      fixture.detectChanges();
      expect(element.querySelector('app-item-units-form')).toBeNull();
    });

    describe('the small form', () => {
      async function setupForm(mode: 'take-out' | 'put-back' | 'used') {
        const result = await setup([
          item('Nails', { quantity: 100, quantityOut: 20 }),
          item('Hammer', { quantity: 3, quantityOut: 1 }),
        ]);
        result.fixture.componentRef.setInput('unitsAction', { itemId: 'id-Nails', mode });
        result.fixture.detectChanges();
        await result.fixture.whenStable();
        const submitted = vi.fn();
        const cancelled = vi.fn();
        result.fixture.componentInstance.unitsSubmitted.subscribe(submitted);
        result.fixture.componentInstance.unitsCancelled.subscribe(cancelled);
        return { ...result, submitted, cancelled };
      }

      it('takes the place of the buttons of that row only, and the row keeps its text', async () => {
        const { element } = await setupForm('take-out');
        const [hammer, nails] = rows(element);
        expect(nails.querySelector('app-item-units-form')).not.toBeNull();
        expect(nails.querySelector('.item-actions')).toBeNull();
        expect(nails.querySelector('.item-out-actions')).toBeNull();
        expect(text(nails, '.item-name')).toBe('Nails');
        expect(text(nails, '.item-out')).toBe('20 of 100 out');
        expect(hammer.querySelector('app-item-units-form')).toBeNull();
        expect(hammer.querySelector('.item-actions')).not.toBeNull();
        expect(element.querySelectorAll('app-item-units-form').length).toBe(1);
      });

      it('opens for the item and the action asked for', async () => {
        const takeOut = await setupForm('take-out');
        expect(text(takeOut.element, 'app-item-units-form h4')).toBe('Take out or use Nails');
        expect((takeOut.element.querySelector('#item-units') as HTMLInputElement).value).toBe('80');
        const putBack = await setupForm('put-back');
        expect(text(putBack.element, 'app-item-units-form h4')).toBe('Put back Nails');
        expect((putBack.element.querySelector('#item-units') as HTMLInputElement).value).toBe('20');
        const used = await setupForm('used');
        expect(text(used.element, 'app-item-units-form h4')).toBe('Mark Nails as used');
      });

      it('emits "unitsSubmitted" with the action and the units', async () => {
        const { fixture, element, submitted } = await setupForm('put-back');
        const field = element.querySelector('#item-units') as HTMLInputElement;
        field.value = '5';
        field.dispatchEvent(new Event('input'));
        element.querySelector('app-item-units-form form')?.dispatchEvent(new Event('submit'));
        await fixture.whenStable();
        expect(submitted).toHaveBeenCalledWith({ action: 'put-back', units: 5 });
      });

      it('emits "unitsCancelled" with Cancel', async () => {
        const { element, submitted, cancelled } = await setupForm('used');
        const cancel = Array.from(element.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === 'Cancel',
        );
        cancel?.click();
        expect(cancelled).toHaveBeenCalledTimes(1);
        expect(submitted).not.toHaveBeenCalled();
      });

      it('shows the buttons again when the form is closed', async () => {
        const { fixture, element } = await setupForm('take-out');
        fixture.componentRef.setInput('unitsAction', null);
        fixture.detectChanges();
        expect(element.querySelector('app-item-units-form')).toBeNull();
        expect(rows(element)[1].querySelector('.item-actions')).not.toBeNull();
      });
    });

    it('says in the delete confirmation that units are out', async () => {
      const { fixture, element } = await setup([item('Nails', { quantity: 100, quantityOut: 20 })]);
      fixture.componentRef.setInput('deletingId', 'id-Nails');
      fixture.detectChanges();
      expect(text(rows(element)[0], '.confirm span')).toBe(
        'Delete "Nails"? 20 of 100 are out of the container. This cannot be undone.',
      );
    });
  });

  describe('photos', () => {
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

    /** "Hammer" has a photo and "Nails" has none. The rows are shown as Hammer, Nails. */
    async function setupPhotos(hammerPhotoId = 'p-hammer') {
      const result = await setup([item('Nails'), item('Hammer', { photoId: hammerPhotoId })]);
      await settle();
      result.fixture.detectChanges();
      const photoAddRequested = vi.fn();
      const photoOpened = vi.fn();
      result.fixture.componentInstance.photoAddRequested.subscribe(photoAddRequested);
      result.fixture.componentInstance.photoOpened.subscribe(photoOpened);
      const [hammer, nails] = rows(result.element);
      return { ...result, hammer, nails, photoAddRequested, photoOpened };
    }

    function names(row: HTMLElement): (string | null)[] {
      return Array.from(row.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    }

    it('shows the thumbnail of an item with a photo, on the left of its text', async () => {
      const { hammer } = await setupPhotos();
      const thumbnail = hammer.querySelector('.item-main app-item-photo') as HTMLElement;
      const text = hammer.querySelector('.item-main .item-text') as HTMLElement;
      expect(thumbnail.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(text.querySelector('.item-name')?.textContent?.trim()).toBe('Hammer');
      expect(thumbnail.querySelector('img')?.getAttribute('src')).toBe(urls.created[0]);
    });

    it('names the thumbnail button with the item, and does not offer "Add photo" for it', async () => {
      const { hammer } = await setupPhotos();
      expect(names(hammer)).toEqual([
        'View photo of Hammer',
        'Take out Hammer',
        'Edit Hammer',
        'Delete Hammer',
      ]);
      expect(hammer.querySelector('.item-add-photo')).toBeNull();
    });

    it('offers the text button "Add photo" for an item without a photo, and no thumbnail', async () => {
      const { nails } = await setupPhotos();
      const add = nails.querySelector('.item-add-photo') as HTMLButtonElement;
      expect(add.textContent?.trim()).toBe('Add photo');
      expect(add.getAttribute('aria-label')).toBe('Add photo to Nails');
      expect(add.type).toBe('button');
      expect(nails.querySelector('app-item-photo')).toBeNull();
    });

    it('puts "Add photo" in its own line, below the text and above the icon buttons', async () => {
      const result = await setup([item('Nails', { quantity: 100, quantityOut: 20 })]);
      const row = rows(result.element)[0];
      const parts = [
        row.querySelector('.item-text'),
        row.querySelector('.item-out-actions'),
        row.querySelector('.item-photo-actions'),
        row.querySelector('.item-actions'),
      ] as Element[];
      for (let i = 0; i < parts.length - 1; i++) {
        expect(
          parts[i].compareDocumentPosition(parts[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(row.querySelector('.item-actions .item-add-photo')).toBeNull();
    });

    it('emits the id of the item when "Add photo" or the thumbnail is pressed, and changes nothing', async () => {
      const { fixture, element, hammer, nails, photoAddRequested, photoOpened } =
        await setupPhotos();
      (nails.querySelector('.item-add-photo') as HTMLButtonElement).click();
      expect(photoAddRequested).toHaveBeenCalledWith('id-Nails');
      (hammer.querySelector('.item-photo') as HTMLButtonElement).click();
      expect(photoOpened).toHaveBeenCalledWith('id-Hammer');
      fixture.detectChanges();
      expect(element.querySelector('app-item-form')).toBeNull();
    });

    it('shows a row whose photo does not exist any more as a row without a photo', async () => {
      const { hammer } = await setupPhotos('p-lost');
      expect(hammer.querySelector('app-item-photo')).toBeNull();
      expect(names(hammer)).toEqual([
        'Add photo to Hammer',
        'Take out Hammer',
        'Edit Hammer',
        'Delete Hammer',
      ]);
    });

    it('keeps the thumbnail while the delete confirmation or the units form is open', async () => {
      const { fixture, element } = await setupPhotos();
      fixture.componentRef.setInput('deletingId', 'id-Hammer');
      fixture.detectChanges();
      expect(rows(element)[0].querySelector('app-item-photo')).not.toBeNull();
      fixture.componentRef.setInput('deletingId', null);
      fixture.componentRef.setInput('unitsAction', { itemId: 'id-Hammer', mode: 'take-out' });
      fixture.detectChanges();
      expect(rows(element)[0].querySelector('app-item-photo')).not.toBeNull();
      expect(rows(element)[1].querySelector('.item-add-photo')).not.toBeNull();
    });

    it('hides "Add photo" of a row while its delete confirmation or its units form is open', async () => {
      const { fixture, element } = await setupPhotos();
      fixture.componentRef.setInput('deletingId', 'id-Nails');
      fixture.detectChanges();
      expect(rows(element)[1].querySelector('.item-add-photo')).toBeNull();
    });

    it('revokes the address of a thumbnail when its row is removed', async () => {
      const { fixture } = await setupPhotos();
      expect(urls.alive().length).toBe(1);
      fixture.componentRef.setInput('items', [item('Nails')]);
      fixture.detectChanges();
      expect(urls.alive()).toEqual([]);
    });

    it('revokes the address of the thumbnail while the row shows the edit form', async () => {
      const { fixture } = await setupPhotos();
      const thumbnail = urls.created[0];
      fixture.componentRef.setInput('editingId', 'id-Hammer');
      fixture.detectChanges();
      expect(urls.revoked).toContain(thumbnail);
    });

    describe('the edit form', () => {
      async function setupEditing(editFocus: 'name' | 'photo') {
        const result = await setup([item('Nails')]);
        document.body.appendChild(result.fixture.nativeElement);
        result.fixture.componentRef.setInput('editFocus', editFocus);
        result.fixture.componentRef.setInput('editingId', 'id-Nails');
        result.fixture.detectChanges();
        await result.fixture.whenStable();
        return result;
      }

      it('opens with the focus on the name by default', async () => {
        const { element } = await setupEditing('name');
        expect(document.activeElement).toBe(element.querySelector('#item-name'));
      });

      it('opens with the focus on the photo field when it was asked for', async () => {
        const { element } = await setupEditing('photo');
        expect(document.activeElement).toBe(element.querySelector('app-item-form .photo-add'));
      });
    });

    it('focusControl puts the focus on "Add photo" and on the thumbnail', async () => {
      const { fixture, hammer, nails } = await setupPhotos();
      document.body.appendChild(fixture.nativeElement);
      fixture.componentInstance.focusControl('id-Nails', 'add-photo');
      expect(document.activeElement).toBe(nails.querySelector('.item-add-photo'));
      fixture.componentInstance.focusControl('id-Hammer', 'photo');
      expect(document.activeElement).toBe(hammer.querySelector('button.item-photo'));
    });
  });

  describe('focusControl', () => {
    describe('the row itself (the item of a search result)', () => {
      async function setupRows() {
        const result = await setup([item('Nails'), item('Hammer')]);
        document.body.appendChild(result.fixture.nativeElement);
        const [hammer, nails] = rows(result.element);
        return { ...result, hammer, nails };
      }

      it('puts the focus on the row of the item', async () => {
        const { fixture, nails } = await setupRows();
        fixture.componentInstance.focusControl('id-Nails', 'row');
        expect(document.activeElement).toBe(nails);
      });

      it('does not make the row a stop of the Tab key', async () => {
        const { fixture, nails, hammer } = await setupRows();
        expect(nails.hasAttribute('tabindex')).toBe(false);
        fixture.componentInstance.focusControl('id-Nails', 'row');
        expect(nails.getAttribute('tabindex')).toBe('-1');
        expect(hammer.hasAttribute('tabindex')).toBe(false);
      });

      it('lets the row go back to how it was when the focus leaves it', async () => {
        const { fixture, element, nails } = await setupRows();
        fixture.componentInstance.focusControl('id-Nails', 'row');
        (element.querySelector('button[aria-label="Edit Hammer"]') as HTMLButtonElement).focus();
        expect(nails.hasAttribute('tabindex')).toBe(false);
      });

      it('does nothing for an item that is not in the list', async () => {
        const { fixture } = await setupRows();
        const before = document.activeElement;
        fixture.componentInstance.focusControl('nope', 'row');
        expect(document.activeElement).toBe(before);
      });
    });

    it('puts the focus on "Take out", "Put back" and "Used"', async () => {
      const { fixture, element } = await setup([item('Nails', { quantity: 100, quantityOut: 20 })]);
      document.body.appendChild(fixture.nativeElement);
      for (const control of ['take-out', 'put-back', 'used'] as const) {
        fixture.componentInstance.focusControl('id-Nails', control);
        expect(document.activeElement).toBe(element.querySelector(`.item-${control}`));
      }
    });

    async function setupAttached(deletingId: string | null = null) {
      const result = await setup([item('Nails'), item('Hammer')]);
      document.body.appendChild(result.fixture.nativeElement);
      result.fixture.componentRef.setInput('deletingId', deletingId);
      result.fixture.detectChanges();
      return result;
    }

    afterEach(() => {
      document.body.replaceChildren();
    });

    it('puts the focus on the "Edit" or the "Delete" button of the row of an item', async () => {
      const { fixture, element } = await setupAttached();
      fixture.componentInstance.focusControl('id-Nails', 'edit');
      expect(document.activeElement).toBe(rows(element)[1].querySelector('.item-edit'));
      fixture.componentInstance.focusControl('id-Hammer', 'delete');
      expect(document.activeElement).toBe(rows(element)[0].querySelector('.item-delete'));
    });

    it('puts the focus on "Cancel" of the delete confirmation', async () => {
      const { fixture, element } = await setupAttached('id-Nails');
      fixture.componentInstance.focusControl('id-Nails', 'cancel-delete');
      expect(document.activeElement).toBe(element.querySelector('.item-cancel-delete'));
    });

    it('does nothing for an item or a control that is not drawn', async () => {
      const { fixture } = await setupAttached();
      const before = document.activeElement;
      fixture.componentInstance.focusControl('nope', 'edit');
      fixture.componentInstance.focusControl('id-Nails', 'cancel-delete');
      expect(document.activeElement).toBe(before);
    });
  });
});

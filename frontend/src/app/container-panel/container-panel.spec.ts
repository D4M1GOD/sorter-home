import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createContainer, TOUGH_BOX_27_GAL } from '../core/container.model';
import {
  Item,
  markUsedFromInside,
  markUsedFromOut,
  putBack,
  takeOut,
} from '../core/item.model';
import { BatchResult, BatchRunOptions, ItemPhotoBatch } from '../core/item-photo-batch';
import { PHOTO_BATCH_MAX } from '../core/photo-batch';
import { PhotoProcessor } from '../core/photo-processor';
import { PhotoStore } from '../core/photo-store';
import {
  fakePhoto,
  FakePhotoStore,
  ObjectUrls,
  settle,
  stubObjectUrls,
} from '../core/photo-store.testing';
import { TouchScreen } from '../core/touch-screen';
import { ContainerPanel, ItemEdited, ItemUnitsChanged } from './container-panel';

describe('ContainerPanel', () => {
  const container = createContainer(TOUGH_BOX_27_GAL.id, 'Toys', 0, 0);

  async function setup() {
    const fixture = TestBed.createComponent(ContainerPanel);
    fixture.componentRef.setInput('container', container);
    fixture.detectChanges();
    await fixture.whenStable();
    const renamed = vi.fn();
    const deleted = vi.fn();
    fixture.componentInstance.renamed.subscribe(renamed);
    fixture.componentInstance.deleted.subscribe(deleted);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, renamed, deleted };
  }

  function input(element: HTMLElement): HTMLInputElement {
    return element.querySelector('#container-name') as HTMLInputElement;
  }

  function type(element: HTMLElement, text: string): void {
    const field = input(element);
    field.value = text;
    field.dispatchEvent(new Event('input'));
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').trim().startsWith(label),
    );
  }

  it('shows the title, the read-only type and the current name', async () => {
    const { element } = await setup();
    expect(element.querySelector('h2')?.textContent).toContain('Container');
    expect(element.textContent).toContain(TOUGH_BOX_27_GAL.label);
    expect(input(element).value).toBe('Toys');
  });

  it('offers Rotate 90°, Add item and Delete, plus Edit and Delete for each item, and no other actions', async () => {
    const { fixture, element } = await setup();
    const labels = () =>
      Array.from(element.querySelectorAll('button')).map(
        (b) => b.getAttribute('aria-label') ?? b.textContent?.trim(),
      );
    expect(labels()).toEqual(['Rotate 90°', 'Add item', 'Add several photos', 'Delete']);

    const hammer = {
      id: 'item-1',
      name: 'Hammer',
      quantity: 3,
      quantityOut: 1,
      description: '',
      category: '',
      photoId: null,
    };
    fixture.componentRef.setInput('container', { ...container, items: [hammer] });
    fixture.detectChanges();
    expect(labels()).toEqual([
      'Rotate 90°',
      'Add item',
      'Add several photos',
      'Put back Hammer',
      'Used Hammer',
      'Add photo to Hammer',
      'Take out Hammer',
      'Edit Hammer',
      'Delete Hammer',
      'Delete',
    ]);
  });

  describe('rotate', () => {
    it('emits "rotated" when the button is clicked, and saves nothing by itself', async () => {
      const { fixture, element } = await setup();
      const rotated = vi.fn();
      fixture.componentInstance.rotated.subscribe(rotated);
      button(element, 'Rotate 90°')?.click();
      expect(rotated).toHaveBeenCalledTimes(1);
    });

    it('has an empty status area while the rotation is not blocked', async () => {
      const { element } = await setup();
      const status = element.querySelector('.notice');
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.textContent?.trim()).toBe('');
    });

    it('shows "Not enough space to rotate" in the same status area when it is blocked', async () => {
      const { fixture, element } = await setup();
      const statusBefore = element.querySelector('.notice');
      fixture.componentRef.setInput('notice', 'Not enough space to rotate');
      fixture.detectChanges();
      const status = element.querySelector('.notice');
      expect(status).toBe(statusBefore); // the same element, so screen readers announce the change
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.textContent?.trim()).toBe('Not enough space to rotate');

      fixture.componentRef.setInput('notice', '');
      fixture.detectChanges();
      expect(element.querySelector('.notice')?.textContent?.trim()).toBe('');
    });

    it('does not show the current rotation', async () => {
      const { fixture, element } = await setup();
      fixture.componentRef.setInput('container', { ...container, rotation: 90 });
      fixture.detectChanges();
      expect(element.textContent).not.toMatch(/rotation/i);
    });
  });

  describe('stack', () => {
    const below = { ...createContainer(TOUGH_BOX_27_GAL.id, 'Books', 0, 0), stackPosition: 0 };
    const above = { ...container, stackPosition: 1 };

    async function setupStacked() {
      const result = await setup();
      result.fixture.componentRef.setInput('container', above);
      result.fixture.componentRef.setInput('stack', [below, above]);
      result.fixture.detectChanges();
      return result;
    }

    it('does not show the stack list for a container that is alone', async () => {
      const { fixture, element } = await setup();
      expect(element.querySelector('app-container-stack')).toBeNull();
      fixture.componentRef.setInput('stack', [container]);
      fixture.detectChanges();
      expect(element.querySelector('app-container-stack')).toBeNull();
      expect(button(element, 'Move up')).toBeUndefined();
      expect(button(element, 'Remove from stack')).toBeUndefined();
    });

    it('shows the stack list, with the selected container highlighted, when the stack has several', async () => {
      const { element } = await setupStacked();
      expect(element.querySelector('app-container-stack')).not.toBeNull();
      const rows = Array.from(element.querySelectorAll('.level')).map((r) =>
        r.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(rows).toEqual(['▸ Level 2 Toys', 'Level 1 Books']);
      expect(element.querySelector('.level[aria-current="true"]')?.textContent).toContain('Toys');
    });

    it('passes up what the user does in the stack list', async () => {
      const { fixture, element } = await setupStacked();
      const selected = vi.fn();
      const movedUp = vi.fn();
      const movedDown = vi.fn();
      const removed = vi.fn();
      fixture.componentInstance.stackItemSelected.subscribe(selected);
      fixture.componentInstance.movedUp.subscribe(movedUp);
      fixture.componentInstance.movedDown.subscribe(movedDown);
      fixture.componentInstance.removedFromStack.subscribe(removed);

      (element.querySelectorAll('.level')[1] as HTMLButtonElement).click();
      expect(selected).toHaveBeenCalledWith(below.id);
      button(element, 'Move down')?.click();
      expect(movedDown).toHaveBeenCalledTimes(1);
      button(element, 'Remove from stack')?.click();
      expect(removed).toHaveBeenCalledTimes(1);
      button(element, 'Move up')?.click(); // the container is on top: ignored
      expect(movedUp).not.toHaveBeenCalled();
    });

    it('orders the panel: name, stack list, Rotate 90°, messages, items, Delete', async () => {
      const { element } = await setupStacked();
      const parts = [
        element.querySelector('form'),
        element.querySelector('app-container-stack'),
        button(element, 'Rotate 90°'),
        element.querySelector('.notice'),
        element.querySelector('.items'),
        button(element, 'Delete'),
      ] as Element[];
      for (let i = 0; i < parts.length - 1; i++) {
        expect(parts[i].compareDocumentPosition(parts[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it('shows any message in the same status area, also the one for a full room', async () => {
      const { fixture, element } = await setupStacked();
      fixture.componentRef.setInput('notice', 'There is no free space for another container in this room.');
      fixture.detectChanges();
      expect(element.querySelector('.notice')?.textContent?.trim()).toBe(
        'There is no free space for another container in this room.',
      );
    });
  });

  describe('rename', () => {
    it('saves a valid name when the field loses focus, trimmed', async () => {
      const { fixture, element, renamed } = await setup();
      type(element, '  Winter clothes  ');
      expect(renamed).not.toHaveBeenCalled(); // not saved while typing
      input(element).dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      expect(renamed).toHaveBeenCalledTimes(1);
      expect(renamed).toHaveBeenCalledWith('Winter clothes');
    });

    it('saves a valid name when Enter submits the form', async () => {
      const { fixture, element, renamed } = await setup();
      type(element, 'Books');
      element.querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(renamed).toHaveBeenCalledWith('Books');
    });

    it('does not save an empty name and shows an error', async () => {
      const { fixture, element, renamed } = await setup();
      type(element, '   ');
      input(element).dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(renamed).not.toHaveBeenCalled();
      expect(element.querySelector('.field-error')?.textContent).toContain('required');
      expect(input(element).getAttribute('aria-invalid')).toBe('true');
    });

    it('does not save a name that is too long', async () => {
      const { fixture, element, renamed } = await setup();
      type(element, 'a'.repeat(61));
      input(element).dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(renamed).not.toHaveBeenCalled();
      expect(element.querySelector('.field-error')?.textContent).toContain('60');
    });

    it('does not save when the name did not change', async () => {
      const { fixture, element, renamed } = await setup();
      input(element).dispatchEvent(new Event('blur'));
      type(element, '  Toys ');
      input(element).dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      expect(renamed).not.toHaveBeenCalled();
    });

    it('shows the name of another container when the selection changes', async () => {
      const { fixture, element } = await setup();
      const other = createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0);
      fixture.componentRef.setInput('container', other);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(input(element).value).toBe('Books');
    });
  });

  describe('items', () => {
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

    async function setupWithItems(items: Item[]) {
      const result = await setup();
      result.fixture.componentRef.setInput('container', { ...container, items });
      result.fixture.detectChanges();
      const itemAdded = vi.fn();
      result.fixture.componentInstance.itemAdded.subscribe(itemAdded);
      return { ...result, itemAdded };
    }

    function typeIn(element: HTMLElement, id: string, text: string): void {
      const field = element.querySelector(`#${id}`) as HTMLInputElement;
      field.value = text;
      field.dispatchEvent(new Event('input'));
    }

    async function openForm(fixture: ComponentFixture<unknown>, element: HTMLElement) {
      button(element, 'Add item')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('shows "Items (0)", "No items yet." and the "Add item" button for an empty container', async () => {
      const { element } = await setup();
      const section = element.querySelector('.items') as HTMLElement;
      expect(section.querySelector('h3')?.textContent?.trim()).toBe('Items (0)');
      expect(section.getAttribute('aria-labelledby')).toBe(section.querySelector('h3')?.id);
      expect(section.textContent).toContain('No items yet.');
      expect(button(element, 'Add item')).toBeDefined();
      expect(element.querySelector('app-item-form')).toBeNull();
    });

    it('shows the number of items in the title and lists them', async () => {
      const { element } = await setupWithItems([
        item('Nails', { quantity: 100 }),
        item('Cables', { quantity: 0 }),
      ]);
      expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (2)');
      const rows = Array.from(element.querySelectorAll('.item .item-text')).map((row) =>
        row.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(rows).toEqual(['Cables None left', 'Nails Qty 100']);
      expect(element.textContent).not.toContain('No items yet.');
    });

    it('opens the form in place of the "Add item" button', async () => {
      const { fixture, element } = await setup();
      await openForm(fixture, element);
      expect(element.querySelector('app-item-form')).not.toBeNull();
      expect(button(element, 'Add item')).toBeUndefined();
      // The form is inside the items section, before the list.
      const form = element.querySelector('.items app-item-form') as Element;
      const list = element.querySelector('.items app-item-list') as Element;
      expect(form.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('passes the categories in use to the form as suggestions', async () => {
      const { fixture, element } = await setup();
      fixture.componentRef.setInput('categories', ['Hardware', 'Navidad']);
      await openForm(fixture, element);
      const options = Array.from(element.querySelectorAll('datalist option')).map((o) =>
        o.getAttribute('value'),
      );
      expect(options).toEqual(['Hardware', 'Navidad']);
    });

    it('emits "itemAdded" with what the user filled in, saves nothing by itself and keeps the form open', async () => {
      const { fixture, element, itemAdded } = await setupWithItems([]);
      await openForm(fixture, element);
      typeIn(element, 'item-name', 'Nails');
      typeIn(element, 'item-quantity', '100');
      element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(itemAdded).toHaveBeenCalledTimes(1);
      expect(itemAdded).toHaveBeenCalledWith({
        name: 'Nails',
        quantity: 100,
        description: '',
        category: '',
        photoId: null,
      });
      expect(element.querySelector('app-item-form')).not.toBeNull();
      expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (0)');
    });

    it('does not emit "itemAdded" when the form has errors', async () => {
      const { fixture, element, itemAdded } = await setupWithItems([]);
      await openForm(fixture, element);
      element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(itemAdded).not.toHaveBeenCalled();
    });

    it('closes the form with Done and gives the focus back to the "Add item" button', async () => {
      const { fixture, element } = await setup();
      document.body.appendChild(fixture.nativeElement);
      try {
        await openForm(fixture, element);
        button(element, 'Done')?.click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(element.querySelector('app-item-form')).toBeNull();
        expect(button(element, 'Add item')).toBeDefined();
        expect(document.activeElement).toBe(button(element, 'Add item'));
      } finally {
        document.body.replaceChildren();
      }
    });

    it('closes the form with the Escape key', async () => {
      const { fixture, element } = await setup();
      await openForm(fixture, element);
      element
        .querySelector('#item-name')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(element.querySelector('app-item-form')).toBeNull();
    });

    it('closes the form and discards what was typed when another container is selected', async () => {
      const { fixture, element } = await setup();
      await openForm(fixture, element);
      typeIn(element, 'item-name', 'Nails');

      const other = createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0);
      fixture.componentRef.setInput('container', other);
      fixture.detectChanges();
      expect(element.querySelector('app-item-form')).toBeNull();

      await openForm(fixture, element);
      expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('');
    });

    it('keeps the form open, with what was typed, when the same container changes', async () => {
      const { fixture, element } = await setup();
      await openForm(fixture, element);
      typeIn(element, 'item-name', 'Nails');
      fixture.componentRef.setInput('container', { ...container, items: [item('Cables')] });
      fixture.detectChanges();
      expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Nails');
    });

    describe('editing and removing an item', () => {
      const nails = item('Nails', { quantity: 100, category: 'Hardware' });
      const hammer = item('Hammer');
      const cables = item('Cables');

      /** A panel attached to the page (so the focus can be checked) with three items. */
      async function setupAttached(items: Item[] = [nails, hammer, cables]) {
        const result = await setupWithItems(items);
        document.body.appendChild(result.fixture.nativeElement);
        const itemEdited = vi.fn();
        const itemRemoved = vi.fn();
        result.fixture.componentInstance.itemEdited.subscribe(itemEdited);
        result.fixture.componentInstance.itemRemoved.subscribe(itemRemoved);
        return { ...result, itemEdited, itemRemoved };
      }

      afterEach(() => {
        document.body.replaceChildren();
      });

      function iconButton(element: HTMLElement, label: string): HTMLButtonElement {
        return element.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
      }

      async function click(fixture: ComponentFixture<unknown>, target: HTMLElement | undefined) {
        target?.click();
        fixture.detectChanges();
        await fixture.whenStable();
      }

      async function submitEdit(fixture: ComponentFixture<unknown>, element: HTMLElement) {
        element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();
      }

      function itemNotice(element: HTMLElement): string | undefined {
        return element.querySelector('.item-notice')?.textContent?.trim();
      }

      it('has an empty status area for the items, before the list', async () => {
        const { element } = await setupAttached();
        const notice = element.querySelector('.items .item-notice') as HTMLElement;
        expect(notice.getAttribute('role')).toBe('status');
        expect(notice.textContent?.trim()).toBe('');
        const list = element.querySelector('.items app-item-list') as Element;
        expect(notice.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      });

      describe('edit', () => {
        it('opens the form in the row of the item, with its data and the focus on the name', async () => {
          const { fixture, element } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          const row = element.querySelector('.item app-item-form')?.closest('.item') as HTMLElement;
          expect(row.querySelector('h4')?.textContent?.trim()).toBe('Edit item');
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Nails');
          expect((element.querySelector('#item-quantity') as HTMLInputElement).value).toBe('100');
          expect(document.activeElement).toBe(element.querySelector('#item-name'));
          // The "Add item" button stays where it was: the form is in the row, not in its place.
          expect(button(element, 'Add item')).toBeDefined();
          expect(element.querySelectorAll('app-item-form').length).toBe(1);
        });

        it('passes the categories in use to the edit form', async () => {
          const { fixture, element } = await setupAttached();
          fixture.componentRef.setInput('categories', ['Hardware', 'Navidad']);
          await click(fixture, iconButton(element, 'Edit Nails'));
          const options = Array.from(element.querySelectorAll('datalist option')).map((o) =>
            o.getAttribute('value'),
          );
          expect(options).toEqual(['Hardware', 'Navidad']);
        });

        it('emits "itemEdited" with the id and the new values, saves nothing by itself and closes the form', async () => {
          const { fixture, element, itemEdited, itemAdded } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          typeIn(element, 'item-name', '  Screws ');
          typeIn(element, 'item-quantity', '85');
          await submitEdit(fixture, element);
          expect(itemEdited).toHaveBeenCalledTimes(1);
          expect(itemEdited).toHaveBeenCalledWith({
            itemId: nails.id,
            draft: {
              name: 'Screws',
              quantity: 85,
              description: '',
              category: 'Hardware',
              photoId: null,
            },
          });
          expect(itemAdded).not.toHaveBeenCalled();
          expect(element.querySelector('app-item-form')).toBeNull();
          // The panel does not save: the row shows the item it was given.
          expect(iconButton(element, 'Edit Nails')).not.toBeNull();
        });

        it('says "Saved <name>" and gives the focus to the "Edit" button of that row', async () => {
          const { fixture, element } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          await submitEdit(fixture, element);
          expect(itemNotice(element)).toBe('Saved Nails');
          expect(document.activeElement).toBe(iconButton(element, 'Edit Nails'));
        });

        it('gives the focus to the "Edit" button of the row in its new place when the name changed', async () => {
          const { fixture, element, itemEdited } = await setupAttached();
          // The page saves: here the test does it, giving the panel the changed item.
          itemEdited.mockImplementation(({ itemId, draft }) => {
            fixture.componentRef.setInput('container', {
              ...container,
              items: [nails, hammer, cables].map((i) => (i.id === itemId ? { ...i, ...draft } : i)),
            });
          });
          await click(fixture, iconButton(element, 'Edit Nails'));
          typeIn(element, 'item-name', 'Anvil');
          await submitEdit(fixture, element);
          const names = Array.from(element.querySelectorAll('.item-name')).map((n) =>
            n.textContent?.trim(),
          );
          expect(names).toEqual(['Anvil', 'Cables', 'Hammer']);
          expect(itemNotice(element)).toBe('Saved Anvil');
          expect(document.activeElement).toBe(iconButton(element, 'Edit Anvil'));
        });

        it('does not emit and keeps the form open when it has errors', async () => {
          const { fixture, element, itemEdited } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          typeIn(element, 'item-name', '   ');
          await submitEdit(fixture, element);
          expect(itemEdited).not.toHaveBeenCalled();
          expect(element.querySelector('app-item-form')).not.toBeNull();
          expect(itemNotice(element)).toBe('');
        });

        it('closes with Cancel, without saving, and gives the focus back to "Edit"', async () => {
          const { fixture, element, itemEdited } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          typeIn(element, 'item-name', 'Screws');
          await click(fixture, button(element, 'Cancel'));
          expect(itemEdited).not.toHaveBeenCalled();
          expect(element.querySelector('app-item-form')).toBeNull();
          expect(itemNotice(element)).toBe('');
          expect(document.activeElement).toBe(iconButton(element, 'Edit Nails'));
        });

        it('closes with the Escape key and gives the focus back to "Edit"', async () => {
          const { fixture, element, itemEdited } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          element
            .querySelector('#item-name')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          fixture.detectChanges();
          await fixture.whenStable();
          expect(itemEdited).not.toHaveBeenCalled();
          expect(element.querySelector('app-item-form')).toBeNull();
          expect(document.activeElement).toBe(iconButton(element, 'Edit Nails'));
        });

        it('keeps the form open, with what was typed, when the same container changes', async () => {
          const { fixture, element } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          typeIn(element, 'item-name', 'Screws');
          fixture.componentRef.setInput('container', {
            ...container,
            name: 'Workshop',
            items: [nails, hammer, cables],
          });
          fixture.detectChanges();
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Screws');
        });
      });

      describe('remove', () => {
        it('does not remove on the first click: it asks inline, with the focus on "Cancel"', async () => {
          const { fixture, element, itemRemoved } = await setupAttached();
          await click(fixture, iconButton(element, 'Delete Nails'));
          expect(itemRemoved).not.toHaveBeenCalled();
          const confirm = element.querySelector('.item .confirm') as HTMLElement;
          expect(confirm.getAttribute('role')).toBe('alert');
          expect(confirm.querySelector('span')?.textContent?.trim()).toBe(
            'Delete "Nails"? This cannot be undone.',
          );
          expect(document.activeElement).toBe(element.querySelector('.item-cancel-delete'));
          expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
        });

        it('emits "itemRemoved" with the id after "Yes, delete", and says "Deleted <name>"', async () => {
          const { fixture, element, itemRemoved } = await setupAttached();
          await click(fixture, iconButton(element, 'Delete Nails'));
          await click(fixture, element.querySelector('.item-confirm-delete') as HTMLButtonElement);
          expect(itemRemoved).toHaveBeenCalledTimes(1);
          expect(itemRemoved).toHaveBeenCalledWith(nails.id);
          expect(element.querySelector('.item .confirm')).toBeNull();
          expect(itemNotice(element)).toBe('Deleted Nails');
        });

        it('cancels with Cancel or Escape, without removing, and gives the focus back to "Delete"', async () => {
          const { fixture, element, itemRemoved } = await setupAttached();
          await click(fixture, iconButton(element, 'Delete Nails'));
          await click(fixture, element.querySelector('.item-cancel-delete') as HTMLButtonElement);
          expect(element.querySelector('.item .confirm')).toBeNull();
          expect(document.activeElement).toBe(iconButton(element, 'Delete Nails'));

          await click(fixture, iconButton(element, 'Delete Nails'));
          element
            .querySelector('.item-cancel-delete')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          fixture.detectChanges();
          await fixture.whenStable();
          expect(element.querySelector('.item .confirm')).toBeNull();
          expect(document.activeElement).toBe(iconButton(element, 'Delete Nails'));
          expect(itemRemoved).not.toHaveBeenCalled();
          expect(itemNotice(element)).toBe('');
        });

        describe('focus after removing', () => {
          /** Removes the item with this name; the test plays the page and takes it out of the list. */
          async function remove(name: string, items: Item[]) {
            const result = await setupAttached(items);
            result.itemRemoved.mockImplementation((itemId: string) => {
              result.fixture.componentRef.setInput('container', {
                ...container,
                items: items.filter((i) => i.id !== itemId),
              });
            });
            await click(result.fixture, iconButton(result.element, `Delete ${name}`));
            await click(
              result.fixture,
              result.element.querySelector('.item-confirm-delete') as HTMLButtonElement,
            );
            return result;
          }

          // The rows are shown as Cables, Hammer, Nails.
          it('goes to the "Edit" button of the next row', async () => {
            const { element } = await remove('Cables', [nails, hammer, cables]);
            expect(document.activeElement).toBe(iconButton(element, 'Edit Hammer'));
            expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (2)');
          });

          it('goes to the "Edit" button of the row before when the last row is removed', async () => {
            const { element } = await remove('Nails', [nails, hammer, cables]);
            expect(document.activeElement).toBe(iconButton(element, 'Edit Hammer'));
          });

          it('goes to the "Add item" button when the list is left empty', async () => {
            const { element } = await remove('Nails', [nails]);
            expect(element.textContent).toContain('No items yet.');
            expect(document.activeElement).toBe(button(element, 'Add item'));
          });
        });
      });

      describe('only one thing open at a time', () => {
        function open(element: HTMLElement) {
          return {
            addForm: element.querySelector('.items > app-item-form') !== null,
            editForm: element.querySelector('.item app-item-form') !== null,
            itemConfirm: element.querySelector('.item .confirm') !== null,
          };
        }

        it('"Edit" on another row closes the first edit form and discards what was typed', async () => {
          const { fixture, element, itemEdited } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          typeIn(element, 'item-name', 'Typed');
          await click(fixture, iconButton(element, 'Edit Hammer'));
          expect(element.querySelectorAll('app-item-form').length).toBe(1);
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Hammer');
          expect(itemEdited).not.toHaveBeenCalled();

          await click(fixture, iconButton(element, 'Edit Nails'));
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Nails');
        });

        it('"Delete" on a row closes the edit form of another row', async () => {
          const { fixture, element } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          await click(fixture, iconButton(element, 'Delete Hammer'));
          expect(open(element)).toEqual({ addForm: false, editForm: false, itemConfirm: true });
        });

        it('"Edit" on a row closes the delete confirmation of another row', async () => {
          const { fixture, element, itemRemoved } = await setupAttached();
          await click(fixture, iconButton(element, 'Delete Hammer'));
          await click(fixture, iconButton(element, 'Edit Nails'));
          expect(open(element)).toEqual({ addForm: false, editForm: true, itemConfirm: false });
          expect(itemRemoved).not.toHaveBeenCalled();
        });

        it('"Delete" on another row moves the confirmation to that row', async () => {
          const { fixture, element } = await setupAttached();
          await click(fixture, iconButton(element, 'Delete Hammer'));
          await click(fixture, iconButton(element, 'Delete Nails'));
          expect(element.querySelectorAll('.item .confirm').length).toBe(1);
          expect(element.querySelector('.item .confirm span')?.textContent).toContain('"Nails"');
        });

        it('"Add item" closes an edit form or a delete confirmation', async () => {
          const { fixture, element } = await setupAttached();
          await click(fixture, iconButton(element, 'Edit Nails'));
          await click(fixture, button(element, 'Add item'));
          expect(open(element)).toEqual({ addForm: true, editForm: false, itemConfirm: false });
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('');

          await click(fixture, button(element, 'Done'));
          await click(fixture, iconButton(element, 'Delete Nails'));
          await click(fixture, button(element, 'Add item'));
          expect(open(element)).toEqual({ addForm: true, editForm: false, itemConfirm: false });
        });

        it('"Edit" or "Delete" on a row closes the "Add item" form and discards what was typed', async () => {
          const { fixture, element, itemAdded } = await setupAttached();
          await click(fixture, button(element, 'Add item'));
          typeIn(element, 'item-name', 'Typed');
          await click(fixture, iconButton(element, 'Edit Nails'));
          expect(open(element)).toEqual({ addForm: false, editForm: true, itemConfirm: false });
          expect(button(element, 'Add item')).toBeDefined();

          await click(fixture, button(element, 'Add item'));
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('');
          await click(fixture, iconButton(element, 'Delete Nails'));
          expect(open(element)).toEqual({ addForm: false, editForm: false, itemConfirm: true });
          expect(itemAdded).not.toHaveBeenCalled();
        });

        it('closes the edit form or the confirmation, and discards what was typed, when another container is selected', async () => {
          const { fixture, element } = await setupAttached();
          const other = { ...createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0), items: [nails] };

          await click(fixture, iconButton(element, 'Edit Nails'));
          typeIn(element, 'item-name', 'Typed');
          fixture.componentRef.setInput('container', other);
          fixture.detectChanges();
          expect(open(element)).toEqual({ addForm: false, editForm: false, itemConfirm: false });

          await click(fixture, iconButton(element, 'Delete Nails'));
          fixture.componentRef.setInput('container', { ...container, items: [nails] });
          fixture.detectChanges();
          expect(open(element)).toEqual({ addForm: false, editForm: false, itemConfirm: false });
        });
      });

      describe('the message', () => {
        async function saved() {
          const result = await setupAttached();
          await click(result.fixture, iconButton(result.element, 'Edit Nails'));
          await submitEdit(result.fixture, result.element);
          expect(itemNotice(result.element)).toBe('Saved Nails');
          return result;
        }

        it('stays in the same element, so screen readers announce the change', async () => {
          const result = await setupAttached();
          const before = result.element.querySelector('.item-notice');
          await click(result.fixture, iconButton(result.element, 'Edit Nails'));
          await submitEdit(result.fixture, result.element);
          expect(result.element.querySelector('.item-notice')).toBe(before);
        });

        it('is cleared when another edit, a delete or "Add item" starts', async () => {
          for (const start of ['Edit Hammer', 'Delete Hammer']) {
            const { fixture, element } = await saved();
            await click(fixture, iconButton(element, start));
            expect(itemNotice(element)).toBe('');
            document.body.replaceChildren();
          }
          const { fixture, element } = await saved();
          await click(fixture, button(element, 'Add item'));
          expect(itemNotice(element)).toBe('');
        });

        it('is cleared when another container is selected', async () => {
          const { fixture, element } = await saved();
          fixture.componentRef.setInput(
            'container',
            createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
          );
          fixture.detectChanges();
          expect(itemNotice(element)).toBe('');
        });
      });

      describe('take out, put back and used', () => {
        /** "Screws": 100 units, 20 of them out (80 inside). */
        const screws = item('Screws', { quantity: 100, quantityOut: 20 });

        /**
         * A panel with one item (and "Hammer", all inside). The test plays the page: it applies
         * each change the panel emits and gives the panel the changed item.
         */
        async function setupUnits(target: Item = screws) {
          const items = [target, hammer];
          const result = await setupAttached(items);
          const changed = vi.fn(({ itemId, action, units }: ItemUnitsChanged) => {
            const apply = {
              'take-out': takeOut,
              'put-back': putBack,
              'used-from-out': markUsedFromOut,
              'used-from-inside': markUsedFromInside,
            }[action];
            const current = result.fixture.componentInstance.container().items;
            result.fixture.componentRef.setInput('container', {
              ...container,
              items: current.map((i) => (i.id === itemId ? (apply(i, units) ?? i) : i)),
            });
          });
          result.fixture.componentInstance.itemUnitsChanged.subscribe(changed);
          return { ...result, changed };
        }

        function control(element: HTMLElement, label: string): HTMLButtonElement {
          return iconButton(element, label);
        }

        /** The quantity text of the row of "Screws" ("Hammer" is the first row). */
        function screwsQuantity(element: HTMLElement): string | undefined {
          const row = control(element, 'Edit Screws').closest('.item');
          return row?.querySelector('.item-quantity')?.textContent?.trim();
        }

        /** Opens a form from its button, types the units and presses a button of the form. */
        async function run(
          fixture: ComponentFixture<unknown>,
          element: HTMLElement,
          open: string,
          units: string,
          press: string,
        ) {
          await click(fixture, control(element, open));
          typeIn(element, 'item-units', units);
          const pressed = Array.from(element.querySelectorAll('app-item-units-form button')).find(
            (b) => b.textContent?.trim() === press,
          ) as HTMLButtonElement;
          pressed.click();
          await fixture.whenStable();
          fixture.detectChanges();
          await fixture.whenStable();
        }

        it('opens the form in the row, with the focus on the quantity, and changes nothing yet', async () => {
          const { fixture, element, changed } = await setupUnits();
          await click(fixture, control(element, 'Take out Screws'));
          const form = element.querySelector('.item app-item-units-form') as HTMLElement;
          expect(form.querySelector('h4')?.textContent?.trim()).toBe('Take out or use Screws');
          expect((element.querySelector('#item-units') as HTMLInputElement).value).toBe('80');
          expect(document.activeElement).toBe(element.querySelector('#item-units'));
          expect(changed).not.toHaveBeenCalled();
        });

        it('emits "itemUnitsChanged" with the id, the action and the units, and saves nothing by itself', async () => {
          const result = await setupAttached([screws]);
          const changed = vi.fn();
          result.fixture.componentInstance.itemUnitsChanged.subscribe(changed);
          await run(result.fixture, result.element, 'Take out Screws', '30', 'Take out');
          expect(changed).toHaveBeenCalledTimes(1);
          expect(changed).toHaveBeenCalledWith({ itemId: screws.id, action: 'take-out', units: 30 });
          expect(result.element.querySelector('app-item-units-form')).toBeNull();
          // The panel does not save: the row shows the item it was given.
          expect(result.element.querySelector('.item-out')?.textContent?.trim()).toBe('20 of 100 out');
        });

        it('emits each of the four actions', async () => {
          const cases = [
            ['Take out Screws', 'Take out', 'take-out'],
            ['Take out Screws', 'Mark as used', 'used-from-inside'],
            ['Put back Screws', 'Put back', 'put-back'],
            ['Used Screws', 'Used', 'used-from-out'],
          ];
          for (const [open, press, action] of cases) {
            const { fixture, element, changed } = await setupUnits();
            await run(fixture, element, open, '5', press);
            expect(changed).toHaveBeenCalledWith({ itemId: screws.id, action, units: 5 });
            document.body.replaceChildren();
          }
        });

        it('says what was done in the status area', async () => {
          const cases = [
            ['Take out Screws', '20', 'Take out', 'Took out 20 of Screws'],
            ['Take out Screws', '15', 'Mark as used', 'Marked 15 of Screws as used'],
            ['Put back Screws', '5', 'Put back', 'Put back 5 of Screws'],
            ['Used Screws', '15', 'Used', 'Marked 15 of Screws as used'],
          ];
          for (const [open, units, press, message] of cases) {
            const { fixture, element } = await setupUnits();
            const notice = element.querySelector('.item-notice');
            await run(fixture, element, open, units, press);
            expect(itemNotice(element)).toBe(message);
            expect(element.querySelector('.item-notice')).toBe(notice);
            document.body.replaceChildren();
          }
        });

        it('does nothing and keeps the form open when the quantity is wrong', async () => {
          const { fixture, element, changed } = await setupUnits();
          await run(fixture, element, 'Take out Screws', '81', 'Take out');
          expect(changed).not.toHaveBeenCalled();
          expect(element.querySelector('app-item-units-form .field-error')?.textContent?.trim()).toBe(
            'Quantity must be a whole number from 1 to 80.',
          );
          expect(itemNotice(element)).toBe('');
        });

        describe('focus after the action', () => {
          it('take out with units left inside: back to "Take out"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Take out Screws', '30', 'Take out');
            expect(element.querySelector('.item-out')?.textContent?.trim()).toBe('50 of 100 out');
            expect(document.activeElement).toBe(control(element, 'Take out Screws'));
          });

          it('take out of all the units inside: "Take out" is gone, so to "Put back"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Take out Screws', '80', 'Take out');
            expect(control(element, 'Take out Screws')).toBeNull();
            expect(document.activeElement).toBe(control(element, 'Put back Screws'));
          });

          it('mark as used with units left inside: back to "Take out"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Take out Screws', '15', 'Mark as used');
            expect(screwsQuantity(element)).toBe('Qty 85');
            expect(document.activeElement).toBe(control(element, 'Take out Screws'));
          });

          it('mark as used of all the units inside, with units out: to "Put back"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Take out Screws', '80', 'Mark as used');
            expect(element.querySelector('.item-out')?.textContent?.trim()).toBe('20 of 20 out');
            expect(document.activeElement).toBe(control(element, 'Put back Screws'));
          });

          it('mark as used of the last units of the item: to "Edit"', async () => {
            const { fixture, element } = await setupUnits(item('Screws', { quantity: 3 }));
            await run(fixture, element, 'Take out Screws', '3', 'Mark as used');
            expect(screwsQuantity(element)).toBe('None left');
            expect(document.activeElement).toBe(control(element, 'Edit Screws'));
          });

          it('put back with units still out: back to "Put back"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Put back Screws', '5', 'Put back');
            expect(document.activeElement).toBe(control(element, 'Put back Screws'));
          });

          it('put back of all the units out: "Put back" is gone, so to "Take out"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Put back Screws', '20', 'Put back');
            expect(control(element, 'Put back Screws')).toBeNull();
            expect(element.querySelector('.item-out')).toBeNull();
            expect(document.activeElement).toBe(control(element, 'Take out Screws'));
          });

          it('used with units still out: back to "Used"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Used Screws', '15', 'Used');
            expect(element.querySelector('.item-out')?.textContent?.trim()).toBe('5 of 85 out');
            expect(document.activeElement).toBe(control(element, 'Used Screws'));
          });

          it('used of all the units out, with units inside: to "Take out"', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Used Screws', '20', 'Used');
            expect(document.activeElement).toBe(control(element, 'Take out Screws'));
          });

          it('used of the last units of the item: to "Edit"', async () => {
            const { fixture, element } = await setupUnits(
              item('Screws', { quantity: 4, quantityOut: 4 }),
            );
            await run(fixture, element, 'Used Screws', '4', 'Used');
            expect(screwsQuantity(element)).toBe('None left');
            expect(document.activeElement).toBe(control(element, 'Edit Screws'));
          });
        });

        describe('cancel', () => {
          it('closes with Cancel or Escape, changes nothing, and gives the focus back to the button that opened it', async () => {
            for (const open of ['Take out Screws', 'Put back Screws', 'Used Screws']) {
              const { fixture, element, changed } = await setupUnits();
              await click(fixture, control(element, open));
              typeIn(element, 'item-units', '7');
              await click(fixture, button(element, 'Cancel'));
              expect(element.querySelector('app-item-units-form')).toBeNull();
              expect(document.activeElement).toBe(control(element, open));

              await click(fixture, control(element, open));
              element
                .querySelector('#item-units')
                ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              fixture.detectChanges();
              await fixture.whenStable();
              expect(element.querySelector('app-item-units-form')).toBeNull();
              expect(document.activeElement).toBe(control(element, open));
              expect(changed).not.toHaveBeenCalled();
              expect(itemNotice(element)).toBe('');
              document.body.replaceChildren();
            }
          });
        });

        describe('only one thing open at a time', () => {
          function open(element: HTMLElement) {
            return {
              addForm: element.querySelector('.items > app-item-form') !== null,
              editForm: element.querySelector('.item app-item-form') !== null,
              itemConfirm: element.querySelector('.item .confirm') !== null,
              unitsForm: element.querySelectorAll('app-item-units-form').length,
            };
          }
          const onlyUnits = { addForm: false, editForm: false, itemConfirm: false, unitsForm: 1 };

          it('another units form replaces the first and discards what was typed', async () => {
            const { fixture, element, changed } = await setupUnits();
            await click(fixture, control(element, 'Take out Screws'));
            typeIn(element, 'item-units', '7');
            await click(fixture, control(element, 'Take out Hammer'));
            expect(open(element)).toEqual(onlyUnits);
            expect(element.querySelector('app-item-units-form h4')?.textContent?.trim()).toBe(
              'Take out or use Hammer',
            );
            await click(fixture, control(element, 'Put back Screws'));
            expect(open(element)).toEqual(onlyUnits);
            expect((element.querySelector('#item-units') as HTMLInputElement).value).toBe('20');
            expect(changed).not.toHaveBeenCalled();
          });

          it('a units form closes the "Add item" form, an edit form and a delete confirmation', async () => {
            const { fixture, element } = await setupUnits();
            await click(fixture, button(element, 'Add item'));
            await click(fixture, control(element, 'Take out Screws'));
            expect(open(element)).toEqual(onlyUnits);

            await click(fixture, control(element, 'Edit Hammer'));
            await click(fixture, control(element, 'Used Screws'));
            expect(open(element)).toEqual(onlyUnits);

            await click(fixture, control(element, 'Delete Hammer'));
            await click(fixture, control(element, 'Put back Screws'));
            expect(open(element)).toEqual(onlyUnits);
          });

          it('"Add item", "Edit" and "Delete" close a units form', async () => {
            const { fixture, element, changed } = await setupUnits();
            const none = { addForm: false, editForm: false, itemConfirm: false, unitsForm: 0 };

            await click(fixture, control(element, 'Take out Screws'));
            await click(fixture, button(element, 'Add item'));
            expect(open(element)).toEqual({ ...none, addForm: true });

            await click(fixture, control(element, 'Take out Screws'));
            await click(fixture, control(element, 'Edit Hammer'));
            expect(open(element)).toEqual({ ...none, editForm: true });

            await click(fixture, control(element, 'Take out Screws'));
            await click(fixture, control(element, 'Delete Hammer'));
            expect(open(element)).toEqual({ ...none, itemConfirm: true });
            expect(changed).not.toHaveBeenCalled();
          });

          it('closes the units form when another container is selected', async () => {
            const { fixture, element } = await setupUnits();
            await click(fixture, control(element, 'Take out Screws'));
            fixture.componentRef.setInput('container', {
              ...createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
              items: [screws],
            });
            fixture.detectChanges();
            expect(element.querySelector('app-item-units-form')).toBeNull();
          });

          it('starting a units form clears the last message', async () => {
            const { fixture, element } = await setupUnits();
            await run(fixture, element, 'Put back Screws', '5', 'Put back');
            expect(itemNotice(element)).toBe('Put back 5 of Screws');
            await click(fixture, control(element, 'Used Screws'));
            expect(itemNotice(element)).toBe('');
          });
        });

        it('the delete confirmation says that units are out', async () => {
          const { fixture, element } = await setupUnits();
          await click(fixture, control(element, 'Delete Screws'));
          expect(element.querySelector('.item .confirm span')?.textContent?.trim()).toBe(
            'Delete "Screws"? 20 of 100 are out of the container. This cannot be undone.',
          );
        });
      });

      describe('photos', () => {
        const withPhoto = item('Hammer', { photoId: 'p-hammer' });
        let photos: FakePhotoStore;
        let urls: ObjectUrls;

        beforeEach(() => {
          photos = new FakePhotoStore();
          photos.add('p-hammer');
          urls = stubObjectUrls();
          TestBed.configureTestingModule({
            providers: [
              { provide: PhotoStore, useValue: photos },
              { provide: PhotoProcessor, useValue: { process: async () => fakePhoto('chosen') } },
            ],
          });
        });

        afterEach(() => {
          urls.restore();
        });

        /** A panel with "Hammer" (with a photo) and "Nails" (without), and its photos loaded. */
        async function setupPhotos() {
          const result = await setupAttached([nails, withPhoto]);
          await settle();
          result.fixture.detectChanges();
          return result;
        }

        async function choosePhoto(fixture: ComponentFixture<unknown>, element: HTMLElement) {
          // The file field of the photo field of the item form, not the one of "Add several photos".
          const input = element.querySelector('app-item-form input[type="file"]') as HTMLInputElement;
          const file = new File(['pixels'], 'nails.jpg', { type: 'image/jpeg' });
          Object.defineProperty(input, 'files', { value: [file], configurable: true });
          input.dispatchEvent(new Event('change'));
          await settle();
          fixture.detectChanges();
          await fixture.whenStable();
        }

        describe('"Add photo" of a row', () => {
          it('opens the edit form of that item, with the focus on its photo field', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Add photo to Nails'));
            const form = element.querySelector('.item app-item-form') as HTMLElement;
            expect(form.querySelector('h4')?.textContent?.trim()).toBe('Edit item');
            expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Nails');
            expect(document.activeElement).toBe(form.querySelector('.photo-add'));
          });

          it('does not open the file picker by itself, and saves nothing', async () => {
            const { fixture, element, itemEdited } = await setupPhotos();
            const picker = vi.spyOn(HTMLInputElement.prototype, 'click');
            try {
              await click(fixture, iconButton(element, 'Add photo to Nails'));
              expect(picker).not.toHaveBeenCalled();
            } finally {
              picker.mockRestore();
            }
            expect(itemEdited).not.toHaveBeenCalled();
            expect(photos.saved.size).toBe(1);
          });

          it('gives the focus back to "Add photo" of the row with Cancel or Escape', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Add photo to Nails'));
            await click(fixture, button(element, 'Cancel'));
            expect(element.querySelector('app-item-form')).toBeNull();
            expect(document.activeElement).toBe(iconButton(element, 'Add photo to Nails'));

            await click(fixture, iconButton(element, 'Add photo to Nails'));
            element
              .querySelector('#item-name')
              ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(document.activeElement).toBe(iconButton(element, 'Add photo to Nails'));
          });

          it('still gives the focus back to "Edit" when the form was opened with "Edit"', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Edit Nails'));
            expect(document.activeElement).toBe(element.querySelector('#item-name'));
            await click(fixture, button(element, 'Cancel'));
            expect(document.activeElement).toBe(iconButton(element, 'Edit Nails'));
          });

          it('emits "itemEdited" with the id of the saved photo, and the focus goes to "Edit"', async () => {
            const { fixture, element, itemEdited } = await setupPhotos();
            itemEdited.mockImplementation(({ itemId, draft }: ItemEdited) => {
              fixture.componentRef.setInput('container', {
                ...container,
                items: [nails, withPhoto].map((i) => (i.id === itemId ? { ...i, ...draft } : i)),
              });
            });
            await click(fixture, iconButton(element, 'Add photo to Nails'));
            await choosePhoto(fixture, element);
            element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
            await settle();
            fixture.detectChanges();
            await fixture.whenStable();
            await settle();
            fixture.detectChanges();

            expect(itemEdited).toHaveBeenCalledTimes(1);
            expect(itemEdited.mock.calls[0][0]).toEqual({
              itemId: nails.id,
              draft: {
                name: 'Nails',
                quantity: 100,
                description: '',
                category: 'Hardware',
                photoId: 'photo-1',
              },
            });
            expect(itemNotice(element)).toBe('Saved Nails');
            // The row has a photo now: "Add photo" is gone and the thumbnail is there.
            expect(iconButton(element, 'Add photo to Nails')).toBeNull();
            expect(iconButton(element, 'View photo of Nails')).not.toBeNull();
            expect(document.activeElement).toBe(iconButton(element, 'Edit Nails'));
          });

          it('keeps the form open, and emits nothing, when the photo cannot be saved', async () => {
            photos.failSave = true;
            const { fixture, element, itemEdited } = await setupPhotos();
            await click(fixture, iconButton(element, 'Add photo to Nails'));
            await choosePhoto(fixture, element);
            element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
            await settle();
            fixture.detectChanges();
            expect(itemEdited).not.toHaveBeenCalled();
            expect(element.querySelector('app-item-form .field-error')?.textContent?.trim()).toBe(
              "Couldn't save the photo.",
            );
            expect(itemNotice(element)).toBe('');
          });

          it('follows "one thing at a time": it closes what was open, and is closed by the next', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Delete Hammer'));
            await click(fixture, iconButton(element, 'Add photo to Nails'));
            expect(element.querySelector('.item .confirm')).toBeNull();
            expect(element.querySelectorAll('app-item-form').length).toBe(1);

            await click(fixture, iconButton(element, 'Take out Hammer'));
            expect(element.querySelector('app-item-form')).toBeNull();
            expect(element.querySelectorAll('app-item-units-form').length).toBe(1);
          });
        });

        describe('"Add photo" of a row on a touch screen', () => {
          beforeEach(() => {
            TestBed.configureTestingModule({
              providers: [{ provide: TouchScreen, useValue: { coarse: signal(true) } }],
            });
          });

          function fieldButtons(element: HTMLElement): (string | undefined)[] {
            return Array.from(element.querySelectorAll('app-item-form [role="group"] button')).map(
              (b) => b.textContent?.trim(),
            );
          }

          it('opens the form with "Take photo" next to "Add photo", and the focus on "Add photo"', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Add photo to Nails'));
            expect(fieldButtons(element)).toEqual(['Add photo', 'Take photo']);
            expect(document.activeElement).toBe(element.querySelector('app-item-form .photo-add'));
          });

          it('still gives the focus back to "Add photo" of the row with Cancel', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Add photo to Nails'));
            await click(fixture, button(element, 'Cancel'));
            expect(document.activeElement).toBe(iconButton(element, 'Add photo to Nails'));
          });

          it('shows "Replace", "Take photo" and "Remove" in the form of an item with a photo', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Edit Hammer'));
            await settle();
            fixture.detectChanges();
            expect(fieldButtons(element)).toEqual(['Replace', 'Take photo', 'Remove']);
          });
        });

        describe('the photo window', () => {
          it('is not in the page until a thumbnail is pressed', async () => {
            const { element } = await setupPhotos();
            expect(element.querySelector('app-photo-viewer')).toBeNull();
          });

          it('opens with the full photo and the name of the item', async () => {
            const load = vi.spyOn(photos, 'load');
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'View photo of Hammer'));
            await settle();
            fixture.detectChanges();
            const viewer = element.querySelector('app-photo-viewer') as HTMLElement;
            expect(viewer.querySelector('h2')?.textContent?.trim()).toBe('Hammer');
            expect(viewer.querySelector('img')?.getAttribute('alt')).toBe('Photo of Hammer');
            expect(load).toHaveBeenCalledWith('p-hammer', 'full');
            expect(document.activeElement?.textContent?.trim()).toBe('Close');
          });

          it('closes with "Close" and gives the focus back to the thumbnail', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'View photo of Hammer'));
            const close = element.querySelector('app-photo-viewer button') as HTMLButtonElement;
            close.click();
            await settle();
            fixture.detectChanges();
            await fixture.whenStable();
            expect(element.querySelector('app-photo-viewer')).toBeNull();
            expect(document.activeElement).toBe(iconButton(element, 'View photo of Hammer'));
          });

          it('closes when the browser closes the dialog (the Escape key), with the same focus', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'View photo of Hammer'));
            element.querySelector('app-photo-viewer dialog')?.dispatchEvent(new Event('close'));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(element.querySelector('app-photo-viewer')).toBeNull();
            expect(document.activeElement).toBe(iconButton(element, 'View photo of Hammer'));
          });

          it('revokes the address of the full photo when it closes', async () => {
            const { fixture, element } = await setupPhotos();
            const before = urls.alive().length; // the thumbnail of the row
            await click(fixture, iconButton(element, 'View photo of Hammer'));
            await settle();
            fixture.detectChanges();
            expect(urls.alive().length).toBe(before + 1);
            element.querySelector('app-photo-viewer dialog')?.dispatchEvent(new Event('close'));
            fixture.detectChanges();
            expect(urls.alive().length).toBe(before);
          });

          it('is not one of the item actions: it does not close a form or discard what was typed', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, button(element, 'Add item'));
            typeIn(element, 'item-name', 'Typed');
            await click(fixture, iconButton(element, 'View photo of Hammer'));
            expect(element.querySelector('app-photo-viewer')).not.toBeNull();
            expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Typed');

            element.querySelector('app-photo-viewer dialog')?.dispatchEvent(new Event('close'));
            fixture.detectChanges();
            expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Typed');
          });

          it('does not clear the last message', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'Delete Nails'));
            await click(fixture, element.querySelector('.item-confirm-delete') as HTMLButtonElement);
            expect(itemNotice(element)).toBe('Deleted Nails');
            await click(fixture, iconButton(element, 'View photo of Hammer'));
            expect(itemNotice(element)).toBe('Deleted Nails');
          });

          it('closes when another container is selected', async () => {
            const { fixture, element } = await setupPhotos();
            await click(fixture, iconButton(element, 'View photo of Hammer'));
            fixture.componentRef.setInput(
              'container',
              createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
            );
            fixture.detectChanges();
            expect(element.querySelector('app-photo-viewer')).toBeNull();
          });
        });
      });

      it('never uses window.confirm to remove an item', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        const { fixture, element } = await setupAttached();
        await click(fixture, iconButton(element, 'Delete Nails'));
        await click(fixture, element.querySelector('.item-confirm-delete') as HTMLButtonElement);
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
      });
    });

    describe('add several photos', () => {
      /** The fake batch: it reports its first photo and ends only when the test says so. */
      let run: ReturnType<typeof vi.fn>;
      let finish: (result: BatchResult) => void;
      let options: BatchRunOptions;

      beforeEach(() => {
        run = vi.fn((chosen: File[], _containerId: string, runOptions: BatchRunOptions) => {
          options = runOptions;
          runOptions.onProgress(1, chosen.length);
          return new Promise<BatchResult>((resolve) => (finish = resolve));
        });
        TestBed.configureTestingModule({
          providers: [{ provide: ItemPhotoBatch, useValue: { run } }],
        });
      });

      afterEach(() => {
        document.body.replaceChildren();
      });

      const photoFile = (name: string) => new File(['pixels'], name, { type: 'image/jpeg' });

      function ended(added: number, chosen: number, failures: BatchResult['failures'] = []): BatchResult {
        return { added, chosen, failures, stopped: false };
      }

      /** A panel attached to the page, so the focus can be checked. */
      async function setupBatch(items: Item[] = []) {
        const result = await setupWithItems(items);
        document.body.appendChild(result.fixture.nativeElement);
        return result;
      }

      function batchButton(element: HTMLElement): HTMLButtonElement {
        return button(element, 'Add several photos') as HTMLButtonElement;
      }

      function batchInput(element: HTMLElement): HTMLInputElement {
        return element.querySelector('input[multiple]') as HTMLInputElement;
      }

      /** What the browser does after the user picks files: it fills the field and fires "change". */
      async function pick(
        fixture: ComponentFixture<unknown>,
        element: HTMLElement,
        names: string[],
      ) {
        const input = batchInput(element);
        Object.defineProperty(input, 'files', { value: names.map(photoFile), configurable: true });
        input.dispatchEvent(new Event('change'));
        await settle();
        fixture.detectChanges();
        await fixture.whenStable();
      }

      /** The text of the status line, without the list of failed files. */
      function status(element: HTMLElement): string {
        const line = element.querySelector('.item-notice') as HTMLElement;
        return Array.from(line.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join('')
          .trim();
      }

      function failures(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('.item-notice .batch-failures li')).map(
          (li) => li.textContent?.trim() ?? '',
        );
      }

      async function finishWith(
        fixture: ComponentFixture<unknown>,
        result: BatchResult,
      ): Promise<void> {
        finish(result);
        await settle();
        fixture.detectChanges();
        await fixture.whenStable();
      }

      describe('the button and its field', () => {
        it('is next to "Add item", and its name is its visible text', async () => {
          const { element } = await setupBatch();
          const labels = Array.from(element.querySelectorAll('.items .actions button')).map((b) =>
            b.textContent?.trim(),
          );
          expect(labels).toEqual(['Add item', 'Add several photos']);
          expect(batchButton(element).type).toBe('button');
          expect(batchButton(element).hasAttribute('aria-label')).toBe(false);
          expect(batchButton(element).hasAttribute('aria-disabled')).toBe(false);
        });

        it('has a hidden file field for several images, without "capture"', async () => {
          const { element } = await setupBatch();
          const input = batchInput(element);
          expect(input.type).toBe('file');
          expect(input.getAttribute('accept')).toBe('image/*');
          expect(input.multiple).toBe(true);
          // With "capture" the browser would only take one photo.
          expect(input.hasAttribute('capture')).toBe(false);
          expect(input.hidden).toBe(true);
          expect(input.getAttribute('tabindex')).toBe('-1');
          expect(input.getAttribute('aria-hidden')).toBe('true');
        });

        describe('the hint', () => {
          function hint(element: HTMLElement): HTMLElement | null {
            return element.querySelector('.items .batch-hint');
          }

          it('is shown under the buttons, before the status line, as plain text', async () => {
            const { element } = await setupBatch();
            const text = hint(element) as HTMLElement;
            expect(text.tagName).toBe('P');
            expect(text.textContent?.trim()).toBe('Up to 20 photos at a time.');
            expect(text.hasAttribute('role')).toBe(false);
            const buttons = element.querySelector('.items .actions') as Element;
            const line = element.querySelector('.item-notice') as Element;
            expect(
              buttons.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
            expect(
              text.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
          });

          it('takes the number from the limit of the batch', async () => {
            const { element } = await setupBatch();
            expect(hint(element)?.textContent?.trim()).toBe(
              `Up to ${PHOTO_BATCH_MAX} photos at a time.`,
            );
          });

          it('is linked to the "Add several photos" button, which keeps its name and its text', async () => {
            const { element } = await setupBatch();
            const batch = batchButton(element);
            const id = batch.getAttribute('aria-describedby') as string;
            expect(id).toBeTruthy();
            expect(element.querySelector(`#${id}`)).toBe(hint(element));
            expect(batch.textContent?.trim()).toBe('Add several photos');
            expect(batch.hasAttribute('aria-label')).toBe(false);
            expect(button(element, 'Add item')?.hasAttribute('aria-describedby')).toBe(false);
          });

          it('goes away with the buttons while the "Add item" form is open, and comes back with them', async () => {
            const { fixture, element } = await setupBatch();
            await openForm(fixture, element);
            expect(hint(element)).toBeNull();
            expect(element.querySelector('#batch-hint')).toBeNull();
            button(element, 'Done')?.click();
            fixture.detectChanges();
            expect(hint(element)?.textContent?.trim()).toBe('Up to 20 photos at a time.');
            expect(batchButton(element).getAttribute('aria-describedby')).toBe('batch-hint');
          });

          it('stays while a batch runs, because the button stays', async () => {
            const { fixture, element } = await setupBatch();
            await pick(fixture, element, ['a.jpg']);
            expect(hint(element)?.textContent?.trim()).toBe('Up to 20 photos at a time.');
          });

          it('does not change the status line: it is empty and the hint is not in it', async () => {
            const { element } = await setupBatch();
            expect(status(element)).toBe('');
            expect(element.querySelector('.item-notice .batch-hint')).toBeNull();
          });
        });

        it('opens the file picker when it is pressed', async () => {
          const { element } = await setupBatch();
          const click = vi.spyOn(batchInput(element), 'click').mockImplementation(() => undefined);
          batchButton(element).click();
          expect(click).toHaveBeenCalledTimes(1);
        });

        it('starts nothing by itself, and has an empty status line', async () => {
          const { element } = await setupBatch();
          expect(run).not.toHaveBeenCalled();
          const line = element.querySelector('.item-notice') as HTMLElement;
          expect(line.getAttribute('role')).toBe('status');
          expect(status(element)).toBe('');
        });

        it('is hidden, with its buttons, while the "Add item" form is open, and comes back with Done', async () => {
          const { fixture, element } = await setupBatch();
          await openForm(fixture, element);
          expect(button(element, 'Add several photos')).toBeUndefined();
          expect(button(element, 'Add item')).toBeUndefined();
          expect(batchInput(element)).not.toBeNull(); // the field stays
          button(element, 'Done')?.click();
          fixture.detectChanges();
          expect(Array.from(element.querySelectorAll('.items .actions button')).length).toBe(2);
        });
      });

      describe('choosing photos', () => {
        it('starts the batch for this container with the files, in the order they came', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['b.jpg', 'a.jpg', 'c.jpg']);
          expect(run).toHaveBeenCalledTimes(1);
          const [chosen, containerId] = run.mock.calls[0];
          expect((chosen as File[]).map((f) => f.name)).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
          expect(containerId).toBe(container.id);
        });

        it('shows "Preparing photo 1 of 3…" in the status line, and then follows the progress', async () => {
          const { fixture, element } = await setupBatch();
          const line = element.querySelector('.item-notice');
          await pick(fixture, element, ['a.jpg', 'b.jpg', 'c.jpg']);
          expect(status(element)).toBe('Preparing photo 1 of 3…');
          options.onProgress(2, 3);
          fixture.detectChanges();
          expect(status(element)).toBe('Preparing photo 2 of 3…');
          options.onProgress(3, 3);
          fixture.detectChanges();
          expect(status(element)).toBe('Preparing photo 3 of 3…');
          // It is the same element all the time, so screen readers announce the changes.
          expect(element.querySelector('.item-notice')).toBe(line);
        });

        it('keeps the focus on the button, and marks it as unavailable while the batch runs', async () => {
          const { fixture, element } = await setupBatch();
          batchButton(element).focus();
          await pick(fixture, element, ['a.jpg']);
          expect(batchButton(element).getAttribute('aria-disabled')).toBe('true');
          expect(document.activeElement).toBe(batchButton(element));
        });

        it('puts the focus back on the button when the files are chosen, even if it was elsewhere', async () => {
          const { fixture, element } = await setupBatch();
          (element.querySelector('#container-name') as HTMLInputElement).focus();
          await pick(fixture, element, ['a.jpg']);
          expect(document.activeElement).toBe(batchButton(element));
        });

        it('empties the file field, so the same photos can be chosen again', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg']);
          expect(batchInput(element).value).toBe('');
        });

        it('starts nothing when no file is chosen', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, []);
          expect(run).not.toHaveBeenCalled();
          expect(batchButton(element).hasAttribute('aria-disabled')).toBe(false);
          expect(status(element)).toBe('');
        });

        it('does not start another batch while one runs: the button only ignores the click', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg', 'b.jpg']);
          const click = vi.spyOn(batchInput(element), 'click').mockImplementation(() => undefined);
          batchButton(element).click();
          expect(click).not.toHaveBeenCalled();
          // Even if the files arrive some other way, the running batch is not replaced.
          await pick(fixture, element, ['c.jpg']);
          expect(run).toHaveBeenCalledTimes(1);
          expect(status(element)).toBe('Preparing photo 1 of 2…');
        });

        it('uses the first 20 photos when more are chosen, and says it at the end', async () => {
          const { fixture, element } = await setupBatch();
          const names = Array.from({ length: 25 }, (_, i) => `photo-${i + 1}.jpg`);
          await pick(fixture, element, names);
          const [chosen] = run.mock.calls[0];
          expect((chosen as File[]).map((f) => f.name)).toEqual(names.slice(0, 20));
          expect(status(element)).toBe('Preparing photo 1 of 20…');
          await finishWith(fixture, ended(20, 20));
          expect(status(element)).toBe(
            'Added 20 photos. The other 5 were not added: the maximum is 20 photos at a time.',
          );
        });
      });

      describe('when the batch ends', () => {
        it('says how many photos were added, and the button is available again', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg', 'b.jpg', 'c.jpg']);
          await finishWith(fixture, ended(3, 3));
          expect(status(element)).toBe('Added 3 photos.');
          expect(failures(element)).toEqual([]);
          expect(batchButton(element).hasAttribute('aria-disabled')).toBe(false);
        });

        it('does not move the focus when it ends', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg']);
          expect(document.activeElement).toBe(batchButton(element));
          await finishWith(fixture, ended(1, 1));
          expect(status(element)).toBe('Added 1 photo.');
          expect(document.activeElement).toBe(batchButton(element));
        });

        it('says which files failed and why, inside the same status line', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg', 'b.pdf', 'c.jpg']);
          await finishWith(
            fixture,
            ended(1, 3, [
              { fileName: 'b.pdf', reason: 'This file is not an image.' },
              { fileName: 'c.jpg', reason: "Couldn't save the photo." },
            ]),
          );
          expect(status(element)).toBe('Added 1 of 3 photos. 2 failed.');
          expect(failures(element)).toEqual([
            'b.pdf: This file is not an image.',
            "c.jpg: Couldn't save the photo.",
          ]);
          const line = element.querySelector('.item-notice') as HTMLElement;
          expect(line.getAttribute('role')).toBe('status');
          expect(line.querySelector('.batch-failures')).not.toBeNull();
        });

        it('says both the failures and the photos over the maximum', async () => {
          const { fixture, element } = await setupBatch();
          const names = Array.from({ length: 22 }, (_, i) => `photo-${i + 1}.jpg`);
          await pick(fixture, element, names);
          await finishWith(
            fixture,
            ended(19, 20, [{ fileName: 'photo-4.jpg', reason: 'This file is not an image.' }]),
          );
          expect(status(element)).toBe(
            'Added 19 of 20 photos. 1 failed. The other 2 were not added: the maximum is 20 photos at a time.',
          );
          expect(failures(element)).toEqual(['photo-4.jpg: This file is not an image.']);
        });

        it('replaces the message that was there before the batch started', async () => {
          const { fixture, element } = await setupBatch([item('Nails')]);
          (element.querySelector('button[aria-label="Delete Nails"]') as HTMLButtonElement).click();
          fixture.detectChanges();
          button(element, 'Cancel')?.click();
          await pick(fixture, element, ['a.jpg']);
          expect(status(element)).toBe('Preparing photo 1 of 1…');
        });

        it('clears the summary, and the list of failures, when another action starts', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.pdf']);
          await finishWith(
            fixture,
            ended(0, 1, [{ fileName: 'a.pdf', reason: 'This file is not an image.' }]),
          );
          expect(failures(element).length).toBe(1);
          await openForm(fixture, element); // "Add item"
          expect(status(element)).toBe('');
          expect(failures(element)).toEqual([]);
        });

        it('clears the summary when another container is selected', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg']);
          await finishWith(fixture, ended(1, 1));
          fixture.componentRef.setInput(
            'container',
            createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
          );
          fixture.detectChanges();
          expect(status(element)).toBe('');
        });

        it('lets another batch start', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg']);
          await finishWith(fixture, ended(1, 1));
          await pick(fixture, element, ['b.jpg']);
          expect(run).toHaveBeenCalledTimes(2);
          expect(status(element)).toBe('Preparing photo 1 of 1…');
        });
      });

      describe('while the batch runs', () => {
        it('does not close an open form, and keeps what was typed', async () => {
          const { fixture, element } = await setupBatch([item('Nails')]);
          (element.querySelector('button[aria-label="Edit Nails"]') as HTMLButtonElement).click();
          fixture.detectChanges();
          await fixture.whenStable();
          typeIn(element, 'item-name', 'Typed');
          await pick(fixture, element, ['a.jpg']);
          expect(element.querySelector('.item app-item-form')).not.toBeNull();
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Typed');
          await finishWith(fixture, ended(1, 1));
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Typed');
        });

        it('lets the other actions work, and the progress has priority over their messages', async () => {
          const { fixture, element } = await setupBatch([item('Nails')]);
          await pick(fixture, element, ['a.jpg', 'b.jpg']);
          (element.querySelector('button[aria-label="Edit Nails"]') as HTMLButtonElement).click();
          fixture.detectChanges();
          await fixture.whenStable();
          expect(element.querySelector('.item app-item-form')).not.toBeNull();
          expect(status(element)).toBe('Preparing photo 1 of 2…');
        });
      });

      describe('when the user leaves the container', () => {
        it('stops the batch when another container is selected, and shows nothing of it', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg', 'b.jpg']);
          expect(options.isCurrent()).toBe(true);

          fixture.componentRef.setInput(
            'container',
            createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
          );
          fixture.detectChanges();
          expect(options.isCurrent()).toBe(false);
          expect(status(element)).toBe('');
          // The button of the new container works at once.
          expect(batchButton(element).hasAttribute('aria-disabled')).toBe(false);

          // The old batch ends later: nothing of it is shown in the new container.
          await finishWith(fixture, ended(1, 2));
          expect(status(element)).toBe('');
        });

        it('does not take the old batch back when the user comes back to the same container', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg', 'b.jpg']);
          fixture.componentRef.setInput(
            'container',
            createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
          );
          fixture.detectChanges();
          fixture.componentRef.setInput('container', container);
          fixture.detectChanges();
          expect(options.isCurrent()).toBe(false);
          expect(status(element)).toBe('');
          await finishWith(fixture, ended(1, 2));
          expect(status(element)).toBe('');
        });

        it('stops the batch when the panel is destroyed (the container was deleted)', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg']);
          expect(options.isCurrent()).toBe(true);
          fixture.destroy();
          expect(options.isCurrent()).toBe(false);
          // The batch ends after the panel is gone: nothing is shown and nothing breaks.
          const text = element.querySelector('.item-notice')?.textContent;
          finish(ended(1, 1));
          await settle();
          expect(element.querySelector('.item-notice')?.textContent).toBe(text);
        });

        it('can start a new batch in the other container while the old one winds down', async () => {
          const { fixture, element } = await setupBatch();
          await pick(fixture, element, ['a.jpg']);
          const oldOptions = options;
          fixture.componentRef.setInput(
            'container',
            createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
          );
          fixture.detectChanges();
          await pick(fixture, element, ['b.jpg']);
          expect(run).toHaveBeenCalledTimes(2);
          expect(oldOptions.isCurrent()).toBe(false);
          expect(options.isCurrent()).toBe(true);
          expect(status(element)).toBe('Preparing photo 1 of 1…');
        });
      });
    });

    describe('delete confirmation', () => {
      async function question(items: Item[]): Promise<string | undefined> {
        const { fixture, element } = await setupWithItems(items);
        button(element, 'Delete')?.click();
        fixture.detectChanges();
        return element.querySelector('.confirm span')?.textContent?.trim();
      }

      it('keeps the short question for a container without items', async () => {
        expect(await question([])).toBe('Delete "Toys"? This cannot be undone.');
      });

      it('says how many items are deleted with the container', async () => {
        expect(await question([item('A'), item('B'), item('C'), item('D'), item('E')])).toBe(
          '"Toys" has 5 items. Delete it and its items? This cannot be undone.',
        );
      });

      it('uses the singular for one item, whatever its quantity', async () => {
        expect(await question([item('Nails', { quantity: 100 })])).toBe(
          '"Toys" has 1 item. Delete it and its item? This cannot be undone.',
        );
      });
    });
  });

  describe('delete', () => {
    it('does not delete on the first click: it asks for confirmation inline', async () => {
      const { fixture, element, deleted } = await setup();
      button(element, 'Delete')?.click();
      fixture.detectChanges();
      expect(deleted).not.toHaveBeenCalled();
      expect(element.querySelector('.confirm')?.textContent).toContain('Delete "Toys"?');
      expect(button(element, 'Yes, delete')).toBeDefined();
      expect(button(element, 'Cancel')).toBeDefined();
    });

    it('deletes only after the confirmation', async () => {
      const { fixture, element, deleted } = await setup();
      button(element, 'Delete')?.click();
      fixture.detectChanges();
      button(element, 'Yes, delete')?.click();
      fixture.detectChanges();
      expect(deleted).toHaveBeenCalledTimes(1);
      expect(element.querySelector('.confirm')).toBeNull();
    });

    it('cancel goes back without deleting', async () => {
      const { fixture, element, deleted } = await setup();
      button(element, 'Delete')?.click();
      fixture.detectChanges();
      button(element, 'Cancel')?.click();
      fixture.detectChanges();
      expect(deleted).not.toHaveBeenCalled();
      expect(element.querySelector('.confirm')).toBeNull();
      expect(button(element, 'Delete')).toBeDefined();
    });

    it('forgets a pending confirmation when another container is selected', async () => {
      const { fixture, element } = await setup();
      button(element, 'Delete')?.click();
      fixture.detectChanges();
      expect(element.querySelector('.confirm')).not.toBeNull();

      fixture.componentRef.setInput(
        'container',
        createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0),
      );
      fixture.detectChanges();
      expect(element.querySelector('.confirm')).toBeNull();
    });

    it('never uses window.confirm', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      const { fixture, element } = await setup();
      button(element, 'Delete')?.click();
      fixture.detectChanges();
      button(element, 'Yes, delete')?.click();
      expect(confirmSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createContainer, TOUGH_BOX_27_GAL } from '../core/container.model';
import { Item } from '../core/item.model';
import { ContainerPanel } from './container-panel';

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
    expect(labels()).toEqual(['Rotate 90°', 'Add item', 'Delete']);

    const hammer = { id: 'item-1', name: 'Hammer', quantity: 1, description: '', category: '' };
    fixture.componentRef.setInput('container', { ...container, items: [hammer] });
    fixture.detectChanges();
    expect(labels()).toEqual(['Rotate 90°', 'Add item', 'Edit Hammer', 'Delete Hammer', 'Delete']);
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
      return { id: `id-${name}`, name, quantity: 1, description: '', category: '', ...values };
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
      const rows = Array.from(element.querySelectorAll('.item')).map((row) =>
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
            draft: { name: 'Screws', quantity: 85, description: '', category: 'Hardware' },
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

      it('never uses window.confirm to remove an item', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        const { fixture, element } = await setupAttached();
        await click(fixture, iconButton(element, 'Delete Nails'));
        await click(fixture, element.querySelector('.item-confirm-delete') as HTMLButtonElement);
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
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

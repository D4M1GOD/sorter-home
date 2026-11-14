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

  it('offers Rotate 90°, Add item and Delete, and no other actions in this step', async () => {
    const { element } = await setup();
    const labels = Array.from(element.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Rotate 90°', 'Add item', 'Delete']);
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

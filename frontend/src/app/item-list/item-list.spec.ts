import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Item } from '../core/item.model';
import { ItemList } from './item-list';

describe('ItemList', () => {
  function item(name: string, values: Partial<Item> = {}): Item {
    return { id: `id-${name}`, name, quantity: 1, description: '', category: '', ...values };
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
    expect(rows(element)[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('Nails Qty 1');
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

    it('has an "Edit" and a "Delete" button in each row, named with the item name', async () => {
      const { element } = await setup([item('Nails'), item('Hammer')]);
      expect(buttonLabels(rows(element)[0])).toEqual(['Edit Hammer', 'Delete Hammer']);
      expect(buttonLabels(rows(element)[1])).toEqual(['Edit Nails', 'Delete Nails']);
    });

    it('gives each button a tooltip with the same text, and type "button"', async () => {
      const { element } = await setup([item('Hammer')]);
      for (const button of Array.from(rows(element)[0].querySelectorAll('button'))) {
        expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'));
        expect(button.type).toBe('button');
      }
    });

    it('draws each icon as an SVG that screen readers skip, with a different drawing for each', async () => {
      const { element } = await setup([item('Hammer')]);
      const icons = Array.from(rows(element)[0].querySelectorAll('button svg'));
      expect(icons.length).toBe(2);
      for (const icon of icons) {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
        expect(icon.getAttribute('focusable')).toBe('false');
      }
      // The meaning does not rely on color: the two drawings are different.
      expect(icons[0].innerHTML).not.toBe(icons[1].innerHTML);
      expect(element.querySelector('img')).toBeNull();
    });

    it('puts the buttons below the text of the row, "Edit" first', async () => {
      const { element } = await setup([item('Hammer', { category: 'Tools', description: 'Steel' })]);
      const row = rows(element)[0];
      const description = row.querySelector('.item-description') as Element;
      const actions = row.querySelector('.item-actions') as Element;
      expect(
        description.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(actions.querySelectorAll('button').length).toBe(2);
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
      expect(buttonLabels(rows(element)[1])).toEqual(['Edit Cable', 'Delete Cable']);
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

  describe('focusControl', () => {
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

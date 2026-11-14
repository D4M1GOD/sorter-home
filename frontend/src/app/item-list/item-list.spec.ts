import { TestBed } from '@angular/core/testing';
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
});

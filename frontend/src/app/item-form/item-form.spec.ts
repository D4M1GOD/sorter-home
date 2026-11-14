import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
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
      expect(labels).toEqual(['Add', 'Done']);
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
});

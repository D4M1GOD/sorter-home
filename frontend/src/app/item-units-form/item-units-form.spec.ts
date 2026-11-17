import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Item } from '../core/item.model';
import { ItemUnitsForm, ItemUnitsMode } from './item-units-form';

describe('ItemUnitsForm', () => {
  /** "Nails": 100 units, 20 of them out, so 80 inside. */
  const nails: Item = {
    id: 'item-1',
    name: 'Nails',
    quantity: 100,
    quantityOut: 20,
    description: '',
    category: '',
    photoId: null,
  };

  async function setup(mode: ItemUnitsMode, item: Item = nails) {
    const fixture = TestBed.createComponent(ItemUnitsForm);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('mode', mode);
    // The form is attached to the page so the keyboard focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const submitted = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.closed.subscribe(closed);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, submitted, closed };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  function field(element: HTMLElement): HTMLInputElement {
    return element.querySelector('#item-units') as HTMLInputElement;
  }

  function type(element: HTMLElement, text: string): void {
    const input = field(element);
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    );
  }

  function labels(element: HTMLElement): (string | undefined)[] {
    return Array.from(element.querySelectorAll('button')).map((b) => b.textContent?.trim());
  }

  /** What the Enter key does in the field: the browser submits the form. */
  async function pressEnter(fixture: ComponentFixture<unknown>, element: HTMLElement) {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(fixture: ComponentFixture<unknown>, target: HTMLButtonElement | undefined) {
    target?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function errors(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.field-error')).map(
      (e) => e.textContent?.trim() ?? '',
    );
  }

  describe('when it opens', () => {
    it('has the title and the buttons of "take out", with two actions', async () => {
      const { element } = await setup('take-out');
      expect(element.querySelector('h4')?.textContent?.trim()).toBe('Take out or use Nails');
      expect(labels(element)).toEqual(['Take out', 'Mark as used', 'Cancel']);
    });

    it('has the title and the buttons of "put back"', async () => {
      const { element } = await setup('put-back');
      expect(element.querySelector('h4')?.textContent?.trim()).toBe('Put back Nails');
      expect(labels(element)).toEqual(['Put back', 'Cancel']);
    });

    it('has the title and the buttons of "used"', async () => {
      const { element } = await setup('used');
      expect(element.querySelector('h4')?.textContent?.trim()).toBe('Mark Nails as used');
      expect(labels(element)).toEqual(['Used', 'Cancel']);
    });

    it('names the form with its title', async () => {
      const { element } = await setup('take-out');
      expect(element.querySelector('form')?.getAttribute('aria-labelledby')).toBe(
        element.querySelector('h4')?.id,
      );
    });

    it('pre-fills the quantity with all the units inside for "take out"', async () => {
      const { element } = await setup('take-out');
      expect(field(element).value).toBe('80');
    });

    it('pre-fills the quantity with all the units out for "put back" and "used"', async () => {
      expect(field((await setup('put-back')).element).value).toBe('20');
      document.body.replaceChildren();
      expect(field((await setup('used')).element).value).toBe('20');
    });

    it('has a text field labelled "Quantity", with a numeric keyboard', async () => {
      const { element } = await setup('take-out');
      const label = element.querySelector('label') as HTMLLabelElement;
      expect(label.textContent?.trim()).toBe('Quantity');
      expect(label.getAttribute('for')).toBe(field(element).id);
      expect(field(element).getAttribute('type')).toBe('text');
      expect(field(element).getAttribute('inputmode')).toBe('numeric');
    });

    it('puts the keyboard focus on the quantity, with its text selected', async () => {
      const { element } = await setup('take-out');
      const input = field(element);
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(2);
    });

    it('shows no errors', async () => {
      const { element } = await setup('take-out');
      expect(errors(element)).toEqual([]);
      expect(field(element).getAttribute('aria-describedby')).toBe('item-units-status');
      expect(element.querySelector('#item-units-status')?.getAttribute('role')).toBe('alert');
    });
  });

  describe('take out or use', () => {
    it('has "Take out" as the submit button, and "Mark as used" as a plain button', async () => {
      const { element } = await setup('take-out');
      expect(button(element, 'Take out')?.type).toBe('submit');
      expect(button(element, 'Mark as used')?.type).toBe('button');
      expect(button(element, 'Cancel')?.type).toBe('button');
      // Only one submit button: the Enter key cannot run anything else.
      expect(element.querySelectorAll('button[type="submit"]').length).toBe(1);
    });

    it('the Enter key takes out, and never marks as used', async () => {
      const { fixture, element, submitted } = await setup('take-out');
      type(element, '20');
      await pressEnter(fixture, element);
      expect(submitted).toHaveBeenCalledTimes(1);
      expect(submitted).toHaveBeenCalledWith({ action: 'take-out', units: 20 });
    });

    it('"Take out" takes out the units typed', async () => {
      const { fixture, element, submitted } = await setup('take-out');
      await pressEnter(fixture, element); // the pre-filled value: all the units inside
      expect(submitted).toHaveBeenCalledWith({ action: 'take-out', units: 80 });
    });

    it('"Mark as used" uses the units typed from inside, only with a click', async () => {
      const { fixture, element, submitted } = await setup('take-out');
      type(element, ' 15 ');
      expect(submitted).not.toHaveBeenCalled();
      await click(fixture, button(element, 'Mark as used'));
      expect(submitted).toHaveBeenCalledTimes(1);
      expect(submitted).toHaveBeenCalledWith({ action: 'used-from-inside', units: 15 });
    });

    it('"Mark as used" with a wrong quantity shows the error and does nothing', async () => {
      const { fixture, element, submitted } = await setup('take-out');
      type(element, '81');
      await click(fixture, button(element, 'Mark as used'));
      expect(submitted).not.toHaveBeenCalled();
      expect(errors(element)).toEqual(['Quantity must be a whole number from 1 to 80.']);
    });
  });

  describe('put back and used', () => {
    it('"Put back" emits the units to put back', async () => {
      const { fixture, element, submitted } = await setup('put-back');
      type(element, '5');
      await pressEnter(fixture, element);
      expect(submitted).toHaveBeenCalledWith({ action: 'put-back', units: 5 });
    });

    it('"Used" emits the units that are out and were used', async () => {
      const { fixture, element, submitted } = await setup('used');
      type(element, '15');
      await pressEnter(fixture, element);
      expect(submitted).toHaveBeenCalledWith({ action: 'used-from-out', units: 15 });
    });

    it('have no "Mark as used" button', async () => {
      expect(button((await setup('put-back')).element, 'Mark as used')).toBeUndefined();
      document.body.replaceChildren();
      expect(button((await setup('used')).element, 'Mark as used')).toBeUndefined();
    });
  });

  describe('errors', () => {
    it('says the quantity is required when it is empty', async () => {
      const { fixture, element, submitted } = await setup('take-out');
      type(element, '   ');
      await pressEnter(fixture, element);
      expect(submitted).not.toHaveBeenCalled();
      expect(errors(element)).toEqual(['Quantity is required.']);
      expect(field(element).getAttribute('aria-invalid')).toBe('true');
    });

    it('rejects anything that is not a whole number from 1 to the units inside, without rounding', async () => {
      for (const text of ['0', '81', '1.5', '-1', 'abc', '1e1']) {
        const { fixture, element, submitted } = await setup('take-out');
        type(element, text);
        await pressEnter(fixture, element);
        expect(submitted).not.toHaveBeenCalled();
        expect(errors(element)).toEqual(['Quantity must be a whole number from 1 to 80.']);
        document.body.replaceChildren();
      }
    });

    it('uses the units out as the maximum for "put back" and "used"', async () => {
      for (const mode of ['put-back', 'used'] as const) {
        const { fixture, element, submitted } = await setup(mode);
        type(element, '21');
        await pressEnter(fixture, element);
        expect(submitted).not.toHaveBeenCalled();
        expect(errors(element)).toEqual(['Quantity must be a whole number from 1 to 20.']);
        document.body.replaceChildren();
      }
    });

    it('says "Quantity must be 1." when only one unit can be moved', async () => {
      const { fixture, element } = await setup('put-back', { ...nails, quantityOut: 1 });
      type(element, '2');
      await pressEnter(fixture, element);
      expect(errors(element)).toEqual(['Quantity must be 1.']);
    });

    it('keeps what was typed when there is an error, and accepts it once it is fixed', async () => {
      const { fixture, element, submitted } = await setup('take-out');
      type(element, '500');
      await pressEnter(fixture, element);
      expect(field(element).value).toBe('500');
      type(element, '50');
      await pressEnter(fixture, element);
      expect(errors(element)).toEqual([]);
      expect(submitted).toHaveBeenCalledWith({ action: 'take-out', units: 50 });
    });
  });

  describe('closing', () => {
    it('emits "closed" with Cancel, without doing anything', async () => {
      const { element, submitted, closed } = await setup('take-out');
      button(element, 'Cancel')?.click();
      expect(closed).toHaveBeenCalledTimes(1);
      expect(submitted).not.toHaveBeenCalled();
    });

    it('emits "closed" with the Escape key', async () => {
      const { element, submitted, closed } = await setup('used');
      field(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(closed).toHaveBeenCalledTimes(1);
      expect(submitted).not.toHaveBeenCalled();
    });
  });
});

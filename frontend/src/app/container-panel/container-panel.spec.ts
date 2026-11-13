import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createContainer, TOUGH_BOX_27_GAL } from '../core/container.model';
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

  it('offers Rotate 90° and Delete, and no other actions in this step', async () => {
    const { element } = await setup();
    const labels = Array.from(element.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Rotate 90°', 'Delete']);
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
      const status = element.querySelector('.rotate-notice');
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.textContent?.trim()).toBe('');
    });

    it('shows "Not enough space to rotate" in the same status area when it is blocked', async () => {
      const { fixture, element } = await setup();
      const statusBefore = element.querySelector('.rotate-notice');
      fixture.componentRef.setInput('rotateBlocked', true);
      fixture.detectChanges();
      const status = element.querySelector('.rotate-notice');
      expect(status).toBe(statusBefore); // the same element, so screen readers announce the change
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.textContent?.trim()).toBe('Not enough space to rotate');

      fixture.componentRef.setInput('rotateBlocked', false);
      fixture.detectChanges();
      expect(element.querySelector('.rotate-notice')?.textContent?.trim()).toBe('');
    });

    it('does not show the current rotation', async () => {
      const { fixture, element } = await setup();
      fixture.componentRef.setInput('container', { ...container, rotation: 90 });
      fixture.detectChanges();
      expect(element.textContent).not.toMatch(/rotation/i);
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

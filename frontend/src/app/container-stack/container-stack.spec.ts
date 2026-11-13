import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Container, createContainer, TOUGH_BOX_27_GAL } from '../core/container.model';
import { ContainerStack } from './container-stack';

describe('ContainerStack', () => {
  function member(id: string, name: string, stackPosition: number): Container {
    return { ...createContainer(TOUGH_BOX_27_GAL.id, name, 0, 0), id, stackPosition };
  }

  // From the bottom to the top.
  const members = [member('a', 'Winter', 0), member('b', 'Books', 1), member('c', 'Toys', 2)];

  function setup(selectedId = 'b', list: readonly Container[] = members) {
    const fixture = TestBed.createComponent(ContainerStack);
    fixture.componentRef.setInput('members', list);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
    const selected = vi.fn();
    const movedUp = vi.fn();
    const movedDown = vi.fn();
    const removed = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    fixture.componentInstance.movedUp.subscribe(movedUp);
    fixture.componentInstance.movedDown.subscribe(movedDown);
    fixture.componentInstance.removed.subscribe(removed);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, selected, movedUp, movedDown, removed };
  }

  function levels(element: HTMLElement): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.level'));
  }

  function action(element: HTMLElement, label: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.actions button')).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement;
  }

  it('lists the containers from the top to the bottom, with the level of each one', () => {
    const { element } = setup();
    // The selected one (Books) has a visible mark in front of it.
    expect(levels(element).map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Level 3 Toys',
      '▸ Level 2 Books',
      'Level 1 Winter',
    ]);
  });

  it('says how many containers the stack has', () => {
    const { element } = setup();
    expect(element.querySelector('h3')?.textContent?.trim()).toBe('Stack of 3');
  });

  it('highlights the selected container with aria-current, and does not rely on color alone', () => {
    const { element } = setup('b');
    const [top, middle, bottom] = levels(element);
    expect(middle.getAttribute('aria-current')).toBe('true');
    expect(middle.classList.contains('current')).toBe(true);
    expect(middle.querySelector('.level-mark')).not.toBeNull(); // a visible mark, hidden from screen readers
    expect(middle.querySelector('.level-mark')?.getAttribute('aria-hidden')).toBe('true');
    expect(top.getAttribute('aria-current')).toBeNull();
    expect(bottom.getAttribute('aria-current')).toBeNull();
    expect(top.querySelector('.level-mark')).toBeNull();
  });

  it('follows the selected container', () => {
    const { fixture, element } = setup('b');
    fixture.componentRef.setInput('selectedId', 'c');
    fixture.detectChanges();
    expect(levels(element)[0].getAttribute('aria-current')).toBe('true');
    expect(levels(element)[1].getAttribute('aria-current')).toBeNull();
  });

  it('emits the id of the container when its row is clicked (how the hidden ones are reached)', () => {
    const { element, selected } = setup('c');
    levels(element)[2].click(); // Level 1: the bottom one, hidden on the plan
    expect(selected).toHaveBeenCalledWith('a');
  });

  it('is made of real buttons, so the keyboard can reach every container', () => {
    const { element } = setup();
    for (const row of levels(element)) {
      expect(row.tagName).toBe('BUTTON');
      expect(row.getAttribute('type')).toBe('button');
    }
  });

  describe('Move up, Move down and Remove from stack', () => {
    it('emits movedUp and movedDown from a container in the middle', () => {
      const { element, movedUp, movedDown } = setup('b');
      action(element, 'Move up').click();
      action(element, 'Move down').click();
      expect(movedUp).toHaveBeenCalledTimes(1);
      expect(movedDown).toHaveBeenCalledTimes(1);
    });

    it('emits removed', () => {
      const { element, removed } = setup('b');
      action(element, 'Remove from stack').click();
      expect(removed).toHaveBeenCalledTimes(1);
    });

    it('uses aria-disabled for Move up at the top, keeps the button focusable and ignores the click', () => {
      const { element, movedUp } = setup('c');
      const button = action(element, 'Move up');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);
      button.click();
      expect(movedUp).not.toHaveBeenCalled();
      expect(action(element, 'Move down').getAttribute('aria-disabled')).toBe('false');
    });

    it('uses aria-disabled for Move down at the bottom and ignores the click', () => {
      const { element, movedDown } = setup('a');
      const button = action(element, 'Move down');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);
      button.click();
      expect(movedDown).not.toHaveBeenCalled();
      expect(action(element, 'Move up').getAttribute('aria-disabled')).toBe('false');
    });

    it('keeps Remove from stack available at both ends', () => {
      for (const id of ['a', 'c']) {
        const { element, removed } = setup(id);
        const button = action(element, 'Remove from stack');
        expect(button.getAttribute('aria-disabled')).toBeNull();
        button.click();
        expect(removed).toHaveBeenCalledTimes(1);
      }
    });

    it('updates the disabled state when the selection reaches an end', () => {
      const { fixture, element } = setup('b');
      fixture.componentRef.setInput('selectedId', 'c');
      fixture.detectChanges();
      expect(action(element, 'Move up').getAttribute('aria-disabled')).toBe('true');
    });
  });

  it('works with a stack of two', () => {
    const { element } = setup('a', [member('a', 'Low', 0), member('b', 'High', 1)]);
    expect(levels(element).map((b) => b.querySelector('.level-number')?.textContent?.trim())).toEqual([
      'Level 2',
      'Level 1',
    ]);
  });
});

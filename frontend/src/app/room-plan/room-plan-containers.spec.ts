import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Container, createContainer, TOUGH_BOX_27_GAL } from '../core/container.model';
import { createRoom, Room } from '../core/room.model';
import { feetToMm } from '../core/units';
import { RoomPlan } from './room-plan';

/**
 * Containers on the plan: drawing, selecting, the toolbox drag with its shadow, and tap to add.
 * Pointer events are simulated. jsdom has no real layout, so getScreenCTM is replaced by an
 * identity matrix: a pointer at clientX/clientY is exactly that many plan millimeters.
 * What jsdom cannot check (real mouse/touch, drag from the toolbox over real layout, keyboard,
 * how it looks) must be tested by hand.
 */
describe('RoomPlan containers', () => {
  const W = TOUGH_BOX_27_GAL.widthMm; // 775
  const D = TOUGH_BOX_27_GAL.depthMm; // 521

  function box(name: string, xMm: number, yMm: number): Container {
    return createContainer(TOUGH_BOX_27_GAL.id, name, xMm, yMm);
  }

  function roomWith(containers: Container[], size?: { widthMm: number; depthMm: number }): Room {
    return { ...createRoom('Garage'), ...size, containers }; // default 3658 x 3048 mm
  }

  function setup(room: Room) {
    const fixture = TestBed.createComponent(RoomPlan);
    fixture.componentRef.setInput('room', room);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const svg = element.querySelector('svg') as SVGSVGElement;
    svg.getScreenCTM = () =>
      ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;
    const added = vi.fn();
    const resized = vi.fn();
    fixture.componentInstance.containerAdded.subscribe(added);
    fixture.componentInstance.resized.subscribe(resized);
    return { fixture, element, svg, added, resized, plan: fixture.componentInstance };
  }

  function pointer(target: Element, type: string, x: number, y: number): void {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    target.dispatchEvent(event);
  }

  function tile(element: HTMLElement): HTMLButtonElement {
    return element.querySelector('.tile') as HTMLButtonElement;
  }

  /** Drags the tile over the plan. Moves far enough first, so it counts as a drag. */
  function dragTo(element: HTMLElement, x: number, y: number): void {
    pointer(tile(element), 'pointerdown', 5000, 5000);
    pointer(tile(element), 'pointermove', x, y);
  }

  function shadow(element: HTMLElement): Element | null {
    return element.querySelector('.shadow');
  }

  function shadowText(element: HTMLElement): string {
    return (element.querySelector('.shadow-text')?.textContent ?? '').trim();
  }

  it('uses role "group" on the plan so the containers are reachable by assistive technology', () => {
    const { svg } = setup(roomWith([]));
    expect(svg.getAttribute('role')).toBe('group');
  });

  describe('drawing', () => {
    it('draws every container at its real size and position', () => {
      const { element } = setup(roomWith([box('A', 100, 200), box('B', 2000, 1500)]));
      const bodies = element.querySelectorAll('.container-body');
      expect(bodies.length).toBe(2);
      expect(bodies[0].getAttribute('x')).toBe('100');
      expect(bodies[0].getAttribute('y')).toBe('200');
      expect(bodies[0].getAttribute('width')).toBe(String(W));
      expect(bodies[0].getAttribute('height')).toBe(String(D));
      expect(bodies[1].getAttribute('x')).toBe('2000');
    });

    it('draws nothing for a room without containers', () => {
      const { element } = setup(roomWith([]));
      expect(element.querySelectorAll('.container').length).toBe(0);
    });

    it('shows the name inside the container', () => {
      const { element } = setup(roomWith([box('Toys', 0, 0)]));
      expect(element.querySelector('.container-name')?.textContent?.trim()).toBe('Toys');
    });

    it('shortens a name that does not fit, and keeps the full name in the title', () => {
      const longName = 'A very long container name that cannot fit inside the box';
      const { element } = setup(roomWith([box(longName, 0, 0)]));
      const shown = element.querySelector('.container-name')?.textContent?.trim() ?? '';
      expect(shown.length).toBeLessThan(longName.length);
      expect(shown.endsWith('…')).toBe(true);
      expect(element.querySelector('.container title')?.textContent).toBe(longName);
    });

    it('updates when the room changes', () => {
      const room = roomWith([box('A', 0, 0)]);
      const { fixture, element } = setup(room);
      fixture.componentRef.setInput(
        'room',
        roomWith([...room.containers, box('B', 2000, 0)], room),
      );
      fixture.detectChanges();
      expect(element.querySelectorAll('.container').length).toBe(2);
    });
  });

  describe('selecting', () => {
    it('selects a container when it is clicked and shows a visible outline', () => {
      const a = box('A', 0, 0);
      const b = box('B', 2000, 0);
      const { fixture, element, plan } = setup(roomWith([a, b]));
      (element.querySelectorAll('.container')[1] as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      fixture.detectChanges();
      expect(plan.selectedId()).toBe(b.id);
      const groups = element.querySelectorAll('.container');
      expect(groups[1].classList.contains('selected')).toBe(true);
      expect(groups[0].classList.contains('selected')).toBe(false);
      expect(groups[1].getAttribute('aria-pressed')).toBe('true');
    });

    it('deselects when the empty plan is clicked', () => {
      const a = box('A', 0, 0);
      const { fixture, element, plan } = setup(roomWith([a]));
      plan.selectedId.set(a.id);
      fixture.detectChanges();
      (element.querySelector('.floor') as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      fixture.detectChanges();
      expect(plan.selectedId()).toBeNull();
      expect(element.querySelector('.container.selected')).toBeNull();
    });

    it('does not deselect when a resize handle is clicked', () => {
      const a = box('A', 0, 0);
      const { element, plan } = setup(roomWith([a]));
      plan.selectedId.set(a.id);
      (element.querySelector('.hit-right') as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      expect(plan.selectedId()).toBe(a.id);
    });

    it('selects with the keyboard (Enter and Space) because containers are focusable buttons', () => {
      const a = box('A', 0, 0);
      const b = box('B', 2000, 0);
      const { element, plan } = setup(roomWith([a, b]));
      const groups = element.querySelectorAll('.container');
      expect(groups[0].getAttribute('role')).toBe('button');
      expect(groups[0].getAttribute('tabindex')).toBe('0');
      expect(groups[0].getAttribute('aria-label')).toBe('A');

      groups[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(plan.selectedId()).toBe(a.id);
      groups[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(plan.selectedId()).toBe(b.id);
    });
  });

  describe('drag from the toolbox', () => {
    it('shows no shadow before a drag', () => {
      const { element } = setup(roomWith([]));
      expect(shadow(element)).toBeNull();
    });

    it('shows a green shadow at the real size, centered under the pointer', () => {
      const { fixture, element } = setup(roomWith([]));
      dragTo(element, 2000, 1500);
      fixture.detectChanges();
      const rect = element.querySelector('.shadow-rect') as SVGElement;
      // Top-left = pointer - half the footprint, snapped to whole inches: 1612.5 -> 1600, 1239.5 -> 1245.
      expect(rect.getAttribute('x')).toBe('1600');
      expect(rect.getAttribute('y')).toBe('1245');
      expect(rect.getAttribute('width')).toBe(String(W));
      expect(rect.getAttribute('height')).toBe(String(D));
      expect(shadow(element)?.classList.contains('shadow-valid')).toBe(true);
      expect(shadowText(element)).toBe('Valid');
      expect(element.querySelectorAll('.shadow-cross').length).toBe(0);
    });

    it('turns red, with a cross and the word "Overlaps", over another container', () => {
      const { fixture, element } = setup(roomWith([box('A', 1500, 1200)]));
      dragTo(element, 2000, 1500);
      fixture.detectChanges();
      expect(shadow(element)?.classList.contains('shadow-invalid')).toBe(true);
      expect(shadow(element)?.classList.contains('shadow-valid')).toBe(false);
      expect(shadowText(element)).toBe('Overlaps');
      expect(element.querySelectorAll('.shadow-cross').length).toBe(2);
    });

    it('turns red with "Outside room" when the footprint would leave the walls', () => {
      const { fixture, element } = setup(roomWith([]));
      dragTo(element, 100, 100); // the top-left corner would be at a negative position
      fixture.detectChanges();
      expect(shadow(element)?.classList.contains('shadow-invalid')).toBe(true);
      expect(shadowText(element)).toBe('Outside room');
      expect(element.querySelectorAll('.shadow-cross').length).toBe(2);
    });

    it('stays green right next to another container and against the top wall', () => {
      const { fixture, element } = setup(roomWith([box('A', 0, 0)]));
      // The top-left corner snaps to x = 787 (just right of A, which ends at 775) and y = 0.
      dragTo(element, W + W / 2, D / 2);
      fixture.detectChanges();
      expect(shadowText(element)).toBe('Valid');
    });

    it('follows the pointer while it moves', () => {
      const { fixture, element } = setup(roomWith([]));
      dragTo(element, 2000, 1500);
      pointer(tile(element), 'pointermove', 2500, 1500);
      fixture.detectChanges();
      const x = Number((element.querySelector('.shadow-rect') as SVGElement).getAttribute('x'));
      expect(x).toBeGreaterThan(1600);
    });

    it('creates the container at the snapped position when dropped on green', () => {
      const { fixture, element, added } = setup(roomWith([]));
      dragTo(element, 2000, 1500);
      pointer(tile(element), 'pointerup', 2000, 1500);
      fixture.detectChanges();
      expect(added).toHaveBeenCalledTimes(1);
      expect(added).toHaveBeenCalledWith({
        typeId: TOUGH_BOX_27_GAL.id,
        xMm: 1600,
        yMm: 1245,
      });
      expect(shadow(element)).toBeNull();
    });

    it('creates nothing when dropped on red (overlap)', () => {
      const { fixture, element, added } = setup(roomWith([box('A', 1500, 1200)]));
      dragTo(element, 2000, 1500);
      pointer(tile(element), 'pointerup', 2000, 1500);
      fixture.detectChanges();
      expect(added).not.toHaveBeenCalled();
      expect(shadow(element)).toBeNull();
    });

    it('creates nothing when dropped on red (outside the room)', () => {
      const { fixture, element, added } = setup(roomWith([]));
      dragTo(element, 100, 100);
      pointer(tile(element), 'pointerup', 100, 100);
      fixture.detectChanges();
      expect(added).not.toHaveBeenCalled();
    });

    it('creates nothing when dropped far outside the plan', () => {
      const { fixture, element, added } = setup(roomWith([]));
      dragTo(element, 90000, 90000);
      pointer(tile(element), 'pointerup', 90000, 90000);
      fixture.detectChanges();
      expect(added).not.toHaveBeenCalled();
    });

    it('removes the shadow and creates nothing when the drag is cancelled', () => {
      const { fixture, element, added } = setup(roomWith([]));
      dragTo(element, 2000, 1500);
      fixture.detectChanges();
      expect(shadow(element)).not.toBeNull();
      pointer(tile(element), 'pointercancel', 2000, 1500);
      fixture.detectChanges();
      expect(shadow(element)).toBeNull();
      expect(added).not.toHaveBeenCalled();
    });
  });

  describe('tap on a tile', () => {
    it('places the container in the top-left corner of an empty room', () => {
      const { element, added } = setup(roomWith([]));
      tile(element).click();
      expect(added).toHaveBeenCalledWith({ typeId: TOUGH_BOX_27_GAL.id, xMm: 0, yMm: 0 });
    });

    it('places it in the first free spot, scanning in 1 ft steps', () => {
      const { element, added } = setup(roomWith([box('A', 0, 0)]));
      tile(element).click();
      expect(added).toHaveBeenCalledWith({
        typeId: TOUGH_BOX_27_GAL.id,
        xMm: feetToMm(3),
        yMm: 0,
      });
    });

    it('goes to the next row when the first row is full', () => {
      const row = [0, 3, 6, 9].map((ft) => box('R', feetToMm(ft), 0));
      const { element, added } = setup(roomWith(row));
      tile(element).click();
      expect(added).toHaveBeenCalledWith({
        typeId: TOUGH_BOX_27_GAL.id,
        xMm: 0,
        yMm: feetToMm(2),
      });
    });

    it('shows a clear message and creates nothing when there is no free space', () => {
      const full = [box('A', 0, 0), box('B', 0, D), box('C', 0, 2 * D)];
      const { fixture, element, added } = setup(
        roomWith(full, { widthMm: feetToMm(4), depthMm: feetToMm(4) }),
      );
      expect(element.querySelector('.notice')?.textContent?.trim()).toBe('');
      tile(element).click();
      fixture.detectChanges();
      expect(added).not.toHaveBeenCalled();
      expect(element.querySelector('.notice')?.textContent).toContain('no free space');
      expect(element.querySelector('.notice')?.getAttribute('role')).toBe('status');
    });

    it('clears the message after a tap that finds a spot', () => {
      const full = [box('A', 0, 0), box('B', 0, D), box('C', 0, 2 * D)];
      const { fixture, element } = setup(
        roomWith(full, { widthMm: feetToMm(4), depthMm: feetToMm(4) }),
      );
      tile(element).click();
      fixture.detectChanges();
      expect(element.querySelector('.notice')?.textContent).toContain('no free space');

      fixture.componentRef.setInput('room', roomWith([], { widthMm: feetToMm(12), depthMm: feetToMm(10) }));
      tile(element).click();
      fixture.detectChanges();
      expect(element.querySelector('.notice')?.textContent?.trim()).toBe('');
    });
  });

  describe('resizing the room with containers inside', () => {
    it('stops the dragged corner at the outer limit of the containers (rounded up to an inch)', () => {
      // The box at 2000,1500 ends at 2775 x 2021 mm: the room cannot be smaller than 2794 x 2032 mm.
      const { fixture, element, resized } = setup(roomWith([box('A', 2000, 1500)]));
      const corner = element.querySelector('.hit-corner') as SVGElement;
      pointer(corner, 'pointerdown', 3658, 3048);
      pointer(corner, 'pointermove', 500, 500);
      fixture.detectChanges();
      expect(element.querySelector('.size-text')?.textContent?.trim()).toBe(
        'Size: 9 ft 2 in × 6 ft 8 in',
      );
      pointer(corner, 'pointerup', 500, 500);
      expect(resized).toHaveBeenCalledWith({ widthMm: 2794, depthMm: 2032 });
    });

    it('still lets the room grow', () => {
      const { element, resized } = setup(roomWith([box('A', 2000, 1500)]));
      const corner = element.querySelector('.hit-corner') as SVGElement;
      pointer(corner, 'pointerdown', 3658, 3048);
      pointer(corner, 'pointerup', feetToMm(20), feetToMm(15));
      expect(resized).toHaveBeenCalledWith({ widthMm: feetToMm(20), depthMm: feetToMm(15) });
    });
  });
});

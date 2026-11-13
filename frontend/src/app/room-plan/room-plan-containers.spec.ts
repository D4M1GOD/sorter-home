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
    const moved = vi.fn();
    const resized = vi.fn();
    fixture.componentInstance.containerAdded.subscribe(added);
    fixture.componentInstance.containerMoved.subscribe(moved);
    fixture.componentInstance.resized.subscribe(resized);
    return { fixture, element, svg, added, moved, resized, plan: fixture.componentInstance };
  }

  function pointer(
    target: Element,
    type: string,
    x: number,
    y: number,
    pointerType: 'mouse' | 'touch' = 'mouse',
  ): void {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
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

    describe('a rotated container', () => {
      const upright = { ...box('A', 100, 200), id: 'a' };
      const turned = { ...upright, rotation: 90 as const };

      const num = (element: Element | null, name: string) => Number(element?.getAttribute(name));

      function bodyAndLid(element: HTMLElement) {
        return {
          body: element.querySelector('.container-body'),
          lid: element.querySelector('rect.container-lid'),
          lines: Array.from(element.querySelectorAll('line.container-lid')),
        };
      }

      it('has the same corner radius as the upright container, on the body and on the lid', () => {
        const a = bodyAndLid(setup(roomWith([upright])).element);
        const b = bodyAndLid(setup(roomWith([turned])).element);
        expect(num(b.body, 'rx')).toBeGreaterThan(0);
        expect(num(b.body, 'rx')).toBeCloseTo(num(a.body, 'rx'), 6);
        expect(num(b.lid, 'rx')).toBeCloseTo(num(a.lid, 'rx'), 6);
      });

      it('has the same lid margin as the upright container', () => {
        const a = bodyAndLid(setup(roomWith([upright])).element);
        const b = bodyAndLid(setup(roomWith([turned])).element);
        const margin = (r: ReturnType<typeof bodyAndLid>) => ({
          x: num(r.lid, 'x') - num(r.body, 'x'),
          y: num(r.lid, 'y') - num(r.body, 'y'),
        });
        expect(margin(b).x).toBeGreaterThan(0);
        expect(margin(b).x).toBeCloseTo(margin(a).x, 6);
        expect(margin(b).y).toBeCloseTo(margin(a).y, 6);
        // The lid is smaller than the body by the same margin on every side.
        expect(num(b.body, 'width') - num(b.lid, 'width')).toBeCloseTo(2 * margin(b).x, 6);
        expect(num(b.body, 'height') - num(b.lid, 'height')).toBeCloseTo(2 * margin(b).y, 6);
      });

      it('draws two horizontal lid lines at 22% and 78% of the lid depth when upright', () => {
        const { lid, lines } = bodyAndLid(setup(roomWith([upright])).element);
        expect(lines.length).toBe(2);
        const top = num(lid, 'y');
        const depth = num(lid, 'height');
        for (const [i, fraction] of [0.22, 0.78].entries()) {
          expect(num(lines[i], 'y1')).toBeCloseTo(top + depth * fraction, 6);
          expect(num(lines[i], 'y2')).toBeCloseTo(num(lines[i], 'y1'), 6);
          expect(num(lines[i], 'x1')).toBeCloseTo(num(lid, 'x'), 6);
          expect(num(lines[i], 'x2')).toBeCloseTo(num(lid, 'x') + num(lid, 'width'), 6);
        }
      });

      it('turns the two lid lines vertical at 22% and 78% of the lid width', () => {
        const { lid, lines } = bodyAndLid(setup(roomWith([turned])).element);
        expect(lines.length).toBe(2);
        const left = num(lid, 'x');
        const width = num(lid, 'width');
        for (const [i, fraction] of [0.22, 0.78].entries()) {
          expect(num(lines[i], 'x1')).toBeCloseTo(left + width * fraction, 6);
          expect(num(lines[i], 'x2')).toBeCloseTo(num(lines[i], 'x1'), 6);
          expect(num(lines[i], 'y1')).toBeCloseTo(num(lid, 'y'), 6);
          expect(num(lines[i], 'y2')).toBeCloseTo(num(lid, 'y') + num(lid, 'height'), 6);
        }
      });

      it('keeps the lid lines at the same distance from the lid edge as the upright one', () => {
        const a = bodyAndLid(setup(roomWith([upright])).element);
        const b = bodyAndLid(setup(roomWith([turned])).element);
        // Upright: distance from the top edge of the lid. Turned: distance from its left edge.
        expect(num(b.lines[0], 'x1') - num(b.lid, 'x')).toBeCloseTo(
          num(a.lines[0], 'y1') - num(a.lid, 'y'),
          6,
        );
        expect(num(b.lines[1], 'x1') - num(b.lid, 'x')).toBeCloseTo(
          num(a.lines[1], 'y1') - num(a.lid, 'y'),
          6,
        );
      });

      it('keeps the name horizontal', () => {
        const { element } = setup(roomWith([turned]));
        const name = element.querySelector('.container-name');
        expect(name?.getAttribute('transform')).toBeNull();
        expect(name?.textContent?.trim()).toBe('A');
      });
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

    it('turns red, with a cross and the word "Overlaps", when the footprints overlap but the pointer is not on the container', () => {
      // A covers x 1500..2275: the pointer at 2400 is outside it, but the shadow (x 2007..2782) overlaps it.
      const { fixture, element } = setup(roomWith([box('A', 1500, 1200)]));
      dragTo(element, 2400, 1500);
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
      dragTo(element, 2400, 1500);
      pointer(tile(element), 'pointerup', 2400, 1500);
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

  describe('moving a container', () => {
    // A is on whole inches (63 in, 49 in). The pointer holds it 100 mm right and 55 mm below its corner.
    const a = { ...box('A', 1600, 1245), id: 'a' };
    const b = { ...box('B', 2000, 1245), id: 'b' };
    const grab = { x: 1700, y: 1300 };

    function group(element: HTMLElement, index = 0): Element {
      return element.querySelectorAll('.container')[index];
    }

    function shadowRect(element: HTMLElement): { x: string | null; y: string | null } {
      const rect = element.querySelector('.shadow-rect');
      return { x: rect?.getAttribute('x') ?? null, y: rect?.getAttribute('y') ?? null };
    }

    /** Presses the container and moves far enough (more than 6 px) to start a drag. */
    function dragA(element: HTMLElement, x: number, y: number): Element {
      const target = group(element);
      pointer(target, 'pointerdown', grab.x, grab.y);
      pointer(target, 'pointermove', x, y);
      return target;
    }

    it('does not start a drag before the pointer moves 6 px', () => {
      const { fixture, element, moved } = setup(roomWith([a]));
      const target = group(element);
      pointer(target, 'pointerdown', grab.x, grab.y);
      pointer(target, 'pointermove', grab.x + 4, grab.y + 3); // 5 px
      fixture.detectChanges();
      expect(shadow(element)).toBeNull();
      expect(target.classList.contains('moving')).toBe(false);
      pointer(target, 'pointerup', grab.x + 4, grab.y + 3);
      expect(moved).not.toHaveBeenCalled();
    });

    it('still selects with a plain click', () => {
      const { fixture, element, plan } = setup(roomWith([a]));
      const target = group(element);
      pointer(target, 'pointerdown', grab.x, grab.y);
      pointer(target, 'pointerup', grab.x, grab.y);
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(plan.selectedId()).toBe(a.id);
    });

    it('shows a green shadow at the snapped place, keeping the grab offset', () => {
      const { fixture, element } = setup(roomWith([a]));
      dragA(element, 2500, 1300);
      fixture.detectChanges();
      // 2500 - 100 = 2400 mm = 94.49 in -> 94 in = 2388 mm. The corner follows the pointer: no jump.
      expect(shadowRect(element)).toEqual({ x: '2388', y: '1245' });
      expect(shadow(element)?.classList.contains('shadow-valid')).toBe(true);
      expect(shadowText(element)).toBe('Valid');
      expect(element.querySelectorAll('.shadow-cross').length).toBe(0);
    });

    it('shadow has the real size of the container', () => {
      const { fixture, element } = setup(roomWith([a]));
      dragA(element, 2500, 1300);
      fixture.detectChanges();
      const rect = element.querySelector('.shadow-rect') as SVGElement;
      expect(rect.getAttribute('width')).toBe(String(W));
      expect(rect.getAttribute('height')).toBe(String(D));
    });

    it('keeps the real container in place and dimmed while dragging', () => {
      const { fixture, element } = setup(roomWith([a]));
      dragA(element, 2500, 1300);
      fixture.detectChanges();
      expect(group(element).classList.contains('moving')).toBe(true);
      expect(element.querySelector('.container-body')?.getAttribute('x')).toBe('1600');
      expect(element.querySelector('.container-body')?.getAttribute('y')).toBe('1245');
    });

    it('selects the container when the drag starts', () => {
      const { fixture, element, plan } = setup(roomWith([a, b]));
      expect(plan.selectedId()).toBeNull();
      dragA(element, 2500, 1300);
      fixture.detectChanges();
      expect(plan.selectedId()).toBe(a.id);
      expect(group(element).classList.contains('selected')).toBe(true);
    });

    it('uses the rotated footprint for the shadow of a rotated container', () => {
      const rotated = { ...a, rotation: 90 as const };
      const { fixture, element } = setup(roomWith([rotated]));
      dragA(element, 2500, 1300);
      fixture.detectChanges();
      const rect = element.querySelector('.shadow-rect') as SVGElement;
      expect(rect.getAttribute('width')).toBe(String(D));
      expect(rect.getAttribute('height')).toBe(String(W));
    });

    it('emits the new place when dropped on green', () => {
      const { fixture, element, moved } = setup(roomWith([a]));
      const target = dragA(element, 2500, 1300);
      pointer(target, 'pointerup', 2500, 1300);
      fixture.detectChanges();
      expect(moved).toHaveBeenCalledTimes(1);
      expect(moved).toHaveBeenCalledWith({ id: 'a', xMm: 2388, yMm: 1245 });
      expect(shadow(element)).toBeNull();
      expect(group(element).classList.contains('moving')).toBe(false);
    });

    it('can be dropped over its own old place', () => {
      const { element, moved } = setup(roomWith([a]));
      const target = dragA(element, 1800, 1300); // 100 mm to the right: 1700 mm = 66.9 in -> 67 in
      pointer(target, 'pointerup', 1800, 1300);
      expect(moved).toHaveBeenCalledWith({ id: 'a', xMm: 1702, yMm: 1245 });
    });

    it('can be dropped against the walls', () => {
      const { fixture, element, moved } = setup(roomWith([a, b]));
      // Corner = pointer - grab offset: the corner goes to x = 0 (left wall), y = 0 (top wall).
      const target = dragA(element, 100, 55);
      fixture.detectChanges();
      expect(shadowText(element)).toBe('Valid');
      pointer(target, 'pointerup', 100, 55);
      expect(moved).toHaveBeenCalledWith({ id: 'a', xMm: 0, yMm: 0 });
    });

    it('emits nothing when it is dropped on the same place', () => {
      const { element, moved } = setup(roomWith([a]));
      const target = dragA(element, grab.x + 10, grab.y); // 10 px, but the corner snaps back to 1600
      pointer(target, 'pointerup', grab.x + 10, grab.y);
      expect(moved).not.toHaveBeenCalled();
    });

    it('turns red, with a cross and "Overlaps", over another container, and drops nothing', () => {
      const { fixture, element, moved } = setup(roomWith([a, b]));
      // The corner would be at x = 2700 and overlaps B (x 2000..2775), but the pointer (2800) is outside B.
      const target = dragA(element, 2800, 1300);
      fixture.detectChanges();
      expect(shadow(element)?.classList.contains('shadow-invalid')).toBe(true);
      expect(shadowText(element)).toBe('Overlaps');
      expect(element.querySelectorAll('.shadow-cross').length).toBe(2);
      pointer(target, 'pointerup', 2800, 1300);
      fixture.detectChanges();
      expect(moved).not.toHaveBeenCalled();
      expect(shadow(element)).toBeNull();
      // The container is where it was.
      expect(element.querySelector('.container-body')?.getAttribute('x')).toBe('1600');
    });

    it('turns red with "Outside room" when the corner would leave the walls, and drops nothing', () => {
      const { fixture, element, moved } = setup(roomWith([a]));
      const target = dragA(element, 50, 50);
      fixture.detectChanges();
      expect(shadowText(element)).toBe('Outside room');
      expect(element.querySelectorAll('.shadow-cross').length).toBe(2);
      pointer(target, 'pointerup', 50, 50);
      expect(moved).not.toHaveBeenCalled();
    });

    it('drops nothing when released far outside the plan', () => {
      const { element, moved } = setup(roomWith([a]));
      const target = dragA(element, 90000, 90000);
      pointer(target, 'pointerup', 90000, 90000);
      expect(moved).not.toHaveBeenCalled();
    });

    it('drops nothing and removes the shadow when the browser cancels the gesture', () => {
      const { fixture, element, moved } = setup(roomWith([a]));
      const target = dragA(element, 2500, 1300);
      pointer(target, 'pointercancel', 2500, 1300);
      fixture.detectChanges();
      expect(shadow(element)).toBeNull();
      expect(group(element).classList.contains('moving')).toBe(false);
      expect(moved).not.toHaveBeenCalled();
    });

    it('drops nothing when the container loses the pointer', () => {
      const { fixture, element, moved } = setup(roomWith([a]));
      const target = dragA(element, 2500, 1300);
      pointer(target, 'lostpointercapture', 2500, 1300);
      fixture.detectChanges();
      expect(shadow(element)).toBeNull();
      expect(moved).not.toHaveBeenCalled();
    });

    describe('Escape', () => {
      function escape(): void {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }

      it('cancels a drag in progress: no shadow, nothing saved when the pointer is released', () => {
        const { fixture, element, moved } = setup(roomWith([a]));
        const target = dragA(element, 2500, 1300);
        fixture.detectChanges();
        expect(shadow(element)).not.toBeNull();

        escape();
        fixture.detectChanges();
        expect(shadow(element)).toBeNull();
        expect(group(element).classList.contains('moving')).toBe(false);

        pointer(target, 'pointermove', 3000, 1300); // the same gesture cannot bring it back
        fixture.detectChanges();
        expect(shadow(element)).toBeNull();
        pointer(target, 'pointerup', 3000, 1300);
        expect(moved).not.toHaveBeenCalled();
      });

      it('does nothing when no drag is in progress', () => {
        const { fixture, element, plan } = setup(roomWith([a]));
        plan.selectedId.set(a.id);
        escape();
        fixture.detectChanges();
        expect(plan.selectedId()).toBe(a.id);
        expect(shadow(element)).toBeNull();
      });

      it('lets the next drag work normally', () => {
        const { element, moved } = setup(roomWith([a]));
        const target = dragA(element, 2500, 1300);
        escape();
        pointer(target, 'pointerup', 2500, 1300);
        const again = dragA(element, 2500, 1300);
        pointer(again, 'pointerup', 2500, 1300);
        expect(moved).toHaveBeenCalledTimes(1);
      });
    });

    // jsdom cannot check that the browser keeps the gesture (touch-action on the <svg>): that is
    // tested by hand. These tests check that touch pointers go through the same logic as the mouse.
    describe('with a finger (touch pointer)', () => {
      it('moves a container, with the shadow while dragging and the new place on release', () => {
        const { fixture, element, moved } = setup(roomWith([a]));
        const target = group(element);
        pointer(target, 'pointerdown', grab.x, grab.y, 'touch');
        pointer(target, 'pointermove', 2500, 1300, 'touch');
        fixture.detectChanges();
        expect(shadowRect(element)).toEqual({ x: '2388', y: '1245' });
        expect(shadowText(element)).toBe('Valid');
        pointer(target, 'pointerup', 2500, 1300, 'touch');
        expect(moved).toHaveBeenCalledWith({ id: 'a', xMm: 2388, yMm: 1245 });
      });

      it('selects a container with a tap', () => {
        const { fixture, element, plan, moved } = setup(roomWith([a]));
        const target = group(element);
        pointer(target, 'pointerdown', grab.x, grab.y, 'touch');
        pointer(target, 'pointerup', grab.x, grab.y, 'touch');
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(plan.selectedId()).toBe(a.id);
        expect(moved).not.toHaveBeenCalled();
      });

      it('drops nothing on red', () => {
        const { element, moved } = setup(roomWith([a, b]));
        const target = group(element);
        pointer(target, 'pointerdown', grab.x, grab.y, 'touch');
        pointer(target, 'pointermove', 2800, 1300, 'touch'); // the corner overlaps B, the pointer does not
        pointer(target, 'pointerup', 2800, 1300, 'touch');
        expect(moved).not.toHaveBeenCalled();
      });

      it('discards the drag when the browser cancels it, like it does when it takes it as a scroll', () => {
        const { fixture, element, moved } = setup(roomWith([a]));
        const target = group(element);
        pointer(target, 'pointerdown', grab.x, grab.y, 'touch');
        pointer(target, 'pointermove', 2500, 1300, 'touch');
        pointer(target, 'pointercancel', 2500, 1300, 'touch');
        fixture.detectChanges();
        expect(shadow(element)).toBeNull();
        expect(moved).not.toHaveBeenCalled();
      });
    });

    it('ignores the click that the browser sends right after a drag', () => {
      const { fixture, element, plan } = setup(roomWith([a]));
      const target = dragA(element, 2500, 1300);
      pointer(target, 'pointerup', 2500, 1300);
      plan.selectedId.set(null);
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(plan.selectedId()).toBeNull(); // the click after the drag was skipped
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(plan.selectedId()).toBe(a.id); // the next click selects as usual
    });

    it('ignores a press with the right mouse button', () => {
      const { fixture, element, moved } = setup(roomWith([a]));
      const target = group(element);
      const down = new MouseEvent('pointerdown', {
        clientX: grab.x,
        clientY: grab.y,
        button: 2,
        bubbles: true,
      });
      Object.defineProperty(down, 'pointerId', { value: 1 });
      Object.defineProperty(down, 'pointerType', { value: 'mouse' });
      target.dispatchEvent(down);
      pointer(target, 'pointermove', 2500, 1300);
      fixture.detectChanges();
      expect(shadow(element)).toBeNull();
      pointer(target, 'pointerup', 2500, 1300);
      expect(moved).not.toHaveBeenCalled();
    });

    it('drops the move when the container was rotated during the drag', () => {
      const { fixture, element, moved } = setup(roomWith([a]));
      const target = dragA(element, 2500, 1300);
      fixture.componentRef.setInput('room', roomWith([{ ...a, rotation: 90 }]));
      fixture.detectChanges();
      pointer(target, 'pointerup', 2500, 1300);
      expect(moved).not.toHaveBeenCalled();
    });

    it('does not change the size of the name when the container is rotated', () => {
      const upright = setup(roomWith([a]));
      const turned = setup(roomWith([{ ...a, rotation: 90 }]));
      const size = (element: HTMLElement) =>
        element.querySelector('.container-name')?.getAttribute('font-size');
      expect(size(turned.element)).toBe(size(upright.element));
    });
  });

  describe('stacks', () => {
    // A stack of two at (2000, 1000) (x 2000..2775, y 1000..1521) and a container X alone.
    const bottom = { ...box('Bottom', 2000, 1000), id: 'bottom', stackPosition: 0 };
    const top = { ...box('Top', 2000, 1000), id: 'top', stackPosition: 1 };
    const third = { ...box('Third', 2000, 1000), id: 'third', stackPosition: 2 };
    const x = { ...box('X', 500, 500), id: 'x' };

    const num = (element: Element | null, name: string) => Number(element?.getAttribute(name));

    function byLabel(element: HTMLElement, label: string): Element {
      return element.querySelector(`.container[aria-label="${label}"]`) as Element;
    }

    function shadowLines(element: HTMLElement): string[] {
      return Array.from(element.querySelectorAll('.shadow-text tspan')).map(
        (t) => t.textContent?.trim() ?? '',
      );
    }

    function shadowClass(element: HTMLElement): string {
      const g = shadow(element);
      return ['shadow-valid', 'shadow-invalid', 'shadow-stack']
        .filter((c) => g?.classList.contains(c))
        .join(' ');
    }

    describe('drawing', () => {
      it('draws only the top container of a stack, with its name', () => {
        const { element } = setup(roomWith([bottom, top, x]));
        expect(element.querySelectorAll('.container').length).toBe(2); // the stack and X
        const names = Array.from(element.querySelectorAll('.container-name')).map((n) =>
          n.textContent?.trim(),
        );
        expect(names).toEqual(['Top', 'X']);
      });

      it('shows the number of containers in a badge, as text', () => {
        const { element } = setup(roomWith([bottom, top, third, x]));
        const badges = element.querySelectorAll('.stack-badge-text');
        expect(badges.length).toBe(1); // none for X, which is alone
        expect(badges[0].textContent?.trim()).toBe('x3');
        expect(byLabel(element, 'Third, stack of 3').querySelector('.stack-badge')).not.toBeNull();
        expect(byLabel(element, 'X').querySelector('.stack-badge')).toBeNull();
      });

      it('draws the badge inside the footprint of the stack', () => {
        const { element } = setup(roomWith([bottom, top]));
        const badge = element.querySelector('.stack-badge');
        const body = element.querySelector('.container-body');
        expect(num(badge, 'x')).toBeGreaterThanOrEqual(num(body, 'x'));
        expect(num(badge, 'x') + num(badge, 'width')).toBeLessThanOrEqual(
          num(body, 'x') + num(body, 'width'),
        );
        expect(num(badge, 'y')).toBeGreaterThanOrEqual(num(body, 'y'));
        expect(num(badge, 'y') + num(badge, 'height')).toBeLessThanOrEqual(
          num(body, 'y') + num(body, 'height'),
        );
      });

      it('draws a rotated stack with the rotated footprint and the badge inside it', () => {
        const turned = [bottom, top].map((c) => ({ ...c, rotation: 90 as const }));
        const { element } = setup(roomWith(turned));
        const body = element.querySelector('.container-body');
        expect(num(body, 'width')).toBe(D);
        expect(num(body, 'height')).toBe(W);
        const badge = element.querySelector('.stack-badge');
        expect(num(badge, 'x') + num(badge, 'width')).toBeLessThanOrEqual(num(body, 'x') + D);
      });

      it('names the stack for assistive technology', () => {
        const { element } = setup(roomWith([bottom, top]));
        const group = byLabel(element, 'Top, stack of 2');
        expect(group).not.toBeNull();
        expect(group.querySelector('title')?.textContent).toBe('Top, stack of 2');
      });

      it('draws a container that is alone as before: no badge, plain name', () => {
        const { element } = setup(roomWith([x]));
        expect(element.querySelector('.stack-badge')).toBeNull();
        expect(byLabel(element, 'X')).not.toBeNull();
      });

      it('keeps the name, lid margin and lines of the top container', () => {
        const { element } = setup(roomWith([bottom, top]));
        expect(element.querySelectorAll('line.container-lid').length).toBe(2);
      });
    });

    describe('selecting', () => {
      it('selects the container on top when the stack is clicked', () => {
        const { fixture, element, plan } = setup(roomWith([bottom, top]));
        byLabel(element, 'Top, stack of 2').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(plan.selectedId()).toBe('top');
      });

      it('selects the container on top with the keyboard', () => {
        const { element, plan } = setup(roomWith([bottom, top]));
        byLabel(element, 'Top, stack of 2').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        expect(plan.selectedId()).toBe('top');
      });

      it('shows the selected outline on the stack when a hidden container is selected', () => {
        const { fixture, element, plan } = setup(roomWith([bottom, top, x]));
        plan.selectedId.set('bottom');
        fixture.detectChanges();
        const group = byLabel(element, 'Top, stack of 2');
        expect(group.classList.contains('selected')).toBe(true);
        expect(group.getAttribute('aria-pressed')).toBe('true');
        expect(byLabel(element, 'X').classList.contains('selected')).toBe(false);
      });
    });

    describe('dragging a stack of several containers', () => {
      it('moves the whole stack: it emits the top container with the new place', () => {
        const { fixture, element, moved } = setup(roomWith([bottom, top]));
        const group = byLabel(element, 'Top, stack of 2');
        pointer(group, 'pointerdown', 2100, 1100); // grab offset (100, 100)
        pointer(group, 'pointermove', 1100, 2100);
        fixture.detectChanges();
        expect(shadowClass(element)).toBe('shadow-valid');
        expect(shadowText(element)).toBe('Valid');
        expect(group.classList.contains('moving')).toBe(true);
        pointer(group, 'pointerup', 1100, 2100);
        // The corner is (1000, 2000) mm, snapped to whole inches: 39 in = 991 mm and 79 in = 2007 mm.
        expect(moved).toHaveBeenCalledWith({ id: 'top', xMm: 991, yMm: 2007 });
      });

      it('can be dropped over its own old place, because its own containers do not count', () => {
        const { element, moved } = setup(roomWith([bottom, top]));
        const group = byLabel(element, 'Top, stack of 2');
        pointer(group, 'pointerdown', 2100, 1100);
        pointer(group, 'pointermove', 2300, 1100);
        pointer(group, 'pointerup', 2300, 1100);
        // The corner (2200, 1000) snaps to 87 in = 2210 mm and 39 in = 991 mm.
        expect(moved).toHaveBeenCalledWith({ id: 'top', xMm: 2210, yMm: 991 });
      });

      it('is blocked, in red, with an explanation, when the pointer is on another container', () => {
        const { fixture, element, moved } = setup(roomWith([x, bottom, top]));
        const group = byLabel(element, 'Top, stack of 2');
        pointer(group, 'pointerdown', 2100, 1100);
        pointer(group, 'pointermove', 600, 600); // the pointer is on X (x 500..1275, y 500..1021)
        fixture.detectChanges();
        expect(shadowClass(element)).toBe('shadow-invalid');
        expect(shadowLines(element)).toEqual(["Can't place a stack", 'on a container']);
        expect(element.querySelectorAll('.shadow-cross').length).toBe(2);
        pointer(group, 'pointerup', 600, 600);
        fixture.detectChanges();
        expect(moved).not.toHaveBeenCalled();
        expect(shadow(element)).toBeNull();
      });

      it('is red (overlap) when the footprints overlap but the pointer is not on the container', () => {
        const { fixture, element, moved } = setup(roomWith([x, bottom, top]));
        const group = byLabel(element, 'Top, stack of 2');
        pointer(group, 'pointerdown', 2100, 1100);
        // The corner (1200, 600) overlaps X (x 500..1275); the pointer (x 1300) is outside X.
        pointer(group, 'pointermove', 1300, 700);
        fixture.detectChanges();
        expect(shadowClass(element)).toBe('shadow-invalid');
        expect(shadowText(element)).toBe('Overlaps');
        pointer(group, 'pointerup', 1300, 700);
        expect(moved).not.toHaveBeenCalled();
      });
    });

    describe('dropping a container on a stack (moving it)', () => {
      function startDrag(element: HTMLElement, x1: number, y1: number, pointerType: 'mouse' | 'touch' = 'mouse') {
        const group = byLabel(element, 'X');
        pointer(group, 'pointerdown', 600, 600, pointerType); // grab offset (100, 100)
        pointer(group, 'pointermove', x1, y1, pointerType);
        return group;
      }

      it('shows a blue shadow at the place of the stack, with the text "Stack on <name>" and "Level N"', () => {
        const { fixture, element } = setup(roomWith([x, bottom, top]));
        startDrag(element, 2200, 1200); // the pointer is inside the stack
        fixture.detectChanges();
        expect(shadowClass(element)).toBe('shadow-stack');
        expect(shadowLines(element)).toEqual(['Stack on Top', 'Level 3']);
        const rect = element.querySelector('.shadow-rect');
        expect([num(rect, 'x'), num(rect, 'y'), num(rect, 'width'), num(rect, 'height')]).toEqual([
          2000, 1000, W, D,
        ]);
        expect(element.querySelectorAll('.shadow-cross').length).toBe(0);
      });

      it('gives the level that the container would have in a taller stack', () => {
        const { fixture, element } = setup(roomWith([x, bottom, top, third]));
        startDrag(element, 2200, 1200);
        fixture.detectChanges();
        expect(shadowLines(element)).toEqual(['Stack on Third', 'Level 4']);
      });

      it('shortens a long name so the text fits', () => {
        const longTop = { ...top, name: 'A very long container name that cannot fit' };
        const { fixture, element } = setup(roomWith([x, bottom, longTop]));
        startDrag(element, 2200, 1200);
        fixture.detectChanges();
        const [first] = shadowLines(element);
        expect(first.startsWith('Stack on A very')).toBe(true);
        expect(first.endsWith('…')).toBe(true);
        expect(first.length).toBeLessThanOrEqual(20);
      });

      it('uses the position and the rotation of a rotated stack', () => {
        const turned = [bottom, top].map((c) => ({ ...c, rotation: 90 as const }));
        const { fixture, element } = setup(roomWith([x, ...turned]));
        startDrag(element, 2200, 1200);
        fixture.detectChanges();
        const rect = element.querySelector('.shadow-rect');
        expect([num(rect, 'width'), num(rect, 'height')]).toEqual([D, W]);
      });

      it('emits containerStacked when it is dropped on the stack, and does not move it', () => {
        const { fixture, element, plan } = setup(roomWith([x, bottom, top]));
        const stacked = vi.fn();
        const moved = vi.fn();
        plan.containerStacked.subscribe(stacked);
        plan.containerMoved.subscribe(moved);
        const group = startDrag(element, 2200, 1200);
        pointer(group, 'pointerup', 2200, 1200);
        fixture.detectChanges();
        expect(stacked).toHaveBeenCalledTimes(1);
        expect(stacked).toHaveBeenCalledWith({ id: 'x', targetId: 'top' });
        expect(moved).not.toHaveBeenCalled();
        expect(shadow(element)).toBeNull();
      });

      it('works with a finger too', () => {
        const { element, plan } = setup(roomWith([x, bottom, top]));
        const stacked = vi.fn();
        plan.containerStacked.subscribe(stacked);
        const group = startDrag(element, 2200, 1200, 'touch');
        pointer(group, 'pointerup', 2200, 1200, 'touch');
        expect(stacked).toHaveBeenCalledWith({ id: 'x', targetId: 'top' });
      });

      it('stays red, and does nothing, when the footprints overlap but the pointer is not inside', () => {
        const { fixture, element, plan, moved } = setup(roomWith([x, bottom, top]));
        const stacked = vi.fn();
        plan.containerStacked.subscribe(stacked);
        const group = startDrag(element, 2800, 1200); // corner (2700, 1100) overlaps the stack; the pointer does not
        fixture.detectChanges();
        expect(shadowClass(element)).toBe('shadow-invalid');
        expect(shadowText(element)).toBe('Overlaps');
        pointer(group, 'pointerup', 2800, 1200);
        expect(stacked).not.toHaveBeenCalled();
        expect(moved).not.toHaveBeenCalled();
      });

      it('is cancelled with Escape', () => {
        const { fixture, element, plan } = setup(roomWith([x, bottom, top]));
        const stacked = vi.fn();
        plan.containerStacked.subscribe(stacked);
        const group = startDrag(element, 2200, 1200);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        expect(shadow(element)).toBeNull();
        pointer(group, 'pointerup', 2200, 1200);
        expect(stacked).not.toHaveBeenCalled();
      });

      it('is dropped when the browser cancels the gesture', () => {
        const { fixture, element, plan } = setup(roomWith([x, bottom, top]));
        const stacked = vi.fn();
        plan.containerStacked.subscribe(stacked);
        const group = startDrag(element, 2200, 1200, 'touch');
        pointer(group, 'pointercancel', 2200, 1200, 'touch');
        fixture.detectChanges();
        expect(shadow(element)).toBeNull();
        expect(stacked).not.toHaveBeenCalled();
      });

      it('stacks a container on one that is alone, giving level 2', () => {
        const other = { ...box('Other', 2000, 1000), id: 'other' };
        const { fixture, element } = setup(roomWith([x, other]));
        startDrag(element, 2200, 1200);
        fixture.detectChanges();
        expect(shadowLines(element)).toEqual(['Stack on Other', 'Level 2']);
      });
    });

    describe('dropping a new container from the toolbox on a stack', () => {
      it('shows the blue shadow in the place of the stack', () => {
        const { fixture, element } = setup(roomWith([bottom, top]));
        dragTo(element, 2200, 1200);
        fixture.detectChanges();
        expect(shadowClass(element)).toBe('shadow-stack');
        expect(shadowLines(element)).toEqual(['Stack on Top', 'Level 3']);
        const rect = element.querySelector('.shadow-rect');
        expect([num(rect, 'x'), num(rect, 'y')]).toEqual([2000, 1000]);
      });

      it('emits containerAdded with the id of the container on top, and the place of the stack', () => {
        const { fixture, element, added } = setup(roomWith([bottom, top]));
        dragTo(element, 2200, 1200);
        pointer(tile(element), 'pointerup', 2200, 1200);
        fixture.detectChanges();
        expect(added).toHaveBeenCalledTimes(1);
        expect(added).toHaveBeenCalledWith({
          typeId: TOUGH_BOX_27_GAL.id,
          xMm: 2000,
          yMm: 1000,
          stackOnto: 'top',
        });
      });

      it('is a normal drop, without stackOnto, when the pointer is not on a container', () => {
        const { element, added } = setup(roomWith([bottom, top]));
        dragTo(element, 800, 600);
        pointer(tile(element), 'pointerup', 800, 600);
        expect(added).toHaveBeenCalledTimes(1);
        expect(added.mock.calls[0][0].stackOnto).toBeUndefined();
      });

      it('stays red when the footprints overlap but the pointer is not on the container', () => {
        const { fixture, element, added } = setup(roomWith([bottom, top]));
        dragTo(element, 2900, 1200); // the shadow (x 2512..3287) overlaps the stack; the pointer does not
        fixture.detectChanges();
        expect(shadowClass(element)).toBe('shadow-invalid');
        pointer(tile(element), 'pointerup', 2900, 1200);
        expect(added).not.toHaveBeenCalled();
      });

      it('does not stack when a tile is tapped, even with a container selected: it takes the first free spot', () => {
        const { fixture, element, added, plan } = setup(roomWith([bottom, top]));
        plan.selectedId.set('top');
        fixture.detectChanges();
        tile(element).click();
        expect(added).toHaveBeenCalledTimes(1);
        expect(added).toHaveBeenCalledWith({ typeId: TOUGH_BOX_27_GAL.id, xMm: 0, yMm: 0 });
        expect(added.mock.calls[0][0].stackOnto).toBeUndefined();
      });
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

  // As above: these check the logic with touch pointers, not the browser's touch-action handling.
  describe('resizing the room with a finger (touch pointer)', () => {
    const wide = feetToMm(12); // 3658
    const deep = feetToMm(10); // 3048

    it('resizes with the bottom-right corner', () => {
      const { fixture, element, resized } = setup(roomWith([]));
      const corner = element.querySelector('.hit-corner') as SVGElement;
      pointer(corner, 'pointerdown', wide, deep, 'touch');
      pointer(corner, 'pointermove', feetToMm(20), feetToMm(15), 'touch');
      fixture.detectChanges();
      expect(element.querySelector('.size-text')?.textContent?.trim()).toBe(
        'Size: 20 ft 0 in × 15 ft 0 in',
      );
      pointer(corner, 'pointerup', feetToMm(20), feetToMm(15), 'touch');
      expect(resized).toHaveBeenCalledWith({ widthMm: feetToMm(20), depthMm: feetToMm(15) });
    });

    it('resizes with the right edge, keeping the depth', () => {
      const { element, resized } = setup(roomWith([]));
      const edge = element.querySelector('.hit-right') as SVGElement;
      pointer(edge, 'pointerdown', wide, 1500, 'touch');
      pointer(edge, 'pointermove', feetToMm(20), 1500, 'touch');
      pointer(edge, 'pointerup', feetToMm(20), 1500, 'touch');
      expect(resized).toHaveBeenCalledWith({ widthMm: feetToMm(20), depthMm: deep });
    });

    it('resizes with the bottom edge, keeping the width', () => {
      const { element, resized } = setup(roomWith([]));
      const edge = element.querySelector('.hit-bottom') as SVGElement;
      pointer(edge, 'pointerdown', 1500, deep, 'touch');
      pointer(edge, 'pointermove', 1500, feetToMm(15), 'touch');
      pointer(edge, 'pointerup', 1500, feetToMm(15), 'touch');
      expect(resized).toHaveBeenCalledWith({ widthMm: wide, depthMm: feetToMm(15) });
    });

    it('discards the resize when the browser cancels the gesture', () => {
      const { fixture, element, resized } = setup(roomWith([]));
      const corner = element.querySelector('.hit-corner') as SVGElement;
      pointer(corner, 'pointerdown', wide, deep, 'touch');
      pointer(corner, 'pointermove', feetToMm(20), feetToMm(15), 'touch');
      pointer(corner, 'pointercancel', feetToMm(20), feetToMm(15), 'touch');
      fixture.detectChanges();
      expect(resized).not.toHaveBeenCalled();
      expect(element.querySelector('.size-text')?.textContent?.trim()).toBe(
        'Size: 12 ft 0 in × 10 ft 0 in',
      );
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

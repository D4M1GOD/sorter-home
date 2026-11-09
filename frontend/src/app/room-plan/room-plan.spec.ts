import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createRoom, ROOM_MAX_SIZE_MM } from '../core/room.model';
import { feetToMm } from '../core/units';
import { RoomPlan } from './room-plan';

/**
 * These tests simulate pointer events. jsdom has no real layout, so getScreenCTM is replaced
 * by an identity matrix: a pointer at clientX/clientY is exactly that many plan millimeters.
 * What jsdom cannot check (real mouse and touch, hit areas, cursors) must be tested by hand.
 */
describe('RoomPlan', () => {
  const room = createRoom('Garage'); // 12 ft x 10 ft = 3658 x 3048 mm

  function setup() {
    const fixture = TestBed.createComponent(RoomPlan);
    fixture.componentRef.setInput('room', room);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const svg = element.querySelector('svg') as SVGSVGElement;
    svg.getScreenCTM = () =>
      ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;
    const resized = vi.fn();
    fixture.componentInstance.resized.subscribe(resized);
    return { fixture, element, svg, resized };
  }

  function handle(element: HTMLElement, name: 'right' | 'bottom' | 'corner') {
    return element.querySelector(`.hit-${name}`) as SVGElement;
  }

  function pointer(target: Element, type: string, x: number, y: number): void {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    target.dispatchEvent(event);
  }

  function sizeText(element: HTMLElement): string {
    return (element.querySelector('.size-text')?.textContent ?? '').trim();
  }

  it('shows the real size in a text line under the plan', () => {
    const { element } = setup();
    expect(sizeText(element)).toBe('Size: 12 ft 0 in × 10 ft 0 in');
  });

  it('has three handles: right, bottom and corner', () => {
    const { element } = setup();
    expect(element.querySelectorAll('.hit').length).toBe(3);
    expect(handle(element, 'right')).not.toBeNull();
    expect(handle(element, 'bottom')).not.toBeNull();
    expect(handle(element, 'corner')).not.toBeNull();
  });

  it('updates the text live while dragging the corner and emits only on release', () => {
    const { fixture, element, resized } = setup();
    const corner = handle(element, 'corner');
    const setCapture = vi.fn();
    corner.setPointerCapture = setCapture;

    pointer(corner, 'pointerdown', room.widthMm, room.depthMm);
    expect(setCapture).toHaveBeenCalledWith(1);

    pointer(corner, 'pointermove', feetToMm(14), feetToMm(8));
    fixture.detectChanges();
    expect(sizeText(element)).toBe('Size: 14 ft 0 in × 8 ft 0 in');
    expect(resized).not.toHaveBeenCalled();

    pointer(corner, 'pointerup', feetToMm(14), feetToMm(8));
    expect(resized).toHaveBeenCalledTimes(1);
    expect(resized).toHaveBeenCalledWith({ widthMm: feetToMm(14), depthMm: feetToMm(8) });
  });

  it('snaps to whole inches while dragging', () => {
    const { fixture, element } = setup();
    const corner = handle(element, 'corner');
    pointer(corner, 'pointerdown', room.widthMm, room.depthMm);
    // 14 ft 3 in = 171 in = 4343 mm. Add 5 mm: still 171 in.
    pointer(corner, 'pointermove', 4343 + 5, room.depthMm);
    fixture.detectChanges();
    expect(sizeText(element)).toBe('Size: 14 ft 3 in × 10 ft 0 in');
  });

  it('the right handle changes only the width and the bottom handle only the depth', () => {
    const { element, resized } = setup();
    const right = handle(element, 'right');
    pointer(right, 'pointerdown', room.widthMm, 500);
    pointer(right, 'pointerup', feetToMm(15), 2000);
    expect(resized).toHaveBeenLastCalledWith({ widthMm: feetToMm(15), depthMm: room.depthMm });

    const bottom = handle(element, 'bottom');
    pointer(bottom, 'pointerdown', 500, room.depthMm);
    pointer(bottom, 'pointerup', 2000, feetToMm(6));
    expect(resized).toHaveBeenLastCalledWith({ widthMm: room.widthMm, depthMm: feetToMm(6) });
  });

  it('does not make the edge jump to the pointer when the drag starts', () => {
    const { element, resized } = setup();
    const right = handle(element, 'right');
    // Grab the edge 10 mm to its left, then move 600 mm to the right.
    pointer(right, 'pointerdown', room.widthMm - 10, 500);
    pointer(right, 'pointerup', room.widthMm - 10 + 600, 500);
    const { widthMm } = resized.mock.calls[0][0];
    expect(widthMm).toBe(Math.round(Math.round((room.widthMm + 600) / 25.4) * 25.4));
  });

  it('stops at the maximum size', () => {
    const { element, resized } = setup();
    const corner = handle(element, 'corner');
    pointer(corner, 'pointerdown', room.widthMm, room.depthMm);
    pointer(corner, 'pointerup', 1_000_000, 1_000_000);
    expect(resized).toHaveBeenCalledWith({ widthMm: ROOM_MAX_SIZE_MM, depthMm: ROOM_MAX_SIZE_MM });
  });

  it('keeps the viewBox frozen while dragging and refits it after release', () => {
    const { fixture, element, svg } = setup();
    const before = svg.getAttribute('viewBox');
    const corner = handle(element, 'corner');

    pointer(corner, 'pointerdown', room.widthMm, room.depthMm);
    pointer(corner, 'pointermove', feetToMm(30), feetToMm(20));
    fixture.detectChanges();
    expect(svg.getAttribute('viewBox')).toBe(before);

    // The parent has not saved anything, so the real room is unchanged and the view is the same.
    pointer(corner, 'pointerup', feetToMm(30), feetToMm(20));
    fixture.detectChanges();
    expect(svg.getAttribute('viewBox')).toBe(before);

    // After the parent passes the new size, the viewBox is computed from it again.
    fixture.componentRef.setInput('room', {
      ...room,
      widthMm: feetToMm(30),
      depthMm: feetToMm(20),
    });
    fixture.detectChanges();
    expect(svg.getAttribute('viewBox')).not.toBe(before);
  });

  it('goes back to the real size and emits nothing when the gesture is cancelled', () => {
    const { fixture, element, resized } = setup();
    const corner = handle(element, 'corner');
    pointer(corner, 'pointerdown', room.widthMm, room.depthMm);
    pointer(corner, 'pointermove', feetToMm(20), feetToMm(20));
    fixture.detectChanges();
    expect(sizeText(element)).toBe('Size: 20 ft 0 in × 20 ft 0 in');

    pointer(corner, 'pointercancel', feetToMm(20), feetToMm(20));
    fixture.detectChanges();
    expect(sizeText(element)).toBe('Size: 12 ft 0 in × 10 ft 0 in');
    expect(resized).not.toHaveBeenCalled();
  });

  it('emits nothing when the size did not change', () => {
    const { element, resized } = setup();
    const corner = handle(element, 'corner');
    pointer(corner, 'pointerdown', room.widthMm, room.depthMm);
    pointer(corner, 'pointerup', room.widthMm, room.depthMm);
    expect(resized).not.toHaveBeenCalled();
  });
});

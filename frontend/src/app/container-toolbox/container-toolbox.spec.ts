import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TOUGH_BOX_27_GAL } from '../core/container.model';
import { ContainerToolbox } from './container-toolbox';

/**
 * Pointer events are simulated. A real mouse, finger or keyboard cannot be tested in jsdom:
 * those must be tried by hand.
 */
describe('ContainerToolbox', () => {
  function setup() {
    const fixture = TestBed.createComponent(ContainerToolbox);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const toolbox = fixture.componentInstance;
    const spies = {
      tap: vi.fn(),
      dragMove: vi.fn(),
      dragEnd: vi.fn(),
      dragCancel: vi.fn(),
    };
    toolbox.tap.subscribe(spies.tap);
    toolbox.dragMove.subscribe(spies.dragMove);
    toolbox.dragEnd.subscribe(spies.dragEnd);
    toolbox.dragCancel.subscribe(spies.dragCancel);
    const tile = element.querySelector('.tile') as HTMLButtonElement;
    return { element, tile, ...spies };
  }

  function pointer(
    target: Element,
    type: string,
    x: number,
    y: number,
    extra: { pointerId?: number; button?: number } = {},
  ): void {
    const event = new MouseEvent(type, {
      clientX: x,
      clientY: y,
      button: extra.button ?? 0,
      bubbles: true,
    });
    Object.defineProperty(event, 'pointerId', { value: extra.pointerId ?? 1 });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    target.dispatchEvent(event);
  }

  it('shows one tile per container type with an icon and the type label', () => {
    const { element } = setup();
    const tiles = element.querySelectorAll('.tile');
    expect(tiles.length).toBe(1);
    expect(tiles[0].querySelector('svg')).not.toBeNull();
    expect(tiles[0].textContent).toContain(TOUGH_BOX_27_GAL.label);
  });

  it('tile is a button, so Enter and Space work like a click', () => {
    const { tile } = setup();
    expect(tile.tagName).toBe('BUTTON');
    expect(tile.getAttribute('type')).toBe('button');
  });

  it('emits tap on a click with no pointer (keyboard)', () => {
    const { tile, tap } = setup();
    tile.click();
    expect(tap).toHaveBeenCalledTimes(1);
    expect(tap).toHaveBeenCalledWith(TOUGH_BOX_27_GAL.id);
  });

  it('emits tap once for a press and release without moving', () => {
    const { tile, tap, dragMove, dragEnd } = setup();
    pointer(tile, 'pointerdown', 100, 100);
    pointer(tile, 'pointerup', 100, 100);
    tile.click(); // the browser sends this click after the pointer is released
    expect(tap).toHaveBeenCalledTimes(1);
    expect(dragMove).not.toHaveBeenCalled();
    expect(dragEnd).not.toHaveBeenCalled();
  });

  it('treats a tiny movement as a tap, not a drag', () => {
    const { tile, tap, dragMove } = setup();
    pointer(tile, 'pointerdown', 100, 100);
    pointer(tile, 'pointermove', 103, 102);
    pointer(tile, 'pointerup', 103, 102);
    tile.click();
    expect(dragMove).not.toHaveBeenCalled();
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('reports the drag and the drop, and does not count the click after it as a tap', () => {
    const { tile, tap, dragMove, dragEnd } = setup();
    pointer(tile, 'pointerdown', 100, 100);
    pointer(tile, 'pointermove', 140, 100);
    pointer(tile, 'pointermove', 200, 150);
    expect(dragMove).toHaveBeenCalledTimes(2);
    expect(dragMove).toHaveBeenLastCalledWith({
      typeId: TOUGH_BOX_27_GAL.id,
      clientX: 200,
      clientY: 150,
    });

    pointer(tile, 'pointerup', 210, 160);
    expect(dragEnd).toHaveBeenCalledWith({
      typeId: TOUGH_BOX_27_GAL.id,
      clientX: 210,
      clientY: 160,
    });
    tile.click();
    expect(tap).not.toHaveBeenCalled();
  });

  it('a click after a drag is skipped only once', () => {
    const { tile, tap } = setup();
    pointer(tile, 'pointerdown', 0, 0);
    pointer(tile, 'pointermove', 100, 0);
    pointer(tile, 'pointerup', 100, 0);
    tile.click();
    tile.click();
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('a drag whose click never arrives does not swallow the next tap', () => {
    const { tile, tap } = setup();
    pointer(tile, 'pointerdown', 0, 0);
    pointer(tile, 'pointermove', 100, 0);
    pointer(tile, 'pointerup', 100, 0);
    // No click arrives. The next press resets the flag.
    pointer(tile, 'pointerdown', 0, 0);
    pointer(tile, 'pointerup', 0, 0);
    tile.click();
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('emits dragCancel when the gesture is cancelled during a drag', () => {
    const { tile, tap, dragEnd, dragCancel } = setup();
    pointer(tile, 'pointerdown', 0, 0);
    pointer(tile, 'pointermove', 100, 0);
    pointer(tile, 'pointercancel', 100, 0);
    expect(dragCancel).toHaveBeenCalledTimes(1);
    expect(dragEnd).not.toHaveBeenCalled();
    expect(tap).not.toHaveBeenCalled();
  });

  it('does not emit dragCancel when a press that never became a drag is cancelled', () => {
    const { tile, dragCancel } = setup();
    pointer(tile, 'pointerdown', 0, 0);
    pointer(tile, 'pointercancel', 0, 0);
    expect(dragCancel).not.toHaveBeenCalled();
  });

  it('ignores events from another pointer and the secondary mouse button', () => {
    const { tile, dragMove } = setup();
    pointer(tile, 'pointerdown', 0, 0, { button: 2 });
    pointer(tile, 'pointermove', 100, 0);
    expect(dragMove).not.toHaveBeenCalled();

    pointer(tile, 'pointerdown', 0, 0, { pointerId: 1 });
    pointer(tile, 'pointermove', 100, 0, { pointerId: 2 });
    expect(dragMove).not.toHaveBeenCalled();
  });

  it('asks the browser to keep sending pointer events to the tile', () => {
    const { tile } = setup();
    const capture = vi.fn();
    tile.setPointerCapture = capture;
    pointer(tile, 'pointerdown', 0, 0);
    expect(capture).toHaveBeenCalledWith(1);
  });
});

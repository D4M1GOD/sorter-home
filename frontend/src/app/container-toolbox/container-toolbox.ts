import { Component, output } from '@angular/core';
import { CONTAINER_TYPES } from '../core/container.model';

/** Where the pointer is while a tile is being dragged (screen coordinates). */
export interface ToolboxDrag {
  typeId: string;
  clientX: number;
  clientY: number;
}

/** The pointer must move this many screen pixels before a press becomes a drag instead of a tap. */
const DRAG_THRESHOLD_PX = 6;

interface Press {
  typeId: string;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

/**
 * One square tile per container type. It only reports what the user does (tap, drag move, drop,
 * cancel). It does not know about the plan: the plan decides where the container goes.
 */
@Component({
  selector: 'app-container-toolbox',
  templateUrl: './container-toolbox.html',
  styleUrl: './container-toolbox.scss',
})
export class ContainerToolbox {
  protected readonly types = CONTAINER_TYPES;

  /** A tap, a click or Enter/Space on a tile (no drag). */
  readonly tap = output<string>();
  /** The pointer moved while dragging a tile. */
  readonly dragMove = output<ToolboxDrag>();
  /** The tile was dropped: the pointer was released after a drag. */
  readonly dragEnd = output<ToolboxDrag>();
  /** The browser cancelled the drag: nothing should be created. */
  readonly dragCancel = output<void>();

  private press: Press | null = null;
  /**
   * After a drag, the browser still sends a "click" on the tile. It must not count as a tap, or
   * the container would be added twice. This flag skips that one click.
   */
  private skipNextClick = false;

  protected onPointerDown(typeId: string, event: PointerEvent): void {
    this.skipNextClick = false;
    if (this.press || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    this.press = {
      typeId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    try {
      // Keeps sending pointer events to this tile even when the pointer leaves it.
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      // The pointer is not active anymore: the press still ends on pointerup/cancel.
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    if (!press.dragging) {
      const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
      if (moved < DRAG_THRESHOLD_PX) {
        return;
      }
      press.dragging = true;
    }
    this.dragMove.emit({ typeId: press.typeId, clientX: event.clientX, clientY: event.clientY });
  }

  protected onPointerUp(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    this.press = null;
    if (press.dragging) {
      this.skipNextClick = true;
      this.dragEnd.emit({ typeId: press.typeId, clientX: event.clientX, clientY: event.clientY });
    }
  }

  /** The gesture was cancelled, or the tile lost the pointer: forget the press. */
  protected onPointerCancel(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    this.press = null;
    if (press.dragging) {
      this.dragCancel.emit();
    }
  }

  protected onClick(typeId: string): void {
    if (this.skipNextClick) {
      this.skipNextClick = false;
      return;
    }
    this.tap.emit(typeId);
  }
}

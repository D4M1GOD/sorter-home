import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { gridLinePositions } from '../core/grid';
import { Room } from '../core/room.model';
import { ResizeHandle, resizeRoom, RoomSize } from '../core/room-resize';
import { formatFeetInches } from '../core/units';

/** State of a drag that is in progress. */
interface ActiveDrag {
  handle: ResizeHandle;
  pointerId: number;
  /** Distance (mm) from the pointer to the dragged edge when the drag started, so the edge does not jump. */
  grabOffset: { x: number; y: number };
  /** Room size when the drag started. The edge handles keep the other length from here. */
  start: RoomSize;
}

@Component({
  selector: 'app-room-plan',
  templateUrl: './room-plan.html',
  styleUrl: './room-plan.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomPlan {
  readonly room = input.required<Room>();

  /** Emits the final size when the user releases a resize handle. It does not save anything. */
  readonly resized = output<RoomSize>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('plan');

  /** Size being dragged. It is null when no drag is in progress. */
  private readonly draft = signal<RoomSize | null>(null);
  /**
   * Size used to compute the viewBox, label size and margin. It is frozen when a drag starts
   * and released when it ends. If the viewBox followed the draft, the plan would rescale under
   * the pointer on every move and the room could never grow.
   */
  private readonly frozenBasis = signal<RoomSize | null>(null);
  private drag: ActiveDrag | null = null;

  /** The size that is drawn: the draft while dragging, the real size otherwise. */
  protected readonly shownSize = computed<RoomSize>(
    () => this.draft() ?? { widthMm: this.room().widthMm, depthMm: this.room().depthMm },
  );
  private readonly basisSize = computed<RoomSize>(
    () => this.frozenBasis() ?? { widthMm: this.room().widthMm, depthMm: this.room().depthMm },
  );

  /** Text size and outer margin scale with the room, so labels stay readable at any room size. */
  protected readonly labelSize = computed(
    () => Math.max(this.basisSize().widthMm, this.basisSize().depthMm) * 0.03,
  );
  protected readonly margin = computed(() => this.labelSize() * 3);

  /** The drawing uses millimeters as units, with a margin around the room for the labels. */
  protected readonly viewBox = computed(() => {
    const m = this.margin();
    const { widthMm, depthMm } = this.basisSize();
    return `${-m} ${-m} ${widthMm + 2 * m} ${depthMm + 2 * m}`;
  });

  protected readonly verticalLines = computed(() => gridLinePositions(this.shownSize().widthMm));
  protected readonly horizontalLines = computed(() => gridLinePositions(this.shownSize().depthMm));

  protected readonly widthLabel = computed(() => formatFeetInches(this.shownSize().widthMm));
  protected readonly depthLabel = computed(() => formatFeetInches(this.shownSize().depthMm));
  protected readonly depthLabelPos = computed(() => ({
    x: -this.margin() * 0.7,
    y: this.shownSize().depthMm / 2,
  }));

  protected onPointerDown(handle: ResizeHandle, event: PointerEvent): void {
    if (this.drag) {
      return;
    }
    const pointer = this.toPlanMm(event);
    if (!pointer) {
      return;
    }
    const start = this.shownSize();
    this.drag = {
      handle,
      pointerId: event.pointerId,
      grabOffset: { x: start.widthMm - pointer.x, y: start.depthMm - pointer.y },
      start,
    };
    this.frozenBasis.set(start);
    this.draft.set(start);
    try {
      // Keeps sending pointer events to this handle even when the pointer leaves it.
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      // The pointer is not active anymore: the drag still ends normally on pointerup/cancel.
    }
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.drag && event.pointerId === this.drag.pointerId) {
      this.updateDraft(event);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    this.updateDraft(event);
    const final = this.draft();
    const room = this.room();
    this.endDrag();
    if (final && (final.widthMm !== room.widthMm || final.depthMm !== room.depthMm)) {
      this.resized.emit(final);
    }
  }

  /** The browser cancelled the gesture, or the handle lost the pointer: throw the draft away. */
  protected onPointerCancel(event: PointerEvent): void {
    if (this.drag && event.pointerId === this.drag.pointerId) {
      this.endDrag();
    }
  }

  private updateDraft(event: PointerEvent): void {
    const drag = this.drag;
    const pointer = this.toPlanMm(event);
    if (!drag || !pointer) {
      return;
    }
    const next = resizeRoom(
      drag.handle,
      { x: pointer.x + drag.grabOffset.x, y: pointer.y + drag.grabOffset.y },
      drag.start,
    );
    const current = this.draft();
    if (!current || current.widthMm !== next.widthMm || current.depthMm !== next.depthMm) {
      this.draft.set(next);
    }
  }

  private endDrag(): void {
    this.drag = null;
    this.draft.set(null);
    this.frozenBasis.set(null);
  }

  /** Converts a pointer position on the screen to plan millimeters, using the SVG transform. */
  private toPlanMm(event: PointerEvent): { x: number; y: number } | null {
    const matrix = this.svg().nativeElement.getScreenCTM()?.inverse();
    if (!matrix) {
      return null;
    }
    return {
      x: matrix.a * event.clientX + matrix.c * event.clientY + matrix.e,
      y: matrix.b * event.clientX + matrix.d * event.clientY + matrix.f,
    };
  }
}

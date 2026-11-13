import {
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ContainerToolbox, ToolboxDrag } from '../container-toolbox/container-toolbox';
import { grabOffsetOf, moveTopLeft, PlanPoint } from '../core/container-move';
import {
  firstFreeSpot,
  footprintOf,
  minRoomSizeFor,
  Rect,
  snapTopLeft,
} from '../core/container-placement';
import { DragOutcome, dragOutcome, stackOf, stacksOf } from '../core/container-stack';
import { ContainerRotation, getContainerType, truncateLabel } from '../core/container.model';
import { DRAG_THRESHOLD_PX } from '../core/drag';
import { gridLinePositions } from '../core/grid';
import { Room } from '../core/room.model';
import { ResizeHandle, resizeRoom, RoomSize } from '../core/room-resize';
import { formatFeetInches } from '../core/units';

/**
 * Where a new container should be created: its type and top-left corner in plan millimeters.
 * When it is dropped on a stack, `stackOnto` is the id of the container on top of that stack and
 * the position is the one of the stack.
 */
export interface ContainerAdded {
  typeId: string;
  xMm: number;
  yMm: number;
  stackOnto?: string;
}

/** A container (or a whole stack) the user dropped on a valid place: its id and new corner. */
export interface ContainerMoved {
  id: string;
  xMm: number;
  yMm: number;
}

/** A container the user dropped on a stack: its id and the id of the container on top of it. */
export interface ContainerStacked {
  id: string;
  targetId: string;
}

/** The three states of the shadow. The text says the state, so it never depends on color alone. */
type ShadowKind = 'valid' | 'invalid' | 'stack';

/** The shadow shown while a tile or a container is dragged over the plan. */
interface Shadow {
  rect: Rect;
  kind: ShadowKind;
  /** One or two lines of text, each with the vertical position of its middle. */
  lines: { text: string; yMm: number }[];
  fontSize: number;
}

/** The longest line the shadow text may have, so it fits in the footprint of the container. */
const SHADOW_LINE_MAX_CHARS = 20;

/** The badge with the number of containers of a stack, drawn in the corner of the top one. */
interface StackBadge {
  text: string;
  rect: Rect;
  fontSize: number;
}

/** A line drawn on a container lid, in plan millimeters. */
interface LidLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Everything the template needs to draw one stack: only its top container is drawn, with a badge
 * when the stack has more than one container.
 */
interface ContainerView {
  /** Id of the container on top of the stack. */
  id: string;
  /** Ids of all the containers of the stack, also the hidden ones. */
  memberIds: string[];
  name: string;
  label: string;
  /** Text for assistive technology: the name, and the size of the stack when it has several. */
  description: string;
  rect: Rect;
  cornerRadius: number;
  lid: Rect;
  lidLines: LidLine[];
  fontSize: number;
  badge: StackBadge | null;
}

/** State of a drag that is in progress. */
interface ActiveDrag {
  handle: ResizeHandle;
  pointerId: number;
  /** Distance (mm) from the pointer to the dragged edge when the drag started, so the edge does not jump. */
  grabOffset: { x: number; y: number };
  /** Room size when the drag started. The edge handles keep the other length from here. */
  start: RoomSize;
}

/** State of a container press: it becomes a drag once the pointer moves far enough. */
interface ActiveMove {
  containerId: string;
  pointerId: number;
  /** Screen position where the press started, to measure the drag threshold. */
  startX: number;
  startY: number;
  /** Where inside the container the pointer holds it (plan millimeters). */
  grabOffset: PlanPoint;
  /** Rotation when the press started. If it changes before the drop, the move is dropped. */
  rotation: ContainerRotation;
  dragging: boolean;
  /** The user pressed Escape: the rest of the gesture is ignored and nothing is saved. */
  cancelled: boolean;
}

@Component({
  selector: 'app-room-plan',
  imports: [ContainerToolbox],
  templateUrl: './room-plan.html',
  styleUrl: './room-plan.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class RoomPlan {
  readonly room = input.required<Room>();

  /** Id of the selected container, or null. Two-way: the page shows the panel for it. */
  readonly selectedId = model<string | null>(null);

  /** Emits the final size when the user releases a resize handle. It does not save anything. */
  readonly resized = output<RoomSize>();

  /** Emits where a new container should go (a valid drop, or a tap on a toolbox tile). It does not save anything. */
  readonly containerAdded = output<ContainerAdded>();

  /** Emits a container (or a whole stack) dropped on a valid place. It does not save anything. */
  readonly containerMoved = output<ContainerMoved>();

  /** Emits a container dropped on top of a stack. It does not save anything. */
  readonly containerStacked = output<ContainerStacked>();

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
  private move: ActiveMove | null = null;
  /**
   * After a drag the browser still sends a "click" on the container. It must not count as a
   * click, or it would select again. This flag skips that one click.
   */
  private skipNextClick = false;

  /** Id of the container being dragged. It is dimmed while the shadow shows where it would land. */
  protected readonly movingId = signal<string | null>(null);

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

  /** The room cannot be resized smaller than the containers inside it. */
  private readonly minSize = computed(() => minRoomSizeFor(this.room().containers));

  /**
   * One view per stack, at the real size of its containers, with the extra numbers the template
   * needs to draw it. Only the container on top is drawn: the ones under it are hidden, and the
   * user reaches them from the stack list in the panel.
   */
  protected readonly containerViews = computed<ContainerView[]>(() =>
    stacksOf(this.room().containers).map((stack) => {
      const container = stack.top;
      const rect = stack.rect;
      const size = stack.members.length;
      // The short side does not change when the container is rotated, so the text size, the lid
      // margin and the corner radius are computed from it: a rotated container looks like the
      // original, turned.
      const shortSide = Math.min(rect.widthMm, rect.depthMm);
      const fontSize = shortSide * 0.17;
      // Rough width of a character is 0.55 of the font size. The text may use 84% of the box.
      const maxChars = Math.floor((rect.widthMm * 0.84) / (fontSize * 0.55));
      const inset = shortSide * 0.1;
      const lid = {
        xMm: rect.xMm + inset,
        yMm: rect.yMm + inset,
        widthMm: rect.widthMm - 2 * inset,
        depthMm: rect.depthMm - 2 * inset,
      };
      // Two lines along the long side of the lid, at 22% and 78% of its short side. They turn
      // with the container: horizontal at rotation 0, vertical at rotation 90.
      const lidLines = [0.22, 0.78].map((fraction): LidLine => {
        if (container.rotation === 90) {
          const x = lid.xMm + lid.widthMm * fraction;
          return { x1: x, y1: lid.yMm, x2: x, y2: lid.yMm + lid.depthMm };
        }
        const y = lid.yMm + lid.depthMm * fraction;
        return { x1: lid.xMm, y1: y, x2: lid.xMm + lid.widthMm, y2: y };
      });
      // "x3" in the top-right corner of the top container. It is text, so it does not rely on color.
      const badgeFontSize = shortSide * 0.13;
      const badgeText = `x${size}`;
      const badgeWidth = badgeFontSize * (0.62 * badgeText.length + 0.9);
      const badgeHeight = badgeFontSize * 1.5;
      const badgeMargin = shortSide * 0.04;
      const badge: StackBadge | null =
        size > 1
          ? {
              text: badgeText,
              fontSize: badgeFontSize,
              rect: {
                xMm: rect.xMm + rect.widthMm - badgeMargin - badgeWidth,
                yMm: rect.yMm + badgeMargin,
                widthMm: badgeWidth,
                depthMm: badgeHeight,
              },
            }
          : null;
      return {
        id: container.id,
        memberIds: stack.members.map((member) => member.id),
        name: container.name,
        label: truncateLabel(container.name, maxChars),
        description: size > 1 ? `${container.name}, stack of ${size}` : container.name,
        rect,
        cornerRadius: shortSide * 0.06,
        lid,
        lidLines,
        fontSize,
        badge,
      };
    }),
  );

  /** True when the selected container is in the stack of this view (it may be a hidden one). */
  protected isSelected(view: ContainerView): boolean {
    const selected = this.selectedId();
    return selected !== null && view.memberIds.includes(selected);
  }

  /** Shadow of the container being dragged from the toolbox. It is null when nothing is dragged. */
  protected readonly shadow = signal<Shadow | null>(null);
  /** True after a tap on a tile when the room has no free spot left. */
  protected readonly noSpace = signal(false);

  protected onToolboxDragMove(drag: ToolboxDrag): void {
    this.noSpace.set(false);
    this.shadow.set(this.shadowFor(drag));
  }

  protected onToolboxDragEnd(drag: ToolboxDrag): void {
    const outcome = this.toolboxOutcomeFor(drag);
    this.shadow.set(null);
    // Dropping on a red shadow creates nothing.
    if (outcome?.kind === 'stack') {
      this.containerAdded.emit({
        typeId: drag.typeId,
        xMm: outcome.rect.xMm,
        yMm: outcome.rect.yMm,
        stackOnto: outcome.target.top.id,
      });
    } else if (outcome?.kind === 'place' && outcome.problem === null) {
      this.containerAdded.emit({ typeId: drag.typeId, xMm: outcome.rect.xMm, yMm: outcome.rect.yMm });
    }
  }

  protected onToolboxDragCancel(): void {
    this.shadow.set(null);
  }

  /** A tap on a tile places the container in the first free spot, or tells the user there is none. */
  protected onToolboxTap(typeId: string): void {
    if (!getContainerType(typeId)) {
      return;
    }
    const room = this.room();
    const spot = firstFreeSpot(room, room.containers, footprintOf(typeId));
    this.noSpace.set(spot === null);
    if (spot) {
      this.containerAdded.emit({ typeId, xMm: spot.xMm, yMm: spot.yMm });
    }
  }

  protected selectContainer(id: string): void {
    this.selectedId.set(id);
  }

  /** A click selects, except the click that the browser sends right after a drag. */
  protected onContainerClick(id: string): void {
    if (this.skipNextClick) {
      this.skipNextClick = false;
      return;
    }
    this.selectContainer(id);
  }

  protected onContainerPointerDown(id: string, event: PointerEvent): void {
    this.skipNextClick = false;
    if (this.move || this.drag || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    const container = this.room().containers.find((c) => c.id === id);
    const pointer = this.toPlanMm(event.clientX, event.clientY);
    if (!container || !pointer) {
      return;
    }
    this.move = {
      containerId: id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabOffset: grabOffsetOf(pointer, container),
      rotation: container.rotation,
      dragging: false,
      cancelled: false,
    };
    try {
      // Keeps sending pointer events to this container even when the pointer leaves it.
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      // The pointer is not active anymore: the press still ends on pointerup/cancel.
    }
  }

  protected onContainerPointerMove(event: PointerEvent): void {
    const move = this.move;
    if (!move || move.cancelled || event.pointerId !== move.pointerId) {
      return;
    }
    if (!move.dragging) {
      const moved = Math.hypot(event.clientX - move.startX, event.clientY - move.startY);
      if (moved < DRAG_THRESHOLD_PX) {
        return;
      }
      move.dragging = true;
      // Starting to drag a container selects it, so its panel shows the one being moved.
      this.selectedId.set(move.containerId);
      this.movingId.set(move.containerId);
    }
    this.shadow.set(this.moveShadowFor(move, event));
  }

  protected onContainerPointerUp(event: PointerEvent): void {
    const move = this.move;
    if (!move || event.pointerId !== move.pointerId) {
      return;
    }
    const outcome = move.dragging && !move.cancelled ? this.moveOutcomeFor(move, event) : null;
    const container = this.room().containers.find((c) => c.id === move.containerId);
    this.skipNextClick = move.dragging;
    this.endMove();
    // Dropping on red, or on the same place, changes nothing: the container stays where it was.
    // If the container was rotated or deleted during the drag, the move is dropped too.
    if (!outcome || !container || container.rotation !== move.rotation) {
      return;
    }
    if (outcome.kind === 'stack') {
      this.containerStacked.emit({ id: container.id, targetId: outcome.target.top.id });
    } else if (
      outcome.kind === 'place' &&
      outcome.problem === null &&
      (outcome.rect.xMm !== container.xMm || outcome.rect.yMm !== container.yMm)
    ) {
      this.containerMoved.emit({ id: container.id, xMm: outcome.rect.xMm, yMm: outcome.rect.yMm });
    }
  }

  /** The browser cancelled the gesture, or the container lost the pointer: nothing is saved. */
  protected onContainerPointerCancel(event: PointerEvent): void {
    if (this.move && event.pointerId === this.move.pointerId) {
      this.endMove();
    }
  }

  /**
   * Escape cancels a drag in progress. The press itself stays until the pointer is released, so
   * the same gesture cannot start another move, but it saves nothing.
   */
  protected onEscape(): void {
    const move = this.move;
    if (move && !move.cancelled) {
      move.cancelled = true;
      this.shadow.set(null);
      this.movingId.set(null);
    }
  }

  private endMove(): void {
    this.move = null;
    this.shadow.set(null);
    this.movingId.set(null);
  }

  /** The shadow for the container being dragged: where it would land and what would happen. */
  private moveShadowFor(move: ActiveMove, event: PointerEvent): Shadow | null {
    const outcome = this.moveOutcomeFor(move, event);
    return outcome ? this.shadowOf(outcome) : null;
  }

  /**
   * What would happen if the container (and its whole stack, which moves together) were dropped
   * now. The corner keeps the grab offset and snaps to whole inches. The rules are in `dragOutcome`.
   */
  private moveOutcomeFor(move: ActiveMove, event: PointerEvent): DragOutcome | null {
    const pointer = this.toPlanMm(event.clientX, event.clientY);
    const room = this.room();
    const container = room.containers.find((c) => c.id === move.containerId);
    if (!pointer || !container) {
      return null;
    }
    const rect: Rect = {
      ...moveTopLeft(pointer, move.grabOffset),
      ...footprintOf(container.typeId, container.rotation),
    };
    const draggedIds = (stackOf(room.containers, container.id)?.members ?? [container]).map(
      (member) => member.id,
    );
    return dragOutcome({ pointer, rect, draggedIds, room, containers: room.containers });
  }

  protected onContainerKey(id: string, event: Event): void {
    event.preventDefault(); // Space would otherwise scroll the page.
    this.selectContainer(id);
  }

  /** A click on empty plan space deselects. Clicks on containers and resize handles do not. */
  protected onPlanClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest('.container') && !target.closest('.hit')) {
      this.selectedId.set(null);
    }
  }

  /** The shadow for the container dragged from the toolbox: where it would land and what would happen. */
  private shadowFor(drag: ToolboxDrag): Shadow | null {
    const outcome = this.toolboxOutcomeFor(drag);
    return outcome ? this.shadowOf(outcome) : null;
  }

  /** What would happen if the tile were dropped now (the center of the container under the pointer). */
  private toolboxOutcomeFor(drag: ToolboxDrag): DragOutcome | null {
    const pointer = this.toPlanMm(drag.clientX, drag.clientY);
    if (!pointer || !getContainerType(drag.typeId)) {
      return null;
    }
    const footprint = footprintOf(drag.typeId);
    const rect: Rect = { ...snapTopLeft(pointer, footprint), ...footprint };
    const room = this.room();
    return dragOutcome({ pointer, rect, draggedIds: [], room, containers: room.containers });
  }

  /**
   * The shadow for an outcome. Green: a valid place. Red (dashed, with a cross): the place is
   * outside the room or overlaps, or a stack of several containers was dropped on a container.
   * Blue (dotted): the container would go on top of a stack, in the place of that stack.
   * Every state has its own text, so the meaning never depends on color or outline alone.
   */
  private shadowOf(outcome: DragOutcome): Shadow {
    if (outcome.kind === 'stack') {
      const prefix = 'Stack on ';
      const name = truncateLabel(
        outcome.target.top.name,
        Math.max(1, SHADOW_LINE_MAX_CHARS - prefix.length),
      );
      return this.shadowWith(outcome.rect, 'stack', [`${prefix}${name}`, `Level ${outcome.level}`]);
    }
    if (outcome.kind === 'blocked') {
      return this.shadowWith(outcome.rect, 'invalid', ["Can't place a stack", 'on a container']);
    }
    if (outcome.problem === null) {
      return this.shadowWith(outcome.rect, 'valid', ['Valid']);
    }
    const text = outcome.problem === 'overlap' ? 'Overlaps' : 'Outside room';
    return this.shadowWith(outcome.rect, 'invalid', [text]);
  }

  /** Lays out the text lines in the middle of the shadow, small enough to fit its width. */
  private shadowWith(rect: Rect, kind: ShadowKind, texts: string[]): Shadow {
    const longest = Math.max(...texts.map((text) => text.length));
    // Rough width of a character is 0.55 of the font size. The text may use 92% of the width.
    const fontSize = Math.min(
      Math.min(rect.widthMm, rect.depthMm) * 0.15,
      (rect.widthMm * 0.92) / (longest * 0.55),
    );
    const lineHeight = fontSize * 1.25;
    const middle = rect.yMm + rect.depthMm / 2;
    return {
      rect,
      kind,
      fontSize,
      lines: texts.map((text, i) => ({
        text,
        yMm: middle + (i - (texts.length - 1) / 2) * lineHeight,
      })),
    };
  }

  protected onPointerDown(handle: ResizeHandle, event: PointerEvent): void {
    if (this.drag || this.move) {
      return;
    }
    const pointer = this.toPlanMm(event.clientX, event.clientY);
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
    const pointer = this.toPlanMm(event.clientX, event.clientY);
    if (!drag || !pointer) {
      return;
    }
    const next = resizeRoom(
      drag.handle,
      { x: pointer.x + drag.grabOffset.x, y: pointer.y + drag.grabOffset.y },
      drag.start,
      this.minSize(),
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

  /**
   * Converts a screen position (client coordinates) to plan millimeters, using the SVG transform.
   * It works for any position, also outside the SVG: that is how a drag that starts in the
   * toolbox can be placed on the plan.
   */
  private toPlanMm(clientX: number, clientY: number): { x: number; y: number } | null {
    const matrix = this.svg().nativeElement.getScreenCTM()?.inverse();
    if (!matrix) {
      return null;
    }
    return {
      x: matrix.a * clientX + matrix.c * clientY + matrix.e,
      y: matrix.b * clientX + matrix.d * clientY + matrix.f,
    };
  }
}

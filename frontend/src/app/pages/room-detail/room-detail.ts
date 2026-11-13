import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ContainerPanel } from '../../container-panel/container-panel';
import { stackOf } from '../../core/container-stack';
import { createContainer, nextContainerName } from '../../core/container.model';
import { roomNameSchema } from '../../core/room-name-schema';
import { RoomSize } from '../../core/room-resize';
import { RoomStore } from '../../core/room-store';
import {
  ContainerAdded,
  ContainerMoved,
  ContainerStacked,
  RoomPlan,
} from '../../room-plan/room-plan';

const NOT_ENOUGH_SPACE_TO_ROTATE = 'Not enough space to rotate';
const NO_FREE_SPACE = 'There is no free space for another container in this room.';

/** True when the key press goes to something the user types in: the R key must not rotate then. */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

@Component({
  selector: 'app-room-detail',
  imports: [ContainerPanel, FormField, RoomPlan, RouterLink],
  templateUrl: './room-detail.html',
  styleUrl: './room-detail.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class RoomDetail {
  private readonly store = inject(RoomStore);
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    requireSync: true,
  });
  protected readonly room = computed(() => {
    const id = this.id();
    return id === null ? undefined : this.store.getById(id);
  });

  protected readonly saved = signal(false);

  /** The rename field starts with the current name and resets if the room changes. */
  private readonly model = linkedSignal(() => ({ name: this.room()?.name ?? '' }));
  protected readonly renameForm = form(this.model, (path) => {
    apply(path.name, roomNameSchema);
  });

  /** Selected container. It is cleared when the user opens another room. */
  protected readonly selectedId = linkedSignal<string | null, string | null>({
    source: () => this.id(),
    computation: () => null,
  });
  /** The selected container, or undefined if none is selected (or it was deleted). */
  protected readonly selectedContainer = computed(() => {
    const id = this.selectedId();
    return this.room()?.containers.find((container) => container.id === id);
  });

  /** The stack of the selected container, from the bottom to the top (empty if none is selected). */
  protected readonly selectedStack = computed(() => {
    const id = this.selectedId();
    const room = this.room();
    return id === null || !room ? [] : (stackOf(room.containers, id)?.members ?? []);
  });

  /**
   * The message shown in the panel, for example after a rotation was blocked for lack of space.
   * It is cleared when another container is selected, and after any action that worked.
   */
  protected readonly notice = linkedSignal<string | null, string>({
    source: () => this.selectedId(),
    computation: () => '',
  });

  /** Saves the final size when the user releases a resize handle on the plan. */
  protected onResize(size: RoomSize): void {
    const room = this.room();
    if (room) {
      this.store.resize(room.id, size.widthMm, size.depthMm);
    }
  }

  /** Creates a container with the next automatic name and selects it, so its panel opens. */
  protected onContainerAdded(added: ContainerAdded): void {
    const room = this.room();
    if (!room) {
      return;
    }
    const container = createContainer(
      added.typeId,
      nextContainerName(room.containers),
      added.xMm,
      added.yMm,
    );
    // Dropped on a stack: the container goes on top of it, in the position of the stack.
    const saved = added.stackOnto
      ? this.store.addContainerOnStack(room.id, container, added.stackOnto)
      : this.store.addContainer(room.id, container);
    if (saved) {
      this.selectedId.set(container.id);
    }
  }

  /** Saves a container (or a whole stack) dropped on a valid place. The store checks the place again. */
  protected onContainerMoved(moved: ContainerMoved): void {
    const room = this.room();
    if (room && this.store.moveContainer(room.id, moved.id, moved.xMm, moved.yMm)) {
      this.notice.set('');
    }
  }

  /** Puts a container on top of a stack and selects it, so its panel shows the stack list. */
  protected onContainerStacked(stacked: ContainerStacked): void {
    const room = this.room();
    if (room && this.store.stackContainer(room.id, stacked.id, stacked.targetId)) {
      this.selectedId.set(stacked.id);
      this.notice.set('');
    }
  }

  /**
   * Rotates the selected container 90° (the whole stack, if it is in one). If it does not fit,
   * nothing changes and the panel shows a message instead.
   */
  protected rotateSelected(): void {
    const room = this.room();
    const container = this.selectedContainer();
    if (room && container) {
      const rotated = this.store.rotateContainer(room.id, container.id);
      this.notice.set(rotated ? '' : NOT_ENOUGH_SPACE_TO_ROTATE);
    }
  }

  /** Moves the selected container one level up or down in its stack. */
  protected moveSelectedInStack(direction: 'up' | 'down'): void {
    const room = this.room();
    const container = this.selectedContainer();
    if (room && container) {
      this.store.moveInStack(room.id, container.id, direction);
      this.notice.set('');
    }
  }

  /**
   * Takes the selected container out of its stack and puts it in the first free spot. It stays
   * selected. If there is no free spot, nothing changes and the panel shows a message instead.
   */
  protected removeSelectedFromStack(): void {
    const room = this.room();
    const container = this.selectedContainer();
    if (room && container) {
      const removed = this.store.unstackContainer(room.id, container.id);
      this.notice.set(removed ? '' : NO_FREE_SPACE);
    }
  }

  /**
   * The R key rotates the selected container. It is ignored while the user types in a field,
   * with Ctrl, Meta or Alt (so Ctrl+R still reloads the page), when the key is held down
   * (repeat), and when no container is selected.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (
      event.key.toLowerCase() !== 'r' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.repeat ||
      event.isComposing ||
      event.defaultPrevented ||
      isTypingTarget(event.target)
    ) {
      return;
    }
    this.rotateSelected();
  }

  protected onContainerRenamed(name: string): void {
    const room = this.room();
    const container = this.selectedContainer();
    if (room && container) {
      this.store.renameContainer(room.id, container.id, name);
    }
  }

  protected onContainerDeleted(): void {
    const room = this.room();
    const container = this.selectedContainer();
    if (room && container && this.store.removeContainer(room.id, container.id)) {
      this.selectedId.set(null);
    }
  }

  protected onRename(event: Event): void {
    event.preventDefault();
    this.saved.set(false);
    void submit(this.renameForm, async () => {
      const room = this.room();
      if (room && this.store.rename(room.id, this.model().name)) {
        this.saved.set(true);
      }
    });
  }
}

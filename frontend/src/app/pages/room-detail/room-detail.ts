import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ContainerPanel } from '../../container-panel/container-panel';
import { createContainer, nextContainerName } from '../../core/container.model';
import { roomNameSchema } from '../../core/room-name-schema';
import { RoomSize } from '../../core/room-resize';
import { RoomStore } from '../../core/room-store';
import { ContainerAdded, ContainerMoved, RoomPlan } from '../../room-plan/room-plan';

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

  /**
   * True after a rotation was blocked for lack of space. It is cleared when another container is
   * selected, and after a rotation or a move that worked.
   */
  protected readonly rotateBlocked = linkedSignal<string | null, boolean>({
    source: () => this.selectedId(),
    computation: () => false,
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
    if (this.store.addContainer(room.id, container)) {
      this.selectedId.set(container.id);
    }
  }

  /** Saves a container dropped on a valid place. The store checks the place again. */
  protected onContainerMoved(moved: ContainerMoved): void {
    const room = this.room();
    if (room && this.store.moveContainer(room.id, moved.id, moved.xMm, moved.yMm)) {
      this.rotateBlocked.set(false);
    }
  }

  /**
   * Rotates the selected container 90°. If it does not fit, nothing changes and the panel shows
   * a message instead.
   */
  protected rotateSelected(): void {
    const room = this.room();
    const container = this.selectedContainer();
    if (room && container) {
      this.rotateBlocked.set(!this.store.rotateContainer(room.id, container.id));
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

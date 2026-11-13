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
import { ContainerAdded, RoomPlan } from '../../room-plan/room-plan';

@Component({
  selector: 'app-room-detail',
  imports: [ContainerPanel, FormField, RoomPlan, RouterLink],
  templateUrl: './room-detail.html',
  styleUrl: './room-detail.scss',
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

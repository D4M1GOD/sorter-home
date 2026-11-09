import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { roomNameSchema } from '../../core/room-name-schema';
import { RoomSize } from '../../core/room-resize';
import { RoomStore } from '../../core/room-store';
import { RoomPlan } from '../../room-plan/room-plan';

@Component({
  selector: 'app-room-detail',
  imports: [FormField, RoomPlan, RouterLink],
  templateUrl: './room-detail.html',
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

  /** Saves the final size when the user releases a resize handle on the plan. */
  protected onResize(size: RoomSize): void {
    const room = this.room();
    if (room) {
      this.store.resize(room.id, size.widthMm, size.depthMm);
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

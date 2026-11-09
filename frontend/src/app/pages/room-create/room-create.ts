import { Component, inject, signal } from '@angular/core';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { roomNameSchema } from '../../core/room-name-schema';
import { RoomStore } from '../../core/room-store';
import { createRoom } from '../../core/room.model';

@Component({
  selector: 'app-room-create',
  imports: [FormField],
  templateUrl: './room-create.html',
})
export class RoomCreate {
  private readonly store = inject(RoomStore);
  private readonly router = inject(Router);

  private readonly model = signal({ name: '' });
  protected readonly roomForm = form(this.model, (path) => {
    apply(path.name, roomNameSchema);
  });

  protected onSubmit(event: Event): void {
    event.preventDefault();
    // submit() marks the fields as touched (so errors show) and only runs the action if the form is valid.
    void submit(this.roomForm, async () => {
      const room = createRoom(this.model().name);
      this.store.add(room);
      await this.router.navigate(['/rooms', room.id]);
    });
  }
}

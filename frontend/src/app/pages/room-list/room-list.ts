import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomStore } from '../../core/room-store';
import { Room } from '../../core/room.model';
import { formatFeetInches } from '../../core/units';

@Component({
  selector: 'app-room-list',
  imports: [RouterLink],
  templateUrl: './room-list.html',
})
export class RoomList {
  private readonly store = inject(RoomStore);

  protected readonly rooms = this.store.rooms;
  /** Id of the room waiting for delete confirmation, or null. */
  protected readonly confirmingId = signal<string | null>(null);

  protected size(room: Room): string {
    return `${formatFeetInches(room.widthMm)} × ${formatFeetInches(room.depthMm)}`;
  }

  protected askDelete(id: string): void {
    this.confirmingId.set(id);
  }

  protected cancelDelete(): void {
    this.confirmingId.set(null);
  }

  protected confirmDelete(id: string): void {
    this.store.remove(id);
    this.confirmingId.set(null);
  }
}

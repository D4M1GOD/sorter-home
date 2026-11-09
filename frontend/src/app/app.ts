import { Component } from '@angular/core';
import { createRoom } from './core/room.model';
import { RoomPlan } from './room-plan/room-plan';

@Component({
  selector: 'app-root',
  imports: [RoomPlan],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Temporary: a hard-coded room until rooms are created from the UI.
  protected readonly room = createRoom('Garage');
}
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1>Welcome to SorterHome</h1>
    <p>Plan your storage rooms and know what is inside every container.</p>
    <p class="actions">
      <a class="button button--primary" routerLink="/rooms/new">Create Room</a>
      <a class="button" routerLink="/rooms">Explore Rooms</a>
    </p>
  `,
})
export class Home {}

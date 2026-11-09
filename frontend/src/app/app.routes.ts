import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  // 'rooms/new' must stay before 'rooms/:id', otherwise "new" would be read as a room id.
  {
    path: 'rooms/new',
    loadComponent: () => import('./pages/room-create/room-create').then((m) => m.RoomCreate),
  },
  {
    path: 'rooms/:id',
    loadComponent: () => import('./pages/room-detail/room-detail').then((m) => m.RoomDetail),
  },
  {
    path: 'rooms',
    loadComponent: () => import('./pages/room-list/room-list').then((m) => m.RoomList),
  },
  { path: '**', redirectTo: '' },
];

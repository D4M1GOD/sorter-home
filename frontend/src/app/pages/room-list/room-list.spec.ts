import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RoomStore } from '../../core/room-store';
import { createRoom } from '../../core/room.model';
import { RoomList } from './room-list';

describe('RoomList', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [RoomList], providers: [provideRouter([])] });
  });

  async function render() {
    const fixture = TestBed.createComponent(RoomList);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function button(element: HTMLElement, text: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    );
  }

  it('shows an empty state with a link to create a room', async () => {
    const { element } = await render();
    expect(element.querySelector('.empty-state')).toBeTruthy();
    expect(element.querySelector('.empty-state a')?.getAttribute('href')).toBe('/rooms/new');
    expect(element.querySelector('.room-item')).toBeNull();
  });

  it('shows the name and the size of each room', async () => {
    TestBed.inject(RoomStore).add(createRoom('Garage'));
    const { element } = await render();
    const item = element.querySelector('.room-item') as HTMLElement;
    expect(item.textContent).toContain('Garage');
    expect(item.textContent).toContain('12 ft 0 in × 10 ft 0 in');
  });

  it('removes a room only after confirmation', async () => {
    const store = TestBed.inject(RoomStore);
    store.add(createRoom('Garage'));
    const { fixture, element } = await render();

    button(element, 'Delete')?.click();
    await fixture.whenStable();
    expect(store.rooms().length).toBe(1);
    expect(element.textContent).toContain('This cannot be undone');

    button(element, 'Yes, delete')?.click();
    await fixture.whenStable();
    expect(store.rooms().length).toBe(0);
    expect(element.querySelector('.empty-state')).toBeTruthy();
  });

  it('keeps the room when the confirmation is cancelled', async () => {
    const store = TestBed.inject(RoomStore);
    store.add(createRoom('Garage'));
    const { fixture, element } = await render();

    button(element, 'Delete')?.click();
    await fixture.whenStable();
    button(element, 'Cancel')?.click();
    await fixture.whenStable();
    expect(store.rooms().length).toBe(1);
    expect(button(element, 'Delete')).toBeTruthy();
  });
});

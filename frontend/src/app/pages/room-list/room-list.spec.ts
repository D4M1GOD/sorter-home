import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createContainer, TOUGH_BOX_27_GAL } from '../../core/container.model';
import { createItem } from '../../core/item.model';
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

  describe('delete confirmation', () => {
    /** Adds a room with one container per number: each container gets that many items. */
    function roomWith(...itemsPerContainer: number[]) {
      const store = TestBed.inject(RoomStore);
      const room = createRoom('Garage');
      store.add(room);
      itemsPerContainer.forEach((count, index) => {
        const container = createContainer(TOUGH_BOX_27_GAL.id, `Box ${index}`, index * 1000, 0);
        store.addContainer(room.id, container);
        for (let i = 0; i < count; i++) {
          const draft = {
            name: `Item ${i}`,
            quantity: 50,
            description: '',
            category: '',
            photoId: null,
          };
          store.addItem(room.id, container.id, createItem(draft));
        }
      });
      return { store, room };
    }

    async function question(): Promise<string | undefined> {
      const { fixture, element } = await render();
      button(element, 'Delete')?.click();
      await fixture.whenStable();
      return element.querySelector('.confirm span')?.textContent?.trim();
    }

    it('keeps the short question for an empty room', async () => {
      roomWith();
      expect(await question()).toBe('Delete "Garage"? This cannot be undone.');
    });

    it('says how many containers and items the room has', async () => {
      roomWith(5, 7, 0);
      expect(await question()).toBe(
        '"Garage" has 3 containers and 12 items. Delete it and everything inside? This cannot be undone.',
      );
    });

    it('uses the singular for one container and one item', async () => {
      roomWith(1);
      expect(await question()).toBe(
        '"Garage" has 1 container and 1 item. Delete it and everything inside? This cannot be undone.',
      );
    });

    it('does not mention items when the containers are empty', async () => {
      roomWith(0, 0);
      expect(await question()).toBe(
        '"Garage" has 2 containers. Delete it and everything inside? This cannot be undone.',
      );
    });

    it('deletes the room with its containers and items after the confirmation', async () => {
      const { store } = roomWith(2);
      const { fixture, element } = await render();
      button(element, 'Delete')?.click();
      await fixture.whenStable();
      button(element, 'Yes, delete')?.click();
      await fixture.whenStable();
      expect(store.rooms()).toEqual([]);
    });
  });
});

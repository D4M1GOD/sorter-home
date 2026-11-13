import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RoomStore } from '../../core/room-store';
import { createContainer, TOUGH_BOX_27_GAL } from '../../core/container.model';
import { createRoom } from '../../core/room.model';
import { RoomPlan } from '../../room-plan/room-plan';
import { routes } from '../../app.routes';

describe('RoomDetail', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  /** Opens the page through the real router, so the :id param is read like in the real app. */
  async function open(id: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/rooms/${id}`);
    const fixture = harness.fixture;
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function typeName(element: HTMLElement, text: string): void {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  it('renames the room with a valid name', async () => {
    const store = TestBed.inject(RoomStore);
    const room = createRoom('Garage');
    store.add(room);
    const { fixture, element } = await open(room.id);

    typeName(element, '  Attic  ');
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(store.getById(room.id)?.name).toBe('Attic');
    expect(element.querySelector('h1')?.textContent).toContain('Attic');
    expect(element.textContent).toContain('Name saved.');
  });

  it('rejects an invalid name and keeps the old one', async () => {
    const store = TestBed.inject(RoomStore);
    const room = createRoom('Garage');
    store.add(room);
    const { fixture, element } = await open(room.id);

    typeName(element, '   ');
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(element.querySelector('.field-error')?.textContent).toContain('required');
    expect(store.getById(room.id)?.name).toBe('Garage');
    expect(element.textContent).not.toContain('Name saved.');
  });

  it('saves the new size when the plan emits a resize', async () => {
    const store = TestBed.inject(RoomStore);
    const room = createRoom('Garage');
    store.add(room);
    const { fixture, element } = await open(room.id);

    const plan = fixture.debugElement.query(By.directive(RoomPlan)).componentInstance as RoomPlan;
    plan.resized.emit({ widthMm: 5000, depthMm: 4000 });
    await fixture.whenStable();

    expect(store.getById(room.id)).toEqual({ ...room, widthMm: 5000, depthMm: 4000 });
    expect(element.querySelector('.size-text')?.textContent).toContain('16 ft 5 in × 13 ft 1 in');
  });

  describe('containers', () => {
    function tile(element: HTMLElement): HTMLButtonElement {
      return element.querySelector('.tile') as HTMLButtonElement;
    }

    function panelInput(element: HTMLElement): HTMLInputElement {
      return element.querySelector('#container-name') as HTMLInputElement;
    }

    function panelButton(element: HTMLElement, label: string): HTMLButtonElement | undefined {
      return Array.from(element.querySelectorAll('app-container-panel button')).find((b) =>
        (b.textContent ?? '').trim().startsWith(label),
      ) as HTMLButtonElement | undefined;
    }

    async function openRoom() {
      const store = TestBed.inject(RoomStore);
      const room = createRoom('Garage');
      store.add(room);
      const opened = await open(room.id);
      return { store, room, ...opened };
    }

    it('shows the toolbox and an empty side column when nothing is selected', async () => {
      const { element } = await openRoom();
      expect(tile(element)).not.toBeNull();
      expect(element.querySelector('app-container-panel')).toBeNull();
      expect(element.querySelector('.side-empty')?.textContent).toContain('Select a container');
    });

    it('adds a container with a tap, names it "Container 1", saves it and opens its panel', async () => {
      const { store, room, fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();

      const saved = store.getById(room.id)?.containers ?? [];
      expect(saved.length).toBe(1);
      expect(saved[0]).toMatchObject({ name: 'Container 1', xMm: 0, yMm: 0, rotation: 0 });
      expect(element.querySelectorAll('.container').length).toBe(1);
      // The new container is selected, so the side panel is open with its name.
      expect(element.querySelector('app-container-panel')).not.toBeNull();
      expect(panelInput(element).value).toBe('Container 1');
      expect(element.querySelector('.container.selected')).not.toBeNull();
    });

    it('uses the lowest free number for the next automatic name', async () => {
      const { store, room, fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();
      tile(element).click();
      await fixture.whenStable();
      tile(element).click();
      await fixture.whenStable();
      expect(store.getById(room.id)?.containers.map((c) => c.name)).toEqual([
        'Container 1',
        'Container 2',
        'Container 3',
      ]);

      // Delete "Container 2" and add another one: it takes the free number 2.
      const second = store.getById(room.id)?.containers[1];
      store.removeContainer(room.id, second!.id);
      tile(element).click();
      await fixture.whenStable();
      expect(store.getById(room.id)?.containers.map((c) => c.name)).toContain('Container 2');
    });

    it('keeps the container after the page is opened again', async () => {
      const { room, fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();
      const again = new RoomStore();
      expect(again.getById(room.id)?.containers.length).toBe(1);
    });

    it('renames the selected container from the panel', async () => {
      const { store, room, fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();

      const field = panelInput(element);
      field.value = '  Winter wear  ';
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      expect(store.getById(room.id)?.containers[0].name).toBe('Winter wear');
      expect(element.querySelector('.container-name')?.textContent?.trim()).toBe('Winter wear');
    });

    it('does not rename with an invalid name', async () => {
      const { store, room, fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();

      const field = panelInput(element);
      field.value = '   ';
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(store.getById(room.id)?.containers[0].name).toBe('Container 1');
      expect(element.querySelector('app-container-panel .field-error')?.textContent).toContain(
        'required',
      );
    });

    it('deletes the container only after the inline confirmation, and closes the panel', async () => {
      const { store, room, fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();

      panelButton(element, 'Delete')?.click();
      await fixture.whenStable();
      expect(store.getById(room.id)?.containers.length).toBe(1);

      panelButton(element, 'Yes, delete')?.click();
      await fixture.whenStable();
      expect(store.getById(room.id)?.containers).toEqual([]);
      expect(element.querySelectorAll('.container').length).toBe(0);
      expect(element.querySelector('app-container-panel')).toBeNull();
    });

    it('cancelling the confirmation keeps the container', async () => {
      const { store, room, fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();
      panelButton(element, 'Delete')?.click();
      await fixture.whenStable();
      panelButton(element, 'Cancel')?.click();
      await fixture.whenStable();
      expect(store.getById(room.id)?.containers.length).toBe(1);
      expect(element.querySelector('app-container-panel')).not.toBeNull();
    });

    it('selects another container by clicking it and closes the panel by clicking empty space', async () => {
      const { fixture, element } = await openRoom();
      tile(element).click();
      await fixture.whenStable();
      tile(element).click();
      await fixture.whenStable();
      expect(panelInput(element).value).toBe('Container 2'); // the last one added is selected

      (element.querySelectorAll('.container')[0] as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await fixture.whenStable();
      expect(panelInput(element).value).toBe('Container 1');

      (element.querySelector('.floor') as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await fixture.whenStable();
      expect(element.querySelector('app-container-panel')).toBeNull();
    });

    it('shows the existing containers of a saved room', async () => {
      const store = TestBed.inject(RoomStore);
      const room = createRoom('Garage');
      store.add(room);
      store.addContainer(room.id, createContainer(TOUGH_BOX_27_GAL.id, 'Toys', 100, 100));
      const { element } = await open(room.id);
      expect(element.querySelector('.container-name')?.textContent?.trim()).toBe('Toys');
      expect(element.querySelector('app-container-panel')).toBeNull();
    });

    describe('moving and rotating', () => {
      const D = TOUGH_BOX_27_GAL.depthMm;

      /** A saved room with the given containers, already open. */
      async function openWith(...containers: [string, number, number][]) {
        const store = TestBed.inject(RoomStore);
        const room = createRoom('Garage');
        store.add(room);
        for (const [name, x, y] of containers) {
          store.addContainer(room.id, createContainer(TOUGH_BOX_27_GAL.id, name, x, y));
        }
        const opened = await open(room.id);
        return { store, room, ...opened };
      }

      function saved(store: RoomStore, roomId: string) {
        return store.getById(roomId)?.containers ?? [];
      }

      async function select(
        fixture: Awaited<ReturnType<typeof open>>['fixture'],
        element: HTMLElement,
        index = 0,
      ) {
        (element.querySelectorAll('.container')[index] as SVGElement).dispatchEvent(
          new MouseEvent('click', { bubbles: true }),
        );
        await fixture.whenStable();
      }

      function status(element: HTMLElement): string {
        return (element.querySelector('.rotate-notice')?.textContent ?? '').trim();
      }

      function pressR(target: EventTarget, init: KeyboardEventInit = {}): void {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true, ...init }));
      }

      function plan(fixture: Awaited<ReturnType<typeof open>>['fixture']): RoomPlan {
        return fixture.debugElement.query(By.directive(RoomPlan)).componentInstance as RoomPlan;
      }

      it('saves a container the plan reports as moved', async () => {
        const { store, room, fixture } = await openWith(['A', 1016, 1016]);
        const id = saved(store, room.id)[0].id;
        plan(fixture).containerMoved.emit({ id, xMm: 2000, yMm: 1500 });
        await fixture.whenStable();
        expect(saved(store, room.id)[0]).toMatchObject({ xMm: 2000, yMm: 1500 });
      });

      it('does not move a container to a place the store rejects', async () => {
        const { store, room, fixture } = await openWith(['A', 0, 0], ['B', 2000, 0]);
        const b = saved(store, room.id)[1];
        plan(fixture).containerMoved.emit({ id: b.id, xMm: 100, yMm: 100 }); // over A
        await fixture.whenStable();
        expect(saved(store, room.id)[1]).toEqual(b);
      });

      it('rotates the selected container with the Rotate 90° button', async () => {
        const { store, room, fixture, element } = await openWith(['A', 1016, 1016]);
        await select(fixture, element);
        panelButton(element, 'Rotate 90°')?.click();
        await fixture.whenStable();
        expect(saved(store, room.id)[0]).toMatchObject({ rotation: 90, xMm: 1143, yMm: 889 });
        // The plan draws the swapped footprint.
        expect(element.querySelector('.container-body')?.getAttribute('width')).toBe(String(D));
        expect(status(element)).toBe('');
      });

      it('blocks the rotation with a message when there is not enough space', async () => {
        const { store, room, fixture, element } = await openWith(['A', 1000, 0]); // top wall
        await select(fixture, element);
        const before = saved(store, room.id)[0];
        panelButton(element, 'Rotate 90°')?.click();
        await fixture.whenStable();
        expect(saved(store, room.id)[0]).toEqual(before);
        expect(status(element)).toBe('Not enough space to rotate');
        expect(element.querySelector('.rotate-notice')?.getAttribute('role')).toBe('status');
      });

      it('clears the message when another container is selected', async () => {
        const { fixture, element } = await openWith(['A', 1000, 0], ['B', 2500, 1500]);
        await select(fixture, element, 0);
        panelButton(element, 'Rotate 90°')?.click();
        await fixture.whenStable();
        expect(status(element)).toBe('Not enough space to rotate');
        await select(fixture, element, 1);
        expect(status(element)).toBe('');
      });

      it('clears the message after a rotation or a move that works', async () => {
        const { store, room, fixture, element } = await openWith(['A', 1000, 0]);
        await select(fixture, element);
        panelButton(element, 'Rotate 90°')?.click();
        await fixture.whenStable();
        expect(status(element)).toBe('Not enough space to rotate');

        const id = saved(store, room.id)[0].id;
        plan(fixture).containerMoved.emit({ id, xMm: 1000, yMm: 1000 });
        await fixture.whenStable();
        expect(status(element)).toBe('');

        panelButton(element, 'Rotate 90°')?.click(); // now it has space
        await fixture.whenStable();
        expect(saved(store, room.id)[0].rotation).toBe(90);
        expect(status(element)).toBe('');
      });

      describe('R key', () => {
        it('rotates the selected container, with a lower or upper case letter', async () => {
          const { store, room, fixture, element } = await openWith(['A', 1016, 1016]);
          await select(fixture, element);
          pressR(document);
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(90);
          pressR(document, { key: 'R', shiftKey: true });
          await fixture.whenStable();
          expect(saved(store, room.id)[0]).toMatchObject({ rotation: 0, xMm: 1016, yMm: 1016 });
        });

        it('shows the message when the rotation is blocked', async () => {
          const { store, room, fixture, element } = await openWith(['A', 1000, 0]);
          await select(fixture, element);
          pressR(document);
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(0);
          expect(status(element)).toBe('Not enough space to rotate');
        });

        it('rotates when the focus is on a container or a button', async () => {
          const { store, room, fixture, element } = await openWith(['A', 1016, 1016]);
          await select(fixture, element);
          pressR(element.querySelector('.container') as Element);
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(90);
          pressR(panelButton(element, 'Delete') as Element);
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(0);
        });

        it('is ignored while the user types in a text field', async () => {
          const { store, room, fixture, element } = await openWith(['A', 1016, 1016]);
          await select(fixture, element);
          pressR(panelInput(element));
          pressR(element.querySelector('#rename-room') as Element);
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(0);
        });

        it('is ignored with Ctrl, Meta or Alt, so Ctrl+R still reloads the page', async () => {
          const { store, room, fixture, element } = await openWith(['A', 1016, 1016]);
          await select(fixture, element);
          pressR(document, { ctrlKey: true });
          pressR(document, { metaKey: true });
          pressR(document, { altKey: true });
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(0);
        });

        it('is ignored while the key is held down (repeat)', async () => {
          const { store, room, fixture, element } = await openWith(['A', 1016, 1016]);
          await select(fixture, element);
          pressR(document, { repeat: true });
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(0);
        });

        it('is ignored when no container is selected', async () => {
          const { store, room, fixture } = await openWith(['A', 1016, 1016]);
          pressR(document);
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(0);
        });

        it('is ignored for other keys', async () => {
          const { store, room, fixture, element } = await openWith(['A', 1016, 1016]);
          await select(fixture, element);
          pressR(document, { key: 'e' });
          pressR(document, { key: 'Escape' });
          await fixture.whenStable();
          expect(saved(store, room.id)[0].rotation).toBe(0);
        });
      });
    });

    it('does not shrink the room under its containers when the plan emits a smaller size', async () => {
      const store = TestBed.inject(RoomStore);
      const room = createRoom('Garage');
      store.add(room);
      store.addContainer(room.id, createContainer(TOUGH_BOX_27_GAL.id, 'Far', 2000, 1500));
      const { fixture } = await open(room.id);

      const plan = fixture.debugElement.query(By.directive(RoomPlan)).componentInstance as RoomPlan;
      plan.resized.emit({ widthMm: 1300, depthMm: 1300 });
      await fixture.whenStable();

      expect(store.getById(room.id)?.widthMm).toBe(2794);
      expect(store.getById(room.id)?.depthMm).toBe(2032);
    });
  });

  it('shows "Room not found" for an unknown id', async () => {
    const { element } = await open('does-not-exist');
    expect(element.querySelector('h1')?.textContent).toContain('Room not found');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/rooms');
    expect(element.querySelector('app-room-plan')).toBeNull();
  });
});

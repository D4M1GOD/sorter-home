import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RoomStore } from '../../core/room-store';
import { createContainer, TOUGH_BOX_27_GAL } from '../../core/container.model';
import { vi } from 'vitest';
import { createItem } from '../../core/item.model';
import { PhotoProcessor } from '../../core/photo-processor';
import { PhotoStore } from '../../core/photo-store';
import {
  fakePhoto,
  FakePhotoStore,
  ObjectUrls,
  settle,
  stubObjectUrls,
} from '../../core/photo-store.testing';
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
        return (element.querySelector('app-container-panel .notice')?.textContent ?? '').trim();
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
        expect(element.querySelector('app-container-panel .notice')?.getAttribute('role')).toBe('status');
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

      describe('stacks', () => {
        /** A room with container A and container B on top of it (both at 1016, 1016), already open. */
        async function openStacked() {
          const store = TestBed.inject(RoomStore);
          const room = createRoom('Garage');
          store.add(room);
          const a = createContainer(TOUGH_BOX_27_GAL.id, 'A', 1016, 1016);
          const b = createContainer(TOUGH_BOX_27_GAL.id, 'B', 0, 0);
          store.addContainer(room.id, a);
          store.addContainerOnStack(room.id, b, a.id);
          const opened = await open(room.id);
          return { store, room, a, b, ...opened };
        }

        function levelRows(element: HTMLElement): HTMLButtonElement[] {
          return Array.from(element.querySelectorAll<HTMLButtonElement>('app-container-stack .level'));
        }

        function rowTexts(element: HTMLElement): string[] {
          return levelRows(element).map((r) => r.textContent?.replace(/\s+/g, ' ').trim() ?? '');
        }

        function levelOf(store: RoomStore, roomId: string, id: string): number | undefined {
          return store.getById(roomId)?.containers.find((c) => c.id === id)?.stackPosition;
        }

        it('draws a stack as one container with a badge, and selecting it opens the stack list', async () => {
          const { fixture, element } = await openStacked();
          expect(element.querySelectorAll('.container').length).toBe(1);
          expect(element.querySelector('.stack-badge-text')?.textContent?.trim()).toBe('x2');
          await select(fixture, element);
          expect(rowTexts(element)).toEqual(['▸ Level 2 B', 'Level 1 A']);
          expect(panelInput(element).value).toBe('B'); // the container on top
        });

        it('does not show the stack list for a container that is alone', async () => {
          const { fixture, element } = await openWith(['A', 1016, 1016]);
          await select(fixture, element);
          expect(element.querySelector('app-container-stack')).toBeNull();
        });

        it('puts a new container from the toolbox on top of a stack, selects it and shows the list', async () => {
          const { store, room, a, fixture, element } = await openStacked();
          plan(fixture).containerAdded.emit({
            typeId: TOUGH_BOX_27_GAL.id,
            xMm: 1016,
            yMm: 1016,
            stackOnto: a.id,
          });
          await fixture.whenStable();
          const containers = store.getById(room.id)!.containers;
          expect(containers.map((c) => [c.name, c.stackPosition])).toEqual([
            ['A', 0],
            ['B', 1],
            ['Container 1', 2],
          ]);
          expect(containers[2]).toMatchObject({ xMm: 1016, yMm: 1016 });
          expect(rowTexts(element)).toEqual(['▸ Level 3 Container 1', 'Level 2 B', 'Level 1 A']);
          expect(element.querySelector('.stack-badge-text')?.textContent?.trim()).toBe('x3');
        });

        it('does not add a container when the stack to put it on does not exist', async () => {
          const { store, room, fixture } = await openStacked();
          const before = store.getById(room.id);
          plan(fixture).containerAdded.emit({
            typeId: TOUGH_BOX_27_GAL.id,
            xMm: 0,
            yMm: 0,
            stackOnto: 'nope',
          });
          await fixture.whenStable();
          expect(store.getById(room.id)).toBe(before);
        });

        it('stacks a container that the plan reports as dropped on a stack, and selects it', async () => {
          const { store, room, a, fixture, element } = await openStacked();
          const c = createContainer(TOUGH_BOX_27_GAL.id, 'C', 2500, 500);
          store.addContainer(room.id, c);
          plan(fixture).containerStacked.emit({ id: c.id, targetId: a.id });
          await fixture.whenStable();
          expect(levelOf(store, room.id, c.id)).toBe(2);
          expect(store.getById(room.id)!.containers.find((x) => x.id === c.id)).toMatchObject({
            xMm: 1016,
            yMm: 1016,
          });
          expect(rowTexts(element)).toEqual(['▸ Level 3 C', 'Level 2 B', 'Level 1 A']);
        });

        it('does not stack a container that is in a stack with others', async () => {
          const { store, room, b, fixture } = await openStacked();
          const c = createContainer(TOUGH_BOX_27_GAL.id, 'C', 2500, 500);
          store.addContainer(room.id, c);
          const before = store.getById(room.id);
          plan(fixture).containerStacked.emit({ id: b.id, targetId: c.id });
          await fixture.whenStable();
          expect(store.getById(room.id)).toBe(before);
        });

        it('selects a hidden container when its row is clicked, and the plan keeps the stack selected', async () => {
          const { fixture, element } = await openStacked();
          await select(fixture, element);
          levelRows(element)[1].click(); // Level 1: A, hidden under B
          await fixture.whenStable();
          expect(panelInput(element).value).toBe('A');
          expect(rowTexts(element)).toEqual(['Level 2 B', '▸ Level 1 A']);
          expect(element.querySelector('.container.selected')).not.toBeNull();
        });

        it('Move down puts the selected container under the other, and the plan shows the new top', async () => {
          const { store, room, b, a, fixture, element } = await openStacked();
          await select(fixture, element); // B, on top
          panelButton(element, 'Move down')?.click();
          await fixture.whenStable();
          expect(levelOf(store, room.id, b.id)).toBe(0);
          expect(levelOf(store, room.id, a.id)).toBe(1);
          expect(element.querySelector('.container-name')?.textContent?.trim()).toBe('A');
          expect(rowTexts(element)).toEqual(['Level 2 A', '▸ Level 1 B']); // B is still selected
        });

        it('Move up puts the selected container above the other', async () => {
          const { store, room, b, fixture, element } = await openStacked();
          await select(fixture, element);
          levelRows(element)[1].click(); // select A, the bottom one
          await fixture.whenStable();
          panelButton(element, 'Move up')?.click();
          await fixture.whenStable();
          expect(store.getById(room.id)!.containers.map((c) => [c.name, c.stackPosition])).toEqual([
            ['A', 1],
            ['B', 0],
          ]);
          expect(levelOf(store, room.id, b.id)).toBe(0);
        });

        it('ignores Move up on the top container and Move down on the bottom one', async () => {
          const { store, room, fixture, element } = await openStacked();
          await select(fixture, element); // B, on top
          const before = store.getById(room.id);
          panelButton(element, 'Move up')?.click();
          await fixture.whenStable();
          expect(store.getById(room.id)).toBe(before);
          expect(panelButton(element, 'Move up')?.getAttribute('aria-disabled')).toBe('true');
        });

        it('Remove from stack puts the container in the first free spot and keeps it selected', async () => {
          const { store, room, a, b, fixture, element } = await openStacked();
          await select(fixture, element);
          panelButton(element, 'Remove from stack')?.click();
          await fixture.whenStable();
          const left = store.getById(room.id)!.containers.find((c) => c.id === b.id)!;
          expect(left).toMatchObject({ xMm: 0, yMm: 0, stackPosition: 0 });
          expect(levelOf(store, room.id, a.id)).toBe(0);
          expect(element.querySelectorAll('.container').length).toBe(2);
          // B stays selected, and it is alone now: no stack list.
          expect(panelInput(element).value).toBe('B');
          expect(element.querySelector('app-container-stack')).toBeNull();
          expect(status(element)).toBe('');
        });

        it('Remove from stack keeps the rotation of the stack', async () => {
          const { store, room, b, fixture, element } = await openStacked();
          await select(fixture, element);
          panelButton(element, 'Rotate 90°')?.click();
          await fixture.whenStable();
          panelButton(element, 'Remove from stack')?.click();
          await fixture.whenStable();
          expect(store.getById(room.id)!.containers.find((c) => c.id === b.id)!.rotation).toBe(90);
        });

        it('shows the "no free space" message and changes nothing when there is no spot', async () => {
          const store = TestBed.inject(RoomStore);
          const room = createRoom('Garage');
          store.add(room);
          const a = createContainer(TOUGH_BOX_27_GAL.id, 'A', 0, 0);
          store.addContainer(room.id, a);
          store.addContainerOnStack(room.id, createContainer(TOUGH_BOX_27_GAL.id, 'B', 0, 0), a.id);
          store.addContainer(room.id, createContainer(TOUGH_BOX_27_GAL.id, 'Under', 0, D));
          store.resize(room.id, 1219, 1219); // 4 ft x 4 ft: the stack and the box under it fill it
          const { fixture, element } = await open(room.id);
          (element.querySelectorAll('.container')[0] as SVGElement).dispatchEvent(
            new MouseEvent('click', { bubbles: true }),
          );
          await fixture.whenStable();
          const before = store.getById(room.id);
          panelButton(element, 'Remove from stack')?.click();
          await fixture.whenStable();
          expect(store.getById(room.id)).toBe(before);
          expect(status(element)).toBe('There is no free space for another container in this room.');
        });

        it('rotates the whole stack with the button and with the R key', async () => {
          const { store, room, fixture, element } = await openStacked();
          await select(fixture, element);
          panelButton(element, 'Rotate 90°')?.click();
          await fixture.whenStable();
          expect(store.getById(room.id)!.containers.map((c) => [c.xMm, c.yMm, c.rotation])).toEqual([
            [1143, 889, 90],
            [1143, 889, 90],
          ]);
          pressR(document);
          await fixture.whenStable();
          expect(store.getById(room.id)!.containers.map((c) => [c.xMm, c.yMm, c.rotation])).toEqual([
            [1016, 1016, 0],
            [1016, 1016, 0],
          ]);
        });

        it('blocks the rotation of a stack that does not fit, with the message', async () => {
          const store = TestBed.inject(RoomStore);
          const room = createRoom('Garage');
          store.add(room);
          const a = createContainer(TOUGH_BOX_27_GAL.id, 'A', 1016, 0); // against the top wall
          store.addContainer(room.id, a);
          store.addContainerOnStack(room.id, createContainer(TOUGH_BOX_27_GAL.id, 'B', 0, 0), a.id);
          const { fixture, element } = await open(room.id);
          await select(fixture, element);
          const before = store.getById(room.id);
          panelButton(element, 'Rotate 90°')?.click();
          await fixture.whenStable();
          expect(store.getById(room.id)).toBe(before);
          expect(status(element)).toBe('Not enough space to rotate');
        });

        it('saves a whole stack that the plan reports as moved', async () => {
          const { store, room, b, fixture } = await openStacked();
          plan(fixture).containerMoved.emit({ id: b.id, xMm: 2000, yMm: 1500 });
          await fixture.whenStable();
          expect(store.getById(room.id)!.containers.map((c) => [c.xMm, c.yMm])).toEqual([
            [2000, 1500],
            [2000, 1500],
          ]);
        });

        it('deleting a container in the middle of a stack closes the gap and renumbers the levels', async () => {
          const { store, room, a, fixture, element } = await openStacked();
          const c = createContainer(TOUGH_BOX_27_GAL.id, 'C', 0, 0);
          store.addContainerOnStack(room.id, c, a.id);
          await fixture.whenStable();
          await select(fixture, element); // C, on top
          levelRows(element)[1].click(); // B, in the middle
          await fixture.whenStable();
          panelButton(element, 'Delete')?.click();
          await fixture.whenStable();
          panelButton(element, 'Yes, delete')?.click();
          await fixture.whenStable();
          expect(store.getById(room.id)!.containers.map((x) => [x.name, x.stackPosition])).toEqual([
            ['A', 0],
            ['C', 1],
          ]);
          expect(element.querySelector('.stack-badge-text')?.textContent?.trim()).toBe('x2');
        });

        it('the message is cleared when another container is selected', async () => {
          const store = TestBed.inject(RoomStore);
          const room = createRoom('Garage');
          store.add(room);
          const a = createContainer(TOUGH_BOX_27_GAL.id, 'A', 1016, 0);
          store.addContainer(room.id, a);
          store.addContainerOnStack(room.id, createContainer(TOUGH_BOX_27_GAL.id, 'B', 0, 0), a.id);
          const { fixture, element } = await open(room.id);
          await select(fixture, element);
          panelButton(element, 'Rotate 90°')?.click();
          await fixture.whenStable();
          expect(status(element)).toBe('Not enough space to rotate');
          levelRows(element)[1].click();
          await fixture.whenStable();
          expect(status(element)).toBe('');
        });
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

  describe('items', () => {
    function panelButton(element: HTMLElement, label: string): HTMLButtonElement | undefined {
      return Array.from(element.querySelectorAll('app-container-panel button')).find(
        (b) => (b.textContent ?? '').trim() === label,
      ) as HTMLButtonElement | undefined;
    }

    function typeIn(element: HTMLElement, id: string, text: string): void {
      const field = element.querySelector(`#${id}`) as HTMLInputElement;
      field.value = text;
      field.dispatchEvent(new Event('input'));
    }

    /** Opens a room with the containers "Toys" and "Books", and selects "Toys". */
    async function openWithContainers() {
      const store = TestBed.inject(RoomStore);
      const room = createRoom('Garage');
      store.add(room);
      const toys = createContainer(TOUGH_BOX_27_GAL.id, 'Toys', 0, 0);
      const books = createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0);
      store.addContainer(room.id, toys);
      store.addContainer(room.id, books);
      const opened = await open(room.id);
      await select(opened.fixture, toys.id);
      return { store, room, toys, books, ...opened };
    }

    async function select(fixture: ComponentFixture<unknown>, id: string) {
      const plan = fixture.debugElement.query(By.directive(RoomPlan)).componentInstance as RoomPlan;
      plan.selectedId.set(id);
      await fixture.whenStable();
    }

    async function addItem(
      fixture: ComponentFixture<unknown>,
      element: HTMLElement,
      values: { name: string; quantity?: string; description?: string; category?: string },
    ) {
      if (!element.querySelector('app-item-form')) {
        panelButton(element, 'Add item')?.click();
        await fixture.whenStable();
      }
      typeIn(element, 'item-name', values.name);
      if (values.quantity !== undefined) {
        typeIn(element, 'item-quantity', values.quantity);
      }
      typeIn(element, 'item-description', values.description ?? '');
      typeIn(element, 'item-category', values.category ?? '');
      element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    }

    function itemsOf(store: RoomStore, roomId: string, containerId: string) {
      return store.getById(roomId)?.containers.find((c) => c.id === containerId)?.items ?? [];
    }

    it('adds an item to the selected container, shows it in the list and saves it', async () => {
      const { store, room, toys, books, fixture, element } = await openWithContainers();
      expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (0)');

      await addItem(fixture, element, {
        name: '  Nails ',
        quantity: '100',
        description: 'Box of 100',
        category: 'Hardware',
      });

      const saved = itemsOf(store, room.id, toys.id);
      expect(saved).toEqual([
        {
          id: saved[0].id,
          name: 'Nails',
          quantity: 100,
          quantityOut: 0,
          description: 'Box of 100',
          category: 'Hardware',
          photoId: null,
        },
      ]);
      expect(itemsOf(store, room.id, books.id)).toEqual([]);
      expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (1)');
      const row = element.querySelector('.item') as HTMLElement;
      expect(row.querySelector('.item-name')?.textContent?.trim()).toBe('Nails');
      expect(row.querySelector('.item-quantity')?.textContent?.trim()).toBe('Qty 100');
      expect(row.querySelector('.item-category')?.textContent?.trim()).toBe('Category: Hardware');
      expect(row.querySelector('.item-description')?.textContent).toBe('Box of 100');
      // The form stays open and clean for the next item.
      expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('');
      expect(element.querySelector('app-item-form .status')?.textContent?.trim()).toBe('Added Nails');
      // Saved in the browser storage too: a new store finds it.
      expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual(saved);
    });

    it('adds several items in a row and lists them in alphabetical order', async () => {
      const { store, room, toys, fixture, element } = await openWithContainers();
      await addItem(fixture, element, { name: 'Nails' });
      expect(element.querySelector('app-item-form')).not.toBeNull(); // still open after adding
      await addItem(fixture, element, { name: 'cables', quantity: '0' });
      await addItem(fixture, element, { name: 'Batteries' });

      // Stored in the order they were added, shown in alphabetical order.
      expect(itemsOf(store, room.id, toys.id).map((item) => item.name)).toEqual([
        'Nails',
        'cables',
        'Batteries',
      ]);
      const names = Array.from(element.querySelectorAll('.item-name')).map((n) => n.textContent?.trim());
      expect(names).toEqual(['Batteries', 'cables', 'Nails']);
      expect(element.querySelectorAll('.item-quantity')[1].textContent?.trim()).toBe('None left');
    });

    it('saves nothing when the form has errors', async () => {
      const { store, room, toys, fixture, element } = await openWithContainers();
      await addItem(fixture, element, { name: 'Nails', quantity: '1.5' });
      expect(itemsOf(store, room.id, toys.id)).toEqual([]);
      expect(element.querySelector('app-item-form .field-error')?.textContent).toContain('whole number');
    });

    it('suggests the categories used in any room and reuses their spelling', async () => {
      const { store, room, toys, fixture, element } = await openWithContainers();
      // A category used in another room.
      const attic = createRoom('Attic');
      store.add(attic);
      const box = createContainer(TOUGH_BOX_27_GAL.id, 'Box', 0, 0);
      store.addContainer(attic.id, box);
      store.addItem(
        attic.id,
        box.id,
        createItem({
          name: 'Hose',
          quantity: 1,
          description: '',
          category: 'Jardín',
          photoId: null,
        }),
      );

      panelButton(element, 'Add item')?.click();
      await fixture.whenStable();
      const options = () =>
        Array.from(element.querySelectorAll('datalist option')).map((o) => o.getAttribute('value'));
      expect(options()).toEqual(['Jardín']);

      await addItem(fixture, element, { name: 'Gloves', category: ' JARDIN ' });
      expect(itemsOf(store, room.id, toys.id)[0].category).toBe('Jardín');

      await addItem(fixture, element, { name: 'Nails', category: 'Hardware' });
      expect(options()).toEqual(['Hardware', 'Jardín']);
    });

    it('shows the items of the container that is selected', async () => {
      const { books, fixture, element } = await openWithContainers();
      await addItem(fixture, element, { name: 'Nails' });

      await select(fixture, books.id);
      expect(element.querySelector('app-item-form')).toBeNull();
      expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (0)');
      expect(element.querySelector('.items')?.textContent).toContain('No items yet.');
    });

    it('does not rotate the container when the user types "r" in the form', async () => {
      const { store, room, toys, fixture, element } = await openWithContainers();
      panelButton(element, 'Add item')?.click();
      await fixture.whenStable();
      for (const id of ['item-name', 'item-description']) {
        element
          .querySelector(`#${id}`)
          ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      }
      await fixture.whenStable();
      expect(store.getById(room.id)?.containers.find((c) => c.id === toys.id)?.rotation).toBe(0);
    });

    it('asks with the number of items before deleting the container, and deletes them with it', async () => {
      const { store, room, toys, fixture, element } = await openWithContainers();
      await addItem(fixture, element, { name: 'Nails', category: 'Hardware' });
      await addItem(fixture, element, { name: 'Screws', category: 'Hardware' });
      expect(store.categories()).toEqual(['Hardware']);

      panelButton(element, 'Delete')?.click();
      await fixture.whenStable();
      expect(element.querySelector('app-container-panel .confirm span')?.textContent?.trim()).toBe(
        '"Toys" has 2 items. Delete it and its items? This cannot be undone.',
      );
      panelButton(element, 'Yes, delete')?.click();
      await fixture.whenStable();

      expect(store.getById(room.id)?.containers.some((c) => c.id === toys.id)).toBe(false);
      // Its category was only used by the deleted items, so it is no longer suggested.
      expect(store.categories()).toEqual([]);
    });

    describe('editing and removing', () => {
      function iconButton(element: HTMLElement, label: string): HTMLButtonElement {
        return element.querySelector(
          `app-container-panel button[aria-label="${label}"]`,
        ) as HTMLButtonElement;
      }

      function names(element: HTMLElement): (string | undefined)[] {
        return Array.from(element.querySelectorAll('.item-name')).map((n) => n.textContent?.trim());
      }

      /** Opens the room with "Nails", "Cables" and "Batteries" (added in that order) in "Toys". */
      async function openWithItems() {
        const opened = await openWithContainers();
        const { fixture, element } = opened;
        await addItem(fixture, element, { name: 'Nails', quantity: '100', category: 'Hardware' });
        await addItem(fixture, element, { name: 'Cables' });
        await addItem(fixture, element, { name: 'Batteries' });
        panelButton(element, 'Done')?.click();
        await fixture.whenStable();
        return opened;
      }

      async function saveEdit(fixture: ComponentFixture<unknown>, element: HTMLElement) {
        element.querySelector('.item app-item-form form')?.dispatchEvent(new Event('submit'));
        await fixture.whenStable();
      }

      it('edits an item: saves it, shows it in its new place and keeps the stored order', async () => {
        const { store, room, toys, fixture, element } = await openWithItems();
        const before = itemsOf(store, room.id, toys.id);

        iconButton(element, 'Edit Cables').click();
        await fixture.whenStable();
        expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Cables');
        typeIn(element, 'item-name', ' Zip ties ');
        typeIn(element, 'item-quantity', '0');
        typeIn(element, 'item-description', 'Black\n8 in');
        typeIn(element, 'item-category', 'hardware');
        await saveEdit(fixture, element);

        const edited = {
          id: before[1].id,
          name: 'Zip ties',
          quantity: 0,
          quantityOut: 0,
          description: 'Black\n8 in',
          category: 'Hardware', // the spelling of the other item is reused
          photoId: null,
        };
        // Same id and same place in the stored order (the order the items were added in).
        expect(itemsOf(store, room.id, toys.id)).toEqual([before[0], edited, before[2]]);
        expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual([before[0], edited, before[2]]);
        // On screen the list is still alphabetical.
        expect(names(element)).toEqual(['Batteries', 'Nails', 'Zip ties']);
        expect(element.querySelectorAll('.item-quantity')[2].textContent?.trim()).toBe('None left');
        expect(element.querySelector('app-item-form')).toBeNull();
        expect(element.querySelector('.item-notice')?.textContent?.trim()).toBe('Saved Zip ties');
        expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (3)');
      });

      it('saves nothing when the edit form has errors or is cancelled', async () => {
        const { store, room, toys, fixture, element } = await openWithItems();
        const before = itemsOf(store, room.id, toys.id);

        iconButton(element, 'Edit Cables').click();
        await fixture.whenStable();
        typeIn(element, 'item-quantity', '10000');
        await saveEdit(fixture, element);
        expect(element.querySelector('.item app-item-form .field-error')?.textContent).toContain(
          'whole number',
        );
        expect(itemsOf(store, room.id, toys.id)).toEqual(before);

        typeIn(element, 'item-quantity', '5');
        panelButton(element, 'Cancel')?.click();
        await fixture.whenStable();
        expect(element.querySelector('app-item-form')).toBeNull();
        expect(itemsOf(store, room.id, toys.id)).toEqual(before);
      });

      it('changes the spelling of a category that only that item uses, and the suggestions follow', async () => {
        const { store, room, toys, fixture, element } = await openWithItems();
        iconButton(element, 'Edit Nails').click();
        await fixture.whenStable();
        typeIn(element, 'item-category', 'HARDWARE');
        await saveEdit(fixture, element);
        expect(itemsOf(store, room.id, toys.id)[0].category).toBe('HARDWARE');
        expect(store.categories()).toEqual(['HARDWARE']);

        iconButton(element, 'Edit Nails').click();
        await fixture.whenStable();
        typeIn(element, 'item-category', '');
        await saveEdit(fixture, element);
        expect(store.categories()).toEqual([]);
      });

      it('removes an item only after the inline confirmation, and saves the change', async () => {
        const { store, room, toys, fixture, element } = await openWithItems();
        const before = itemsOf(store, room.id, toys.id);

        iconButton(element, 'Delete Cables').click();
        await fixture.whenStable();
        expect(element.querySelector('.item .confirm span')?.textContent?.trim()).toBe(
          'Delete "Cables"? This cannot be undone.',
        );
        expect(itemsOf(store, room.id, toys.id)).toEqual(before);

        panelButton(element, 'Cancel')?.click();
        await fixture.whenStable();
        expect(itemsOf(store, room.id, toys.id)).toEqual(before);

        iconButton(element, 'Delete Cables').click();
        await fixture.whenStable();
        (element.querySelector('.item-confirm-delete') as HTMLButtonElement).click();
        await fixture.whenStable();

        expect(itemsOf(store, room.id, toys.id)).toEqual([before[0], before[2]]);
        expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual([before[0], before[2]]);
        expect(names(element)).toEqual(['Batteries', 'Nails']);
        expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (2)');
        expect(element.querySelector('.item-notice')?.textContent?.trim()).toBe('Deleted Cables');
        // The container is still there: only the item was removed.
        expect(store.getById(room.id)?.containers.some((c) => c.id === toys.id)).toBe(true);
      });

      it('stops suggesting a category when its last item is removed', async () => {
        const { store, fixture, element } = await openWithItems();
        expect(store.categories()).toEqual(['Hardware']);
        iconButton(element, 'Delete Nails').click();
        await fixture.whenStable();
        (element.querySelector('.item-confirm-delete') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(store.categories()).toEqual([]);
      });

      it('closes the edit form and discards what was typed when another container is selected', async () => {
        const { store, room, toys, books, fixture, element } = await openWithItems();
        const before = itemsOf(store, room.id, toys.id);
        iconButton(element, 'Edit Cables').click();
        await fixture.whenStable();
        typeIn(element, 'item-name', 'Typed');

        await select(fixture, books.id);
        expect(element.querySelector('app-item-form')).toBeNull();
        await select(fixture, toys.id);
        expect(element.querySelector('app-item-form')).toBeNull();
        expect(names(element)).toEqual(['Batteries', 'Cables', 'Nails']);
        expect(itemsOf(store, room.id, toys.id)).toEqual(before);
      });

      describe('take out, put back and used', () => {
        /** Opens a form from its button, types the units and presses a button of the form. */
        async function run(
          fixture: ComponentFixture<unknown>,
          element: HTMLElement,
          open: string,
          units: string,
          press: string,
        ) {
          iconButton(element, open).click();
          await fixture.whenStable();
          typeIn(element, 'item-units', units);
          const pressed = Array.from(element.querySelectorAll('app-item-units-form button')).find(
            (b) => b.textContent?.trim() === press,
          ) as HTMLButtonElement;
          pressed.click();
          await fixture.whenStable();
        }

        /** What the row of "Nails" shows: its quantity and its "out" line. */
        function nailsRow(element: HTMLElement) {
          const row = iconButton(element, 'Edit Nails').closest('.item') as HTMLElement;
          return [
            row.querySelector('.item-quantity')?.textContent?.trim(),
            row.querySelector('.item-out')?.textContent?.trim(),
          ];
        }

        it('follows the example: take out 20, used 15, put back 5', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          const amounts = () => {
            const nails = itemsOf(store, room.id, toys.id)[0];
            return [nails.quantity, nails.quantityOut];
          };
          expect(nailsRow(element)).toEqual(['Qty 100', undefined]);

          await run(fixture, element, 'Take out Nails', '20', 'Take out');
          expect(amounts()).toEqual([100, 20]);
          expect(nailsRow(element)).toEqual(['Qty 100', '20 of 100 out']);
          expect(element.querySelector('.item-notice')?.textContent?.trim()).toBe(
            'Took out 20 of Nails',
          );

          await run(fixture, element, 'Used Nails', '15', 'Used');
          expect(amounts()).toEqual([85, 5]);
          expect(nailsRow(element)).toEqual(['Qty 85', '5 of 85 out']);
          expect(element.querySelector('.item-notice')?.textContent?.trim()).toBe(
            'Marked 15 of Nails as used',
          );

          await run(fixture, element, 'Put back Nails', '5', 'Put back');
          expect(amounts()).toEqual([85, 0]);
          expect(nailsRow(element)).toEqual(['Qty 85', undefined]);
          expect(element.querySelector('.item-notice')?.textContent?.trim()).toBe(
            'Put back 5 of Nails',
          );
          expect(iconButton(element, 'Put back Nails')).toBeNull();
          // Saved in the browser storage too.
          expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual(itemsOf(store, room.id, toys.id));
        });

        it('follows the example with the shortcut: mark 15 as used without taking them out', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          await run(fixture, element, 'Take out Nails', '15', 'Mark as used');
          const nails = itemsOf(store, room.id, toys.id)[0];
          expect([nails.quantity, nails.quantityOut]).toEqual([85, 0]);
          expect(nailsRow(element)).toEqual(['Qty 85', undefined]);
          expect(element.querySelector('.item-notice')?.textContent?.trim()).toBe(
            'Marked 15 of Nails as used',
          );
          expect(itemsOf(new RoomStore(), room.id, toys.id)[0].quantity).toBe(85);
        });

        it('the Enter key in the "take out" form takes out and does not use', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          iconButton(element, 'Take out Nails').click();
          await fixture.whenStable();
          typeIn(element, 'item-units', '10');
          element.querySelector('app-item-units-form form')?.dispatchEvent(new Event('submit'));
          await fixture.whenStable();
          const nails = itemsOf(store, room.id, toys.id)[0];
          expect([nails.quantity, nails.quantityOut]).toEqual([100, 10]);
        });

        it('shows "4 of 4 out" when all the units are out, and "None left" when all were used', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          await run(fixture, element, 'Take out Nails', '100', 'Take out');
          expect(nailsRow(element)).toEqual(['Qty 100', '100 of 100 out']);
          expect(iconButton(element, 'Take out Nails')).toBeNull();

          await run(fixture, element, 'Used Nails', '100', 'Used');
          expect(nailsRow(element)).toEqual(['None left', undefined]);
          // The item stays in its container.
          expect(itemsOf(store, room.id, toys.id).map((i) => i.name)).toContain('Nails');
          expect(element.querySelector('.items h3')?.textContent?.trim()).toBe('Items (3)');
        });

        it('saves nothing when the quantity is wrong or the form is cancelled', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          const before = itemsOf(store, room.id, toys.id);
          await run(fixture, element, 'Take out Nails', '101', 'Take out');
          expect(element.querySelector('app-item-units-form .field-error')?.textContent?.trim()).toBe(
            'Quantity must be a whole number from 1 to 100.',
          );
          // The form stays open with its error: try the other button with another wrong value.
          typeIn(element, 'item-units', '1.5');
          panelButton(element, 'Mark as used')?.click();
          await fixture.whenStable();
          expect(element.querySelector('app-item-units-form')).not.toBeNull();
          panelButton(element, 'Cancel')?.click();
          await fixture.whenStable();
          expect(element.querySelector('app-item-units-form')).toBeNull();
          expect(itemsOf(store, room.id, toys.id)).toEqual(before);
        });

        it('blocks editing the quantity below the units out, and says how many are out', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          await run(fixture, element, 'Take out Nails', '20', 'Take out');

          iconButton(element, 'Edit Nails').click();
          await fixture.whenStable();
          expect(element.querySelector('#item-quantity-out')?.textContent?.trim()).toBe(
            '20 are out of the container.',
          );
          typeIn(element, 'item-quantity', '19');
          await saveEdit(fixture, element);
          expect(element.querySelector('.item app-item-form .field-error')?.textContent?.trim()).toBe(
            "Quantity can't be lower than the units that are out (20).",
          );
          let nails = itemsOf(store, room.id, toys.id)[0];
          expect([nails.quantity, nails.quantityOut]).toEqual([100, 20]);

          typeIn(element, 'item-quantity', '50');
          await saveEdit(fixture, element);
          nails = itemsOf(store, room.id, toys.id)[0];
          expect([nails.quantity, nails.quantityOut]).toEqual([50, 20]);
          expect(nailsRow(element)).toEqual(['Qty 50', '20 of 50 out']);
        });

        it('says in the delete confirmation that units are out, and removes the item', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          await run(fixture, element, 'Take out Nails', '20', 'Take out');
          iconButton(element, 'Delete Nails').click();
          await fixture.whenStable();
          expect(element.querySelector('.item .confirm span')?.textContent?.trim()).toBe(
            'Delete "Nails"? 20 of 100 are out of the container. This cannot be undone.',
          );
          (element.querySelector('.item-confirm-delete') as HTMLButtonElement).click();
          await fixture.whenStable();
          expect(itemsOf(store, room.id, toys.id).map((i) => i.name)).toEqual(['Cables', 'Batteries']);
        });

        it('does not rotate the container when the user types "r" in the quantity', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          iconButton(element, 'Take out Nails').click();
          await fixture.whenStable();
          element
            .querySelector('#item-units')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
          await fixture.whenStable();
          expect(store.getById(room.id)?.containers.find((c) => c.id === toys.id)?.rotation).toBe(0);
        });
      });

      describe('photos', () => {
        let photos: FakePhotoStore;
        let urls: ObjectUrls;

        beforeEach(() => {
          photos = new FakePhotoStore();
          urls = stubObjectUrls();
          TestBed.configureTestingModule({
            providers: [
              { provide: PhotoStore, useValue: photos },
              { provide: PhotoProcessor, useValue: { process: async () => fakePhoto('chosen') } },
            ],
          });
        });

        afterEach(() => {
          urls.restore();
          vi.restoreAllMocks();
        });

        async function choosePhoto(fixture: ComponentFixture<unknown>, element: HTMLElement) {
          const input = element.querySelector('input[type="file"]') as HTMLInputElement;
          const file = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' });
          Object.defineProperty(input, 'files', { value: [file], configurable: true });
          input.dispatchEvent(new Event('change'));
          await settle();
          await fixture.whenStable();
        }

        async function submit(fixture: ComponentFixture<unknown>, element: HTMLElement) {
          element.querySelector('app-item-form form')?.dispatchEvent(new Event('submit'));
          await settle();
          await fixture.whenStable();
          await settle();
          await fixture.whenStable();
        }

        /** Adds "Hammer" with a photo to "Toys", through the "Add item" form. */
        async function addWithPhoto(fixture: ComponentFixture<unknown>, element: HTMLElement) {
          panelButton(element, 'Add item')?.click();
          await fixture.whenStable();
          typeIn(element, 'item-name', 'Hammer');
          await choosePhoto(fixture, element);
          await submit(fixture, element);
        }

        it('adds an item with its photo: the photo is saved and the item keeps its id', async () => {
          const { store, room, toys, fixture, element } = await openWithContainers();
          await addWithPhoto(fixture, element);
          const saved = itemsOf(store, room.id, toys.id);
          expect(saved.map((i) => [i.name, i.photoId])).toEqual([['Hammer', 'photo-1']]);
          expect(photos.saved.has('photo-1')).toBe(true);
          expect(photos.deleted).toEqual([]);
          // Saved in the browser storage too: a new store finds the reference.
          expect(itemsOf(new RoomStore(), room.id, toys.id)[0].photoId).toBe('photo-1');
          // The row shows the thumbnail and no "Add photo" button.
          expect(iconButton(element, 'View photo of Hammer')).not.toBeNull();
          expect(iconButton(element, 'Add photo to Hammer')).toBeNull();
        });

        it('adds no item and keeps the form when the photo cannot be saved', async () => {
          photos.failSave = true;
          const { store, room, toys, fixture, element } = await openWithContainers();
          await addWithPhoto(fixture, element);
          expect(itemsOf(store, room.id, toys.id)).toEqual([]);
          expect(element.querySelector('app-item-form .field-error')?.textContent?.trim()).toBe(
            "Couldn't save the photo.",
          );
          expect((element.querySelector('#item-name') as HTMLInputElement).value).toBe('Hammer');
        });

        it('deletes the photo when the store does not save the new item', async () => {
          const { store, room, toys, fixture, element } = await openWithContainers();
          vi.spyOn(store, 'addItem').mockReturnValue(false);
          await addWithPhoto(fixture, element);
          expect(itemsOf(store, room.id, toys.id)).toEqual([]);
          expect(photos.deleted).toEqual(['photo-1']);
          expect(photos.saved.size).toBe(0);
        });

        it('adds a photo to an item from "Add photo" of its row', async () => {
          const { store, room, toys, fixture, element } = await openWithItems();
          iconButton(element, 'Add photo to Cables').click();
          await fixture.whenStable();
          await choosePhoto(fixture, element);
          await submit(fixture, element);
          const cables = itemsOf(store, room.id, toys.id)[1];
          expect([cables.name, cables.photoId]).toEqual(['Cables', 'photo-1']);
          expect(element.querySelector('.item-notice')?.textContent?.trim()).toBe('Saved Cables');
        });

        it('deletes the new photo, and keeps the old one, when the store does not save the edit', async () => {
          const { store, room, toys, fixture, element } = await openWithContainers();
          await addWithPhoto(fixture, element); // "Hammer" with photo-1
          panelButton(element, 'Done')?.click();
          await fixture.whenStable();

          vi.spyOn(store, 'updateItem').mockReturnValue(false);
          iconButton(element, 'Edit Hammer').click();
          await fixture.whenStable();
          await settle();
          await choosePhoto(fixture, element); // replaced: it will be photo-2
          await submit(fixture, element);
          expect(photos.deleted).toEqual(['photo-2']);
          expect(photos.saved.has('photo-1')).toBe(true);
          expect(itemsOf(store, room.id, toys.id)[0].photoId).toBe('photo-1');
        });

        it('does not delete the photo of the item when an edit that keeps it is not saved', async () => {
          const { store, fixture, element } = await openWithContainers();
          await addWithPhoto(fixture, element);
          panelButton(element, 'Done')?.click();
          await fixture.whenStable();

          vi.spyOn(store, 'updateItem').mockReturnValue(false);
          iconButton(element, 'Edit Hammer').click();
          await fixture.whenStable();
          await settle();
          typeIn(element, 'item-name', 'Claw hammer');
          await submit(fixture, element);
          expect(photos.deleted).toEqual([]);
          expect(photos.saved.has('photo-1')).toBe(true);
        });

        it('opens the full photo from the thumbnail', async () => {
          const { fixture, element } = await openWithContainers();
          await addWithPhoto(fixture, element);
          iconButton(element, 'View photo of Hammer').click();
          await fixture.whenStable();
          await settle();
          await fixture.whenStable();
          const viewer = element.querySelector('app-photo-viewer') as HTMLElement;
          expect(viewer.querySelector('img')?.getAttribute('alt')).toBe('Photo of Hammer');
        });

        it('does not rotate the container with the R key on the buttons of the photo field', async () => {
          // Buttons are not typing targets: this is the existing rule, the photo field follows it.
          const { store, room, toys, fixture, element } = await openWithContainers();
          panelButton(element, 'Add item')?.click();
          await fixture.whenStable();
          element
            .querySelector('#item-name')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
          await fixture.whenStable();
          expect(store.getById(room.id)?.containers.find((c) => c.id === toys.id)?.rotation).toBe(0);
        });
      });

      it('does not rotate the container when the user types "r" in the edit form', async () => {
        const { store, room, toys, fixture, element } = await openWithItems();
        iconButton(element, 'Edit Cables').click();
        await fixture.whenStable();
        for (const id of ['item-name', 'item-description']) {
          element
            .querySelector(`#${id}`)
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
        }
        await fixture.whenStable();
        expect(store.getById(room.id)?.containers.find((c) => c.id === toys.id)?.rotation).toBe(0);
      });
    });
  });

  it('shows "Room not found" for an unknown id', async () => {
    const { element } = await open('does-not-exist');
    expect(element.querySelector('h1')?.textContent).toContain('Room not found');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/rooms');
    expect(element.querySelector('app-room-plan')).toBeNull();
  });
});

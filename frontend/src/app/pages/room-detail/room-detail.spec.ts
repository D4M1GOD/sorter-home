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

  it('shows "Room not found" for an unknown id', async () => {
    const { element } = await open('does-not-exist');
    expect(element.querySelector('h1')?.textContent).toContain('Room not found');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/rooms');
    expect(element.querySelector('app-room-plan')).toBeNull();
  });
});

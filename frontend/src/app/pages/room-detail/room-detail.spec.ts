import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RoomStore } from '../../core/room-store';
import { createRoom } from '../../core/room.model';
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

  it('shows "Room not found" for an unknown id', async () => {
    const { element } = await open('does-not-exist');
    expect(element.querySelector('h1')?.textContent).toContain('Room not found');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/rooms');
    expect(element.querySelector('app-room-plan')).toBeNull();
  });
});

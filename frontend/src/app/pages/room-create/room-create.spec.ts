import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { RoomStore } from '../../core/room-store';
import { RoomCreate } from './room-create';

describe('RoomCreate', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [RoomCreate], providers: [provideRouter([])] });
  });

  async function setup() {
    const fixture = TestBed.createComponent(RoomCreate);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input') as HTMLInputElement;
    const form = element.querySelector('form') as HTMLFormElement;
    return { fixture, element, input, form };
  }

  it('shows an error when the name is empty', async () => {
    const { fixture, element, form } = await setup();
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(element.querySelector('.field-error')?.textContent).toContain('required');
    expect(TestBed.inject(RoomStore).rooms()).toEqual([]);
  });

  it('shows an error when the name is only spaces', async () => {
    const { fixture, element, input, form } = await setup();
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(element.querySelector('.field-error')).toBeTruthy();
    expect(TestBed.inject(RoomStore).rooms()).toEqual([]);
  });

  it('limits the input to 60 characters', async () => {
    const { input } = await setup();
    expect(input.getAttribute('maxlength')).toBe('60');
  });

  it('creates the room and goes to its plan page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, input, form } = await setup();
    input.value = 'Garage';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const rooms = TestBed.inject(RoomStore).rooms();
    expect(rooms.length).toBe(1);
    expect(rooms[0].name).toBe('Garage');
    expect(navigate).toHaveBeenCalledWith(['/rooms', rooms[0].id]);
  });
});

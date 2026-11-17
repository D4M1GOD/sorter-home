import { TestBed } from '@angular/core/testing';
import { TOUCH_SCREEN_QUERY, TouchScreen } from './touch-screen';
import { PointerQueryStub, stubMatchMedia } from './touch-screen.testing';

describe('TouchScreen', () => {
  let media: PointerQueryStub;

  afterEach(() => {
    media?.restore();
  });

  it('asks for the media query "(pointer: coarse)"', () => {
    media = stubMatchMedia(true);
    TestBed.inject(TouchScreen);
    expect(TOUCH_SCREEN_QUERY).toBe('(pointer: coarse)');
    expect(media.queries).toEqual(['(pointer: coarse)']);
  });

  it('says yes on a touch screen', () => {
    media = stubMatchMedia(true);
    expect(TestBed.inject(TouchScreen).coarse()).toBe(true);
  });

  it('says no with a mouse', () => {
    media = stubMatchMedia(false);
    expect(TestBed.inject(TouchScreen).coarse()).toBe(false);
  });

  it('says no when the browser has no matchMedia (as in the test environment)', () => {
    const original = window.matchMedia;
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    try {
      expect(TestBed.inject(TouchScreen).coarse()).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it('follows the changes of the screen, in both directions', () => {
    media = stubMatchMedia(false);
    const touch = TestBed.inject(TouchScreen);
    media.setMatches(true);
    expect(touch.coarse()).toBe(true);
    media.setMatches(false);
    expect(touch.coarse()).toBe(false);
  });

  it('is one service for the whole app: it asks once and keeps one listener', () => {
    media = stubMatchMedia(true);
    const first = TestBed.inject(TouchScreen);
    const second = TestBed.inject(TouchScreen);
    expect(second).toBe(first);
    expect(media.queries.length).toBe(1);
    expect(media.listenerCount()).toBe(1);
  });

  it('removes its listener when it is destroyed', () => {
    media = stubMatchMedia(true);
    TestBed.inject(TouchScreen);
    expect(media.listenerCount()).toBe(1);
    TestBed.resetTestingModule();
    expect(media.listenerCount()).toBe(0);
  });

  it('can not be changed from outside: it only gives a read-only signal', () => {
    media = stubMatchMedia(false);
    const touch = TestBed.inject(TouchScreen);
    expect('set' in touch.coarse).toBe(false);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

describe('Home', () => {
  it('has an entry to the search of items, next to the entries of the rooms', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.actions a')).map(
      (a) => [a.textContent?.trim(), a.getAttribute('href')],
    );
    expect(links).toEqual([
      ['Create Room', '/rooms/new'],
      ['Explore Rooms', '/rooms'],
      ['Search items', '/search'],
    ]);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a header with a link to the home page', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('header a');
    expect(link?.textContent).toContain('SorterHome');
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('should have a router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).toBeTruthy();
  });
});

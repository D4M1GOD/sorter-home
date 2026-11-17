import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { PhotoCleanup } from './core/photo-cleanup';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Creates the photo cleanup when the app starts: it deletes the photos that no item uses
    // and keeps watching the rooms. Nothing else asks for it, so it would never be created.
    provideAppInitializer(() => {
      inject(PhotoCleanup);
    }),
  ]
};

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((error: unknown) => {
  // Única excepción a la regla 19: si Angular no arranca, no hay otra forma de dejar el error.
  // oxlint-disable-next-line no-console
  console.error(error);
});

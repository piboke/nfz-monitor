import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideRouter, withHashLocation } from "@angular/router";
import { routes } from "./app.routes";
import { DatasetRepository } from "./core/data/dataset.repository";
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideAppInitializer(() => inject(DatasetRepository).ensureInitialized()),
  ],
};

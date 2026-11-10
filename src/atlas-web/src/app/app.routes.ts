import type { Routes } from "@angular/router";
export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "home" },
  {
    path: "home",
    title: "Przegląd | Atlas i Radar Kolejek NFZ",
    loadComponent: () =>
      import("./modules/home/pages/home-page/home-page.component").then(
        (module) => module.HomePageComponent,
      ),
  },
  {
    path: "atlas",
    title: "Atlas kolejek | Atlas i Radar Kolejek NFZ",
    loadComponent: () =>
      import("./modules/atlas/pages/atlas-page/atlas-page.component").then(
        (module) => module.AtlasPageComponent,
      ),
  },
  {
    path: "radar",
    title: "Radar dostępności | Atlas i Radar Kolejek NFZ",
    loadComponent: () =>
      import("./modules/radar/pages/radar-page/radar-page.component").then(
        (module) => module.RadarPageComponent,
      ),
  },
  {
    path: "reports",
    title: "Raporty | Atlas i Radar Kolejek NFZ",
    loadComponent: () =>
      import(
        "./modules/reports/pages/reports-page/reports-page.component"
      ).then((module) => module.ReportsPageComponent),
  },
  {
    path: "facility",
    title: "Szczegóły placówki | Atlas i Radar Kolejek NFZ",
    loadComponent: () =>
      import(
        "./modules/facility/pages/facility-page/facility-page.component"
      ).then((module) => module.FacilityPageComponent),
  },
  {
    path: "methodology",
    title: "Metodologia | Atlas i Radar Kolejek NFZ",
    loadComponent: () =>
      import(
        "./modules/methodology/pages/methodology-page/methodology-page.component"
      ).then((module) => module.MethodologyPageComponent),
  },
  {
    path: "about",
    title: "O projekcie | Atlas i Radar Kolejek NFZ",
    loadComponent: () =>
      import("./modules/about/pages/about-page/about-page.component").then(
        (module) => module.AboutPageComponent,
      ),
  },
  { path: "**", redirectTo: "home" },
];

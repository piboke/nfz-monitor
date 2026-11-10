import { Injectable, signal } from "@angular/core";
@Injectable({ providedIn: "root" })
export class ThemeService {
  readonly dark = signal(false);
  constructor() {
    try {
      const saved = localStorage.getItem("nfz-theme");
      this.dark.set(
        saved === "dark" ||
          (!saved && matchMedia("(prefers-color-scheme: dark)").matches),
      );
    } catch {
      /* The theme still works when browser storage is unavailable. */
    }
    this.apply();
  }
  toggle(): void {
    this.dark.update((value) => !value);
    this.apply();
    try {
      localStorage.setItem("nfz-theme", this.dark() ? "dark" : "light");
    } catch {
      /* Storage is optional. */
    }
  }
  private apply(): void {
    document.documentElement.dataset["theme"] = this.dark() ? "dark" : "light";
  }
}

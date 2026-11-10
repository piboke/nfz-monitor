import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-about-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: "./about-page.component.html",
})
export class AboutPageComponent {}

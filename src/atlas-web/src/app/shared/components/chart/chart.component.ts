import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
@Component({
  selector: "app-chart",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./chart.component.html",
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild("canvas") canvas!: ElementRef<HTMLCanvasElement>;
  @Input() labels: string[] = [];
  @Input() values: (number | null)[] = [];
  @Input() title = "Wartość";
  @Input() type: "line" | "bar" = "line";
  private chart?: Chart;
  ngAfterViewInit() {
    this.draw();
  }
  ngOnChanges() {
    if (this.canvas) this.draw();
  }
  ngOnDestroy() {
    this.chart?.destroy();
  }
  exportPng() {
    this.draw(true);
    this.chart?.resize(1000, 340);
    const image = this.canvas.nativeElement.toDataURL("image/png");
    this.draw();
    return { title: this.title, image };
  }
  @HostListener("window:beforeprint")
  beforePrint() {
    this.draw(true);
    this.chart?.resize(650, 220);
  }
  @HostListener("window:afterprint")
  afterPrint() {
    this.draw();
    this.chart?.resize();
  }
  private draw(printing = false) {
    const styles = getComputedStyle(document.documentElement);
    const text = printing
      ? "#626b76"
      : styles.getPropertyValue("--muted").trim();
    const accent = printing
      ? "#b60500"
      : styles.getPropertyValue("--red").trim();
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, {
      type: this.type,
      data: {
        labels: this.labels.map((label) =>
          label.length > 50 ? label.slice(0, 47) + "…" : label,
        ),
        datasets: [
          {
            label: this.title,
            data: this.values,
            borderColor: accent,
            backgroundColor: this.type === "bar" ? accent : accent + "18",
            fill: true,
            tension: 0.15,
            pointRadius: 4,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: this.type === "bar", ticks: { color: text } },
          x: { ticks: { color: text, maxRotation: 45 } },
        },
      },
    });
  }
}

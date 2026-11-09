import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  HostListener,
  OnChanges,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
@Component({
  selector: "app-chart",
  standalone: true,
  template: `<div class="chart-frame">
      <canvas #canvas role="img" [attr.aria-label]="title"></canvas>
    </div>
    <details>
      <summary>Dane wykresu w tabeli</summary>
      <table>
        <thead>
          <tr>
            <th>Okres / obszar</th>
            <th>{{ title }}</th>
          </tr>
        </thead>
        <tbody>
          @for (label of labels; track $index) {
            <tr>
              <td>{{ label }}</td>
              <td>{{ values[$index] ?? "brak danych" }}</td>
            </tr>
          }
        </tbody>
      </table>
    </details>`,
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

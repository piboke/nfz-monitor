import {
  AfterViewInit,
  Component,
  ElementRef,
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
  private draw() {
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, {
      type: this.type,
      data: {
        labels: this.labels,
        datasets: [
          {
            label: this.title,
            data: this.values,
            borderColor: "#b60500",
            backgroundColor: this.type === "bar" ? "#b60500" : "#e1060018",
            fill: true,
            tension: 0.15,
            pointRadius: 4,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: this.type === "bar", ticks: { color: "#626b76" } },
          x: { ticks: { color: "#626b76", maxRotation: 45 } },
        },
      },
    });
  }
}

import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

export interface PdfReport {
  title: string;
  generatedAt: Date;
  sourceDate: string | null;
  scope: string;
  national: boolean;
  complete: boolean;
  services: string;
  geography: string;
  category: string;
  from: string;
  to: string;
  metric: string;
  warnings: string[];
  queueCount: number;
  awaiting: number | null;
  medianPcus: number | null;
  pairs: number;
  periods: { period: string; value: number | null; coverage: number }[];
  regions: {
    name: string;
    value: number | null;
    code: string;
    x: number;
    y: number;
  }[];
  groups: {
    name: string;
    queues: number;
    known: number;
    awaiting: number | null;
    removed: number | null;
    pcus: number | null;
  }[];
  changes: {
    name: string;
    delta: number;
    percent: number | null;
    signal: string;
  }[];
  stale: {
    name: string;
    period: string | null;
    date: string | null;
    status: string;
  }[];
  events: { name: string; message: string }[];
  charts: { title: string; image: string }[];
  mapSvg: string;
  url: string;
}
const INK = "#222b36",
  RED = "#b60500",
  MUTED = "#626b76",
  PAPER = "#f2f3f5";
const number = (value: number | null) =>
  value === null
    ? "brak danych"
    : new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(
        value,
      );
const date = (value: Date | string) =>
  new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
const note = (text: string): Content => ({ text, style: "note" });
function table(
  title: string,
  headers: string[],
  rows: (string | number | null)[][],
  widths: (string | number)[],
): Content {
  if (!rows.length)
    return {
      stack: [
        { text: title, style: "h2" },
        note("Brak danych w wybranym zakresie."),
      ],
      unbreakable: true,
    };
  const body: TableCell[][] = [
    [
      {
        text: title,
        colSpan: headers.length,
        bold: true,
        fontSize: 10,
        fillColor: PAPER,
      },
      ...headers.slice(1).map(() => ({ text: "" })),
    ],
    headers.map((text) => ({
      text,
      bold: true,
      fontSize: 8,
      fillColor: PAPER,
    })),
    ...rows.map((row) =>
      row.map((value) =>
        typeof value === "number" ? number(value) : (value ?? "brak danych"),
      ),
    ),
  ];
  return {
    table: {
      headerRows: 2,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths,
      body,
    },
    fontSize: 8,
    layout: "lightHorizontalLines",
    margin: [0, 12, 0, 10],
  };
}
function chart(title: string, image: string, caption: string): Content {
  return {
    unbreakable: true,
    stack: [{ text: title, style: "h2" }, { image, width: 515 }, note(caption)],
    margin: [0, 8, 0, 8],
  };
}
export function reportDefinition(r: PdfReport): TDocumentDefinitions {
  const dots = r.regions
    .map((region) => {
      const size =
        region.value === null
          ? 11
          : 13 +
            Math.sqrt(
              region.value / Math.max(1, ...r.regions.map((x) => x.value ?? 0)),
            ) *
              10;
      return `<circle cx="${region.x * 5}" cy="${region.y * 4.3}" r="${size}" fill="${region.value === null ? "#dfe2e6" : RED}" stroke="white" stroke-width="2"/><text x="${region.x * 5}" y="${region.y * 4.3 + 3}" text-anchor="middle" font-family="Roboto" font-size="9" fill="${region.value === null ? INK : "white"}">${region.value === null ? "-" : number(region.value)}</text>`;
    })
    .join("");
  const svg = r.mapSvg.replace("</svg>", dots + "</svg>");
  const content: Content[] = [
    {
      text: "ATLAS & RADAR / RAPORT ANALITYCZNY",
      fontSize: 8,
      bold: true,
      characterSpacing: 1,
      color: MUTED,
      margin: [0, 0, 0, 14],
    },
    {
      text: r.title,
      fontSize: 24,
      bold: true,
      color: INK,
      margin: [0, 0, 0, 12],
    },
    { text: r.services, fontSize: 11, bold: true, margin: [0, 0, 0, 8] },
    note(
      `${r.geography} | Kategoria: ${r.category} | Okres: ${r.from || "brak"} - ${r.to || "brak"}`,
    ),
    note(
      `Wygenerowano: ${date(r.generatedAt)} | Ostatnia synchronizacja: ${r.sourceDate ? date(r.sourceDate) : "brak"}`,
    ),
    note(
      `Zakres zbioru: ${r.scope}. Kompletność: ${r.complete ? "pełne pobranie zadeklarowanego zakresu" : "zbiór niekompletny"}.`,
    ),
    ...(!r.national
      ? [
          {
            text: "ZAKRES OGRANICZONY - wyniki nie opisują całej Polski.",
            color: RED,
            bold: true,
            margin: [0, 8, 0, 8],
          } as Content,
        ]
      : []),
    ...r.warnings.filter((w) => !w.startsWith("Zakres ograniczony")).map(note),
    {
      table: {
        widths: ["*", "*", "*", "*"],
        body: [
          [
            "Kolejki",
            "Wpisy oczekujących",
            "Mediana PCUŚ (dni)",
            "Porównywalne pary",
          ],
          [r.queueCount, number(r.awaiting), number(r.medianPcus), r.pairs],
        ].map((row, index) =>
          row.map((text) => ({
            text: String(text),
            fontSize: index ? 17 : 8,
            bold: !!index,
            fillColor: PAPER,
            margin: [5, 7, 5, 7],
          })),
        ),
      },
      layout: "noBorders",
      margin: [0, 10, 0, 7],
    },
    note(
      "Podsumowanie ostatnich dostępnych wartości może obejmować różne okresy źródłowe. Wpisy nie oznaczają unikalnych pacjentów.",
    ),
    ...(r.periods.length < 2 || r.pairs === 0
      ? [
          {
            text: "Niewystarczająca historia porównywalnych kolejek do ustalenia trendu. Nie odtwarzamy jej sztucznie z bieżących danych.",
            color: RED,
            fontSize: 9,
            margin: [0, 8, 0, 8],
          } as Content,
        ]
      : []),
  ];
  if (r.charts[0])
    content.push(
      chart(
        `${r.metric} według okresów źródłowych`,
        r.charts[0].image,
        "Poziomy obejmują kolejki raportujące w danym okresie. Zmiana pokrycia może zmienić sumę; pary porównujemy osobno.",
      ),
    );
  content.push(
    table(
      "Pokrycie szeregu czasowego",
      ["Okres", "Wartość", "Kolejki z danymi"],
      r.periods.map((p) => [p.period, p.value, p.coverage]),
      ["*", "*", "*"],
    ),
  );
  content.push({
    pageBreak: "before",
    stack: [
      { text: `Województwa - ${r.metric}`, style: "h2" },
      {
        columns: [
          {
            stack: [
              { svg, width: 230 },
              note(
                "Mapa punktowa. Rozmiar oznacza wartość; znak - oznacza brak danych.",
              ),
            ],
            width: 240,
          },
          {
            stack: [
              table(
                "Ostatni dostępny stan",
                ["Województwo", "Wartość"],
                r.regions.map((g) => [g.name, g.value]),
                ["*", 58],
              ),
            ],
            width: 260,
          },
        ],
        columnGap: 15,
      },
    ],
  });
  if (r.charts[1])
    content.push(
      chart(
        "Porównanie obszarów - ostatni dostępny stan",
        r.charts[1].image,
        "Własne zestawienie, nie oficjalny wskaźnik regionalny NFZ. Daty źródłowe poszczególnych kolejek mogą się różnić.",
      ),
    );
  content.push({
    stack: [
      table(
        "Zestawienie według wybranego grupowania",
        [
          "Obszar / grupa",
          "Kolejki",
          "Wpisy",
          "Skreśleni po świadczeniu",
          "Mediana PCUŚ",
        ],
        r.groups.map((g) => [
          g.name,
          `${g.queues} (${g.known} ze statystyką)`,
          g.awaiting,
          g.removed,
          g.pcus,
        ]),
        ["*", 55, 65, 65, 65],
      ),
    ],
    pageBreak: "before",
  });
  if (r.charts[2])
    content.push(
      chart(
        `Zmiana procentowa - ${r.from} do ${r.to}`,
        r.charts[2].image,
        "Wyłącznie wspólne kolejki w tej samej kategorii i miejscu. Dla podstawy zero procent pozostaje nieokreślony.",
      ),
    );
  content.push(
    table(
      `Zmiany na wspólnych kolejkach - ${r.from} do ${r.to}`,
      ["Placówka / kolejka", "Zmiana", "Zmiana %", "Sygnał"],
      r.changes.map((c) => [
        c.name,
        c.delta,
        c.percent === null ? "brak podstawy (0)" : number(c.percent) + "%",
        c.signal,
      ]),
      ["*", 48, 60, 105],
    ),
  );
  content.push(
    table(
      "Aktualność i braki w danych",
      ["Placówka", "Okres statystyk", "Aktualizacja PCUŚ", "Status"],
      r.stale.map((q) => [q.name, q.period, q.date, q.status]),
      ["*", 65, 70, 105],
    ),
  );
  content.push(
    table(
      "Sygnały jakości - ostatnia synchronizacja",
      ["Placówka / kolejka", "Sygnał"],
      r.events.map((e) => [e.name, e.message]),
      ["*", "*"],
    ),
  );
  content.push(
    note(
      "Anomalia jest sygnałem do weryfikacji, nie dowodem nieprawidłowości. Tekstowy PCUŚ opisuje ograniczenie przeliczenia na dni, a nie błąd placówki.",
    ),
  );
  content.push(
    { text: "Źródła, metodologia i ograniczenia", style: "h2" },
    note("Źródło: Narodowy Fundusz Zdrowia, API Terminy Leczenia PCUŚ."),
    {
      text: "https://api.nfz.gov.pl/ | https://apinfz.nfz.gov.pl/app-itl-api-pcus/",
      fontSize: 8,
      color: MUTED,
      margin: [0, 0, 0, 8],
    },
    note(
      "Wpisy oczekujących sumujemy jako wpisy w kolejkach, nie unikalnych pacjentów. Skreśleni oznaczają osoby skreślone z powodu udzielenia świadczenia, nie wszystkie procedury. Braki pozostają brakami.",
    ),
    note(
      "PCUŚ jest prognozą, nie gwarantowaną datą przyjęcia. Mediana obejmuje tylko jawne wartości w dniach (N dni / 1 dzień). Tekstowe przedziały pozostają w oryginalnej postaci. Nie sumujemy czasów oczekiwania ani nie uśredniamy średnich regionalnych.",
    ),
    note(
      "Oś czasu używa okresów statystyk lub dat aktualizacji PCUŚ, z ostatnią pobraną rewizją każdego okresu. Zmiany obejmują wspólne identyfikatory kolejek, tę samą kategorię, świadczenie i miejsce. Procent = (koniec - początek) / początek × 100; przy podstawie zero brak wyniku. Zmiany pokrycia raportowania mogą zmienić poziomy sum.",
    ),
    note(
      "Aktualność wymaga statystyk nie starszych niż dwa miesiące i aktualizacji PCUŚ nie starszej niż 35 dni. Są to własne progi analityczne. Długość kolejki nie ocenia jakości leczenia ani gospodarności.",
    ),
    {
      text: "Konfiguracja raportu w aplikacji",
      link: r.url,
      color: RED,
      fontSize: 8,
      margin: [0, 8, 0, 0],
    },
  );
  return {
    pageSize: "A4",
    pageMargins: [40, 48, 40, 48],
    compress: true,
    defaultStyle: { font: "Roboto", fontSize: 9, color: INK, lineHeight: 1.18 },
    info: {
      title: r.title,
      author: "Atlas i Radar Kolejek NFZ",
      subject: r.services,
      creationDate: r.generatedAt,
    },
    header: () => ({
      text: "ATLAS & RADAR KOLEJEK NFZ",
      color: MUTED,
      fontSize: 7,
      margin: [40, 22, 40, 0],
    }),
    footer: (page, total) => ({
      columns: [
        { text: "Źródło: NFZ | PCUŚ jest prognozą.", width: "*" },
        { text: `${page} / ${total}`, alignment: "right", width: 70 },
      ],
      fontSize: 7,
      color: MUTED,
      margin: [40, 18, 40, 0],
    }),
    styles: {
      h2: { fontSize: 13, bold: true, color: INK, margin: [0, 16, 0, 9] },
      note: {
        fontSize: 8,
        color: MUTED,
        lineHeight: 1.3,
        margin: [0, 4, 0, 6],
      },
    },
    content,
  };
}
export async function downloadReport(r: PdfReport): Promise<void> {
  const [pdfModule, fontModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdf = pdfModule.default;
  pdf.addVirtualFileSystem(fontModule.default);
  const blob = await pdf.createPdf(reportDefinition(r)).getBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `raport-nfz-${r.generatedAt.toISOString().slice(0, 10)}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

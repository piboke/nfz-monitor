# Architektura i kontrakty

`NFZ → klient HTTP → checkpointy → walidacja → domena → historia i agregacje → statyczny Angular`

- `NfzAtlas.Domain`: modele, kontrakt `INfzSource`, identyfikatory, kody województw NFZ. Bez infrastruktury i bibliotek UI.
- `NfzAtlas.Application`: normalizacja i obliczenia (mediana, porównania na wspólnych kolejkach, aktualność, anomalie).
- `NfzAtlas.Infrastructure`: klient NFZ, retry, paginacja, pliki JSON/GZip, transakcyjny wydawca generacji.
- `NfzAtlas.ETL`: konsolowy punkt wejścia, zakres pobrania, anulowanie, blokada uruchomienia, koordynacja.
- `atlas-web`: Angular 21, standalone, SCSS, Chart.js, Leaflet + markercluster. Nawigacja hash i konfiguracje w URL. Bez komunikacji z API NFZ z przeglądarki.

Przyszły ASP.NET może wywoływać te same klasy aplikacyjne i podmienić `INfzSource` lub warstwę publikacji. Nie ma zależności domeny od HTTP, systemu plików czy Angulara. Integracje kontraktów, finansowania i jakości powinny być oddzielnymi adapterami, łączonymi jawnymi identyfikatorami NFZ/REGON; w tej wersji ich nie implementujemy.

## Przechowywanie

Na gałęzi `data`:

```
data/
  manifest.json
  history/<province>/<case>/<benefit-id>.json.gz
  snapshots/<generation>.json.gz
  aggregates/<generation>/
    summary.json
    <province>/<case>/<benefit-id>.json
    <province>/<case>/<benefit-id>.history.json
    <province>/<case>/<benefit-id>.quality.json
    providers/<province>/<provider-code>.json
checkpoints/<partition>/
  state.json
  <page>.json.gz
```

`QueueRow` zawiera oryginalny UUID kolejki, identyfikator miejsca, kod i nazwę świadczeniodawcy, dane adresowe, kategorię, nazwę świadczenia, statystyki miesięczne, PCUŚ i osobne daty źródłowe. Wartości nieznane to JSON `null`. Kod świadczenia jest `null`: API go nie dostarcza. `benefitId` to 96-bitowy prefiks SHA-256 ujednoliconej nazwy (Unicode NFC, wielkie litery, pojedyncze spacje), nie kod NFZ.

Identyfikator miejsca jest hashem kodu województwa, kodu świadczeniodawcy, numeru księgi rejestrowej, części VII/VIII kodu resortowego, nazwy miejsca, miejscowości i adresu. Nie zależy od kolejności wyników ani dnia pobrania. Zmiana adresu/nazwy miejsca tworzy nową tożsamość analityczną; nie sklejamy automatycznie obserwacji. UUID źródłowy plus kategoria służy do identyfikacji kolejki. Zmiany UUID NFZ wymagają jawnej mapy migracji; nie dopasowujemy podobieństwem nazw.

`Observation` zawiera `fingerprint`, `retrievedAt`, `schemaVersion` i pełny `QueueRow`. Dodajemy obserwację, jeśli znormalizowana zawartość lub kanoniczna zawartość surowego rekordu zmieniła się względem ostatniej rewizji. Oryginalne wartości pól niewykorzystywanych w UI także pozostają w źródłowym archiwum. Archiwum `snapshots` zachowuje surowe rekordy NFZ dla zmienionych obserwacji, bez nadpisywania ich pól. Normalizacja zachowuje oryginalne teksty wskaźników. Archiwum surowych rekordów jest oddzielone od plików publikowanych i skompresowane GZip. Nie tworzymy punktów historycznych za sam upływ dnia.

`HistoryPoint` to odchudzona projekcja historii do wykresów: identyfikatory, kategoria, okres sprawozdawczy, data PCUŚ, trzy wskaźniki i data pobrania. Frontend wybiera ostatnią rewizję każdego źródłowego okresu dla danej kolejki/kategorii. `Aggregate` ujawnia licznik dostępnych wartości i wspólnych kolejek obok sum i zmian. `QualityEvent` opisuje sygnał wymagający sprawdzenia.

Manifest zawiera wersję kontraktu, zakres, flagi kompletności i pokrycia kraju, ostatnią udaną synchronizację, dostępne okresy/województwa, spis shardów i rozmiary. Żaden widok Atlasu nie pobiera całej krajowej bazy: użytkownik wybiera świadczenie, a klient czyta tylko jego shardy (ewentualnie wybranego województwa/kategorii). Szczegóły pobierają oddzielny plik wybranego świadczeniodawcy. Ekran główny używa małych agregacji i nie pobiera rekordów kolejek.

## Bezpieczna publikacja

Pobieranie i walidacja wszystkich wymaganych partycji poprzedzają publikację. Nowe pliki powstają w katalogu transakcyjnym, z kopią trwałego archiwum. Po udanej walidacji katalog danych jest przełączany z kopią zapasową; błędy pozostawiają poprzednią generację. Manifest jest punktem zatwierdzenia wewnątrz generacji. GitHub zatwierdza kompletny zestaw jednym commitem. Deployment publikuje jedną migawkę artefaktu Pages. Nie ma mieszania shardów z różnych generacji.

Blokada pliku uniemożliwia równoczesne procesy ETL używające tego samego katalogu roboczego. GitHub Actions ma jedną grupę `nfz-data-writer` bez anulowania trwającego zapisu. Push bez `--force` odrzuca konflikt z zewnętrznym zapisem do gałęzi danych. W takim przypadku weryfikujemy gałąź i ponawiamy proces, zamiast nadpisywać archiwum.

Celowo nie dodano SQLite/DuckDB przed zmierzeniem całego kraju: pobieranie ma trzy ograniczone strumienie, archiwum shardowane, a przetwarzanie odbywa się w pamięci. Ten wybór należy ponownie ocenić przy wzroście pamięci albo czasu odczytu historii. Limity publikacji zatrzymują przekroczenie budżetu; nie usuwają danych po cichu.

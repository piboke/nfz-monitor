# Atlas i Radar Kolejek NFZ

Publiczny portal analizy dostępności świadczeń: **[piboke.github.io/nfz-monitor](https://piboke.github.io/nfz-monitor/)**.

Angular 21 + .NET 10. Statyczny frontend, bez backendu, logowania i śledzenia. Dane pochodzą z aktualnego [API Terminy Leczenia PCUŚ](https://apinfz.nfz.gov.pl/app-itl-api-pcus/), nie z dawnego API pierwszych wolnych terminów. Kod: MIT; zasady wykorzystania danych: [regulamin NFZ](https://apinfz.nfz.gov.pl/app-itl-api-pcus/swagger-ui/statute.html).

## Uruchomienie

Wymagane .NET SDK 10 i Node 22 (minimum dla Angular 21: Node 20.19).

```sh
dotnet restore NfzAtlas.sln
dotnet test NfzAtlas.sln
npm ci --prefix src/atlas-web
npm start --prefix src/atlas-web
```

Otwórz adres wypisany przez Angular CLI. `prestart` i `prebuild` kopiują wyłącznie manifest i bieżące agregacje do plików publicznych. Archiwum źródłowe nie trafia na Pages.

```sh
npm run check --prefix src/atlas-web
npm test --prefix src/atlas-web
npm run build --prefix src/atlas-web -- --base-href /nfz-monitor/
dotnet format NfzAtlas.sln --verify-no-changes
```

## Dane i synchronizacja

```sh
# Pomiar wolumenu bez zapisu danych (32 pierwsze strony)
dotnet run --project src/NfzAtlas.ETL -- --measure true

# Pełny kraj: 16 województw × 2 kategorie, wszystkie świadczenia
dotnet run --project src/NfzAtlas.ETL --configuration Release

# Mniejszy rzeczywisty zakres do weryfikacji, w osobnym katalogu
dotnet run --project src/NfzAtlas.ETL -- --province 07 --benefit 'ODDZIAŁ KARDIOLOGICZNY' --data /tmp/nfz-poc --work /tmp/nfz-checkpoints
```

Kody województw są kodami **NFZ**, nie TERYT. `--province` i `--case` przyjmują listy oddzielone przecinkami. Domyślnie obie kategorie. Filtr `benefit` API wyszukuje nazwy, więc może objąć też świadczenia z dłuższą nazwą. Nazwy zachowujemy dokładnie.

Repozytorium kodu zawiera początkowy zbiór **82 rzeczywistych kolejek oddziałów kardiologicznych w Mazowieckiem, pobrany 9 listopada 2026**. Jest kompletny wyłącznie w zadeklarowanym zakresie i wyraźnie oznaczony w interfejsie. Publiczna witryna korzysta z pełnego zbioru na gałęzi `data`: **148 014 kolejek, 16 województw, obie kategorie**, zweryfikowanego i opublikowanego lokalnie 9 listopada 2026. Mały zbiór w gałęzi kodu umożliwia szybkie uruchomienie projektu. Historycznych trendów nie można odtworzyć z pojedynczego bieżącego pomiaru; powstają wraz z kolejnymi danymi źródłowymi.

Automat **Synchronizacja NFZ** działa codziennie o 02:17 UTC (03:17 zimą / 04:17 latem w Polsce) oraz na żądanie przez Actions → Run workflow. Trwałe dane i checkpointy zapisuje na gałęzi `data`. Dane nie zależą od cache ani artefaktów workflow. Przy błędzie poprzedni manifest i zestawienia pozostają aktualną publikacją.

Pełne dane można przetwarzać i publikować lokalnie, bez uruchamiania pobrania w Actions. Zachowaj gałąź `data` i używaj jednego piszącego procesu; przed lokalnym zapisem upewnij się, że dzienny ETL nie jest aktywny.

```sh
git fetch origin data
git worktree add --detach .etl-local origin/data
dotnet run --project src/NfzAtlas.ETL --configuration Release -- --data .etl-local/data --work .etl-local/checkpoints
NFZ_DATA_DIR=.etl-local/data node scripts/validate-data.mjs
NFZ_DATA_DIR=.etl-local/data npm start --prefix src/atlas-web
# Po walidacji zapisz dane w worktree i wypchnij commit na gałąź data.
# Następnie uruchom sam workflow GitHub Pages, bez ponownego ETL.
```

## GitHub Pages

1. Publiczne repozytorium, Settings → Pages → Source: **GitHub Actions**.
2. Actions muszą być włączone. Workflow ETL wymaga `contents: write`; deployment `pages: write` i `id-token: write`.
3. Wypchnij kod na `main`. Workflow CI sprawdzi kod; GitHub Pages zbuduje frontend; pierwszą synchronizację uruchom ręcznie w Actions, a następne wykona harmonogram.
4. Po udanej synchronizacji workflow Pages pobierze gałąź danych i opublikuje nową generację. Commit wykonany przez `GITHUB_TOKEN` nie uruchamia zwykłego workflow `push`, dlatego używamy także `workflow_run`.
5. Adres projektu: `https://<owner>.github.io/<repository>/`. Build ustawia `base href` na nazwę repozytorium; nawigacja `#/atlas` nie wymaga reguł rewrite.

## Funkcje

- Atlas: autocomplete świadczeń, filtry obszaru, placówki, kategorii, flagi świadczeń dla dzieci i PCUŚ; sortowanie, paginacja, porównanie do czterech kolejek, szczegóły świadczeniodawcy.
- Mapa: Leaflet + markercluster, wyłącznie współrzędne NFZ. Puste współrzędne pozostają puste. Kafelki OSM pobierane tylko po otwarciu mapy, bez prefetch i geokodowania.
- Radar: obserwacje, rewizje źródłowych okresów, porównania na wspólnych kolejkach, aktualność i sygnały dużych zmian.
- Raporty: siedem konfiguracji, wykresy liniowe i słupkowe, tabela zmian procentowych, grupowanie oraz konfiguracja w URL.
- **Pobierz raport PDF** generuje i pobiera dokument A4 bezpośrednio w przeglądarce przez pdfmake. Lokalne fonty Roboto zapewniają polskie znaki. Dokument ma wykresy, mapę wektorową, powtarzane nagłówki tabel, numerację stron, źródła i metodologię. Generator i fonty są ładowane dopiero po wybraniu eksportu. Żadne dane nie są wysyłane do usługi generowania PDF.
- Jasny i ciemny motyw, tabele alternatywne dla wykresów, etykiety formularzy, obsługa klawiatury i responsywny układ.

## Historia, odtwarzanie i ograniczenia

Gałąź `data` zawiera trwałe obserwacje źródłowe, normalizowaną historię i najnowsze agregacje. Nie usuwaj jej podczas sprzątania branchy. Kopia zapasowa: `git clone --mirror https://github.com/piboke/nfz-monitor.git`. Nieudany ETL zachowuje poprzedni manifest i checkpointy. Wznowienie wymaga tego samego katalogu `--work`; po 12 godzinach lub zmianie liczników partycja jest pobierana od nowa. Brakujące strony checkpointu są uzupełniane i walidowane.

Odtwarzanie historii z zachowanych źródeł, bez połączenia z API:

```sh
dotnet run --project src/NfzAtlas.ETL -- --data /ścieżka/do/archiwum/data --work /tmp/nfz-recovery --rebuild-history true
```

Po odtworzeniu uruchom pełny ETL, aby odnowić agregacje. Daty pobrania, źródłowe okresy i rewizje są zachowywane. Nie twórz punktów historycznych z samych dat uruchomienia procesu.

Porównania obejmują wspólne identyfikatory kolejek, kategorię, świadczenie i placówkę. Procent = (koniec − początek) / początek × 100; dla podstawy zero brak wyniku. Mediana PCUŚ obejmuje wyłącznie jawne wartości w dniach. Tekstowych przedziałów nie przeliczamy arbitralnie. Aktualność wymaga okresu statystyk nie starszego niż dwa miesiące i daty PCUŚ nie starszej niż 35 dni. Szczegółowe definicje są w sekcji **Metodologia** aplikacji.

Wpisy w kolejkach nie są liczbą unikalnych pacjentów, skreśleni z powodu udzielenia świadczenia nie oznaczają wszystkich procedur, PCUŚ nie gwarantuje daty przyjęcia, a długość kolejki nie mierzy jakości leczenia. Braki nigdy nie są zastępowane zerem. Pierwszy pomiar nie wystarcza do ustalenia trendu.

Budżety: 700 MiB na zestawienia jednej publikacji, 900 MiB na aktywne pliki archiwum i 90 MiB na pojedynczy plik. Przekroczenie zatrzymuje publikację bez usuwania historii. Przy wieloletnim wzroście przenieś zamknięte roczniki do osobnych repozytoriów archiwalnych, zapisz ich adresy i SHA oraz przetestuj odtworzenie. Rotacja nie jest automatyczna. Monitoruj też rozmiar pełnego klonu Git. Publiczne standardowe runnery Actions są bezpłatne; limity Pages i Actions należy okresowo sprawdzać w dokumentacji GitHub.

## Weryfikacja i zasoby

Testy działają offline: 32 testy xUnit i 8 testów analityki JavaScript. Build, TypeScript, formatowanie i CI są sprawdzane automatycznie. Ręcznie sprawdzono Safari, układ 375 × 667 px, filtry, porównanie, szczegóły placówki, mapę, motywy oraz pobieranie PDF z Pages. Czterostronicowy raport A4 sprawdzono wizualnie po renderowaniu przez PDFKit.

`npm audit --omit=dev`: 0 znanych podatności podczas ostatniej kontroli. Pełny audyt narzędzi builda zgłasza umiarkowane ostrzeżenia dotyczące `glob`; narzędzia te nie są publikowane w witrynie. Nie stosuj bez weryfikacji `npm audit fix --force`, który proponuje obniżenie Angulara.

Kod projektu: MIT (`LICENSE`). Licencje zależności są zbierane przy buildzie w `3rdpartylicenses.txt`. Lokalny font Roboto z pdfmake: [SIL OFL 1.1](src/atlas-web/public/licenses/Roboto-OFL.txt). Kontur Polski opracowano z [datasets/geo-countries](https://github.com/datasets/geo-countries), na podstawie Natural Earth; [licencja źródła](src/atlas-web/public/licenses/geo-countries-MIT.txt). Kafelki mapy: © OpenStreetMap contributors, pobierane wyłącznie po otwarciu mapy, bez geokodowania, pobierania hurtowego i prefetch. Dane NFZ podlegają regulaminowi źródła wskazanemu na początku README.

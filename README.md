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

Repozytorium kodu zawiera początkowy zbiór **82 rzeczywistych kolejek oddziałów kardiologicznych w Mazowieckiem, pobrany 9 listopada 2026**. Jest kompletny wyłącznie w zadeklarowanym zakresie i wyraźnie oznaczony w interfejsie. Pełna synchronizacja zastępuje go dopiero po sprawdzeniu wszystkich partycji. Historycznych trendów nie można odtworzyć z pojedynczego bieżącego pomiaru; powstają wraz z kolejnymi danymi źródłowymi.

Automat **Synchronizacja NFZ** działa codziennie o 02:17 UTC (03:17 zimą / 04:17 latem w Polsce) oraz na żądanie przez Actions → Run workflow. Trwałe dane i checkpointy zapisuje na gałęzi `data`. Dane nie zależą od cache ani artefaktów workflow. Przy błędzie poprzedni manifest i zestawienia pozostają aktualną publikacją.

## GitHub Pages

1. Publiczne repozytorium, Settings → Pages → Source: **GitHub Actions**.
2. Actions muszą być włączone. Workflow ETL wymaga `contents: write`; deployment `pages: write` i `id-token: write`.
3. Wypchnij kod na `main`. Workflow CI sprawdzi kod; GitHub Pages zbuduje frontend; pierwsza synchronizacja uruchomi się przy dodaniu workflow.
4. Po udanej synchronizacji workflow Pages pobierze gałąź danych i opublikuje nową generację. Commit wykonany przez `GITHUB_TOKEN` nie uruchamia zwykłego workflow `push`, dlatego używamy także `workflow_run`.
5. Adres projektu: `https://<owner>.github.io/<repository>/`. Build ustawia `base href` na nazwę repozytorium; nawigacja `#/atlas` nie wymaga reguł rewrite.

## Funkcje

- Atlas: autocomplete świadczeń, filtry obszaru, placówki, kategorii, flagi świadczeń dla dzieci i PCUŚ; sortowanie, paginacja, porównanie do czterech kolejek, szczegóły świadczeniodawcy.
- Mapa: Leaflet + markercluster, wyłącznie współrzędne NFZ. Puste współrzędne pozostają puste. Kafelki OSM pobierane tylko po otwarciu mapy, bez prefetch i geokodowania.
- Radar: obserwacje, rewizje źródłowych okresów, porównania na wspólnych kolejkach, aktualność i sygnały dużych zmian.
- Raporty: siedem konfiguracji, wykresy liniowe i słupkowe, tabela zmian procentowych, grupowanie oraz konfiguracja w URL.
- **Pobierz raport PDF** otwiera natywny wydruk. Wybierz „Zapisz jako PDF”, format A4. Natywne fonty zapewniają polskie znaki; wydruk obejmuje wykresy, powtarzane nagłówki tabel, źródła i metodologię. Żadne dane nie są wysyłane do usługi generowania PDF.
- Jasny i ciemny motyw, tabele alternatywne dla wykresów, etykiety formularzy, obsługa klawiatury i responsywny układ.

## Dokumentacja

- [Architektura i model danych](docs/architecture.md)
- [Zweryfikowany kontrakt API i wolumen](docs/api-research.md)
- [Metodologia](docs/methodology.md)
- [Operacje, odtwarzanie i limity](docs/operations.md)
- [Wymagania źródłowe](docs/requirements.md)

Wpisy w kolejkach nie są liczbą unikalnych pacjentów, PCUŚ nie gwarantuje daty przyjęcia, a długość kolejki nie mierzy jakości leczenia. Braki nigdy nie są zastępowane zerem.

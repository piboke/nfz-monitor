# Utrzymanie, odtwarzanie i budżety

## Trwałość

Gałąź `data` jest archiwum, a nie katalog builda. Zawiera gzip źródłowych zmian, historię normalizowaną, ostatnie zestawienia i checkpointy. GitHub Actions cache nie jest źródłem danych. Nie usuwaj gałęzi `data` przy sprzątaniu branchy. Kopia zapasowa: `git clone --mirror https://github.com/piboke/nfz-monitor.git` i niezależny backup tej kopii.

Jedna grupa współbieżności obejmuje dzienny i ręczny ETL. Nie używamy force-push. Nieudana synchronizacja kończy workflow błędem, zachowuje checkpointy i nie uruchamia deploymentu danych. Poprzednia publikacja działa dalej. Każdy nowy deploy pobiera ostatnią gałąź danych, a nie nadpisuje jej zawartością builda. Świeżo utworzone repo bez gałęzi `data` korzysta z jawnie ograniczonego zbioru startowego.

## Wznowienie

Lokalnie powtórz identyczne polecenie z tym samym `--work`. W Actions wybierz **Synchronizacja NFZ → Run workflow**. Checkpoint przechowuje zakres, start, oczekiwany licznik i następną stronę. Każda strona jest zapisana atomowo, przed przesunięciem checkpointu. Po zmianie licznika albo po 12 godzinach partycja zaczyna się od nowa. Powtórny UUID odrzuca przebieg; usuń katalog checkpointu tej partycji i ponów pobranie. Nie publikuj ręcznie plików z nieudanego pobrania.

## Odtworzenie stanu

```sh
git fetch origin data
git worktree add ../nfz-data-recovery origin/data
```

Skopiuj `data/` z worktree do osobnego checkoutu kodu. `node scripts/validate-data.mjs` sprawdza manifest, liczniki i istnienie plików. `npm run build --prefix src/atlas-web -- --base-href /nfz-monitor/` przygotuje statyczną aplikację.

W celu powrotu po błędnej migracji danych utwórz nowy commit na gałęzi `data` odtwarzający katalog z ostatniego dobrego commita, zachowując późniejsze surowe `snapshots`. Nie przepisuj historii Git. Następnie uruchom ręcznie **GitHub Pages**. Aby przebudować normalizowaną historię ze źródłowych zmian (bez kontaktu z API):

```sh
dotnet run --project src/NfzAtlas.ETL -- --data /ścieżka/do/archiwum/data --work /tmp/nfz-recovery --rebuild-history true
```

Narzędzie zachowuje oryginalne daty pobrania, okresy, rewizje i surowe rekordy. Odrzuca nieobsługiwaną wersję schematu, sprzeczny identyfikator oraz puste archiwum. Zapis historii jest przełączany z kopią zapasową. Po odtworzeniu uruchom pełny ETL, aby odnowić agregacje i manifest; odtwarzanie samo nie ogłasza rekonstruowanego zbioru jako nowej obserwacji krajowej.

Historia normalizowana jest odtwarzana ze źródłowych zmian (`SourceObservation.Source`, `Province`, `Case`, `RetrievedAt`, `SchemaVersion`); należy odtwarzać chronologicznie i użyć wersji normalizacji z tego samego commita kodu. Oryginalne surowe rekordy pozostają rozstrzygające.

Po awarii zasilania lokalnego procesu może pozostać `data.backup` lub `data.staging`. Publisher przy następnym uruchomieniu odtwarza backup, jeśli katalog danych zniknął. Nie kasuj backupu przed sprawdzeniem manifestu. Używaj tego samego katalogu blokady dla procesów zapisujących te same dane.

## Limity darmowej infrastruktury

Źródła: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Actions limits](https://docs.github.com/en/actions/reference/limits), [billing Actions](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions).

Pages: witryna do 1 GB, miękki limit transferu 100 GB/miesiąc, deployment do 10 min. Klasyczne źródłowe repo Pages ma zalecany limit 1 GB. Standardowe GitHub-hosted Actions w publicznym repo są bezpłatne; nie korzystaj z większych płatnych runnerów. Prywatne repo ma inne limity minut i warunki Pages. Włączone workflow w publicznym repo może wymagać reaktywacji harmonogramu po okresie nieaktywności; monitoruj datę ostatniego sukcesu.

Budżety aplikacji: zestawienia jednej publikacji ≤700 MiB, wszystkie bieżące pliki archiwum ≤900 MiB. To twarde bezpieczniki, nie gwarancja długoterminowego zmieszczenia danych w jednym repo. Publikacja jest wstrzymywana przed przekroczeniem; historia nie jest automatycznie usuwana. Git kompresuje pliki gzip mniej skutecznie niż tekst, więc monitoruj także `git count-objects -vH` i rozmiar pełnego klonu. Pojedyncze pliki powinny pozostać poniżej limitu GitHub 100 MiB; sharding po świadczeniu/regionie ogranicza ryzyko, lecz przy wieloletniej historii konieczne będzie również dzielenie po roku.

Strategia długoterminowa: po pierwszym miesiącu zmierz przyrost; przenieś zamknięte roczniki surowych obserwacji do osobnych publicznych repozytoriów archiwalnych, zapisz adres i commit SHA w katalogu archiwum; w witrynie pozostaw najnowszy stan i ograniczone projekcje historyczne. Taką migrację trzeba wykonać jawnie, z testem odtworzenia; nie jest automatycznie wykonywana przez tę wersję. Jeżeli projekcja historii przekroczy 700 MiB, podziel ją także po okresie i dodaj selektywne pobieranie. Nie obiecujemy nieograniczonej historii na darmowym Pages.

## Mapa i prywatność

[Polityka kafelków OSM](https://operations.osmfoundation.org/policies/tiles/): HTTPS, widoczna atrybucja, standardowy Referer, cache przeglądarki zgodnie z nagłówkami, brak pobierania hurtowego i prefetch. Kafelki pojawiają się dopiero po przełączeniu na mapę. OSM nie ma SLA. Przy wzroście ruchu zmień dostawcę w `map.component.ts` i zweryfikuj jego warunki. Kontakt projektu: zgłoszenia w publicznym repozytorium.

Brak GA, cookies analitycznych i kont użytkowników. `localStorage` przechowuje tylko motyw. Konfiguracja raportu znajduje się w URL — nie wpisuj w filtry danych osobowych pacjentów. Aplikacja nie przechowuje danych o pacjentach.

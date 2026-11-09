# Projekt: Atlas i Radar Kolejek NFZ

Jesteś doświadczonym architektem oprogramowania, senior .NET developerem i Angular developerem. Twoim zadaniem jest zaprojektowanie i zaimplementowanie kompletnej aplikacji open-source analizującej dostępność świadczeń zdrowotnych finansowanych przez NFZ.

Nie twórz samego prototypu, makiety ani dokumentacji architektury. Zbuduj działającą aplikację, system pobierania i archiwizacji danych, moduły analityczne, raportowanie oraz automatyczne wdrożenie.

## 1. Cel projektu

System składa się z trzech głównych modułów.

### Atlas Kolejek NFZ

Publiczna wyszukiwarka placówek i świadczeń zdrowotnych, pozwalająca sprawdzić dostępność leczenia w Polsce.

Użytkownik powinien móc odnaleźć świadczenie, porównać placówki, sprawdzić prognozowane oczekiwanie oraz zobaczyć wyniki na mapie.

### Radar Kolejek NFZ

System monitorowania zmian dostępności leczenia.

Powinien gromadzić dane historyczne, identyfikować trendy, porównywać okresy i pokazywać, w których regionach oraz dla jakich świadczeń sytuacja się poprawia lub pogarsza.

### Centrum Raportów

Moduł analityczny służący do agregowania danych, budowania zestawień i generowania raportów PDF.

System ma pozwalać odpowiadać na konkretne pytania o dostępność leczenia na podstawie danych, a nie ocen lub deklaracji.

## 2. Stos technologiczny

Wymagane technologie:

**Frontend**
- Angular 21.
- TypeScript.
- Standalone components.
- SCSS.
- coś do wykresów.
- coś do map.

**Przetwarzanie danych**
- .NET 10, C#.
- Aplikacja konsolowa do ETL.
- System.Text.Json do serializacji.
- SQLite lub DuckDB, jeżeli rzeczywista skala danych uzasadnia wykorzystanie lokalnej bazy podczas przetwarzania.
- xUnit do testów.

**Hosting i automatyzacja**
- GitHub Pages: hosting aplikacji.
- GitHub Actions: pobieranie i przetwarzanie danych, build, testy oraz deployment.
- GitHub: repozytorium kodu i trwałe przechowywanie historii danych.

### Ograniczenia

- Całość ma działać bez płatnych usług.
- Nie wykorzystuj stale działającego backendu ASP.NET Core.
- Nie wymagaj osobnego serwera ani płatnej bazy danych.
- Nie stosuj Firebase, Supabase ani usług Google do przechowywania danych.
- Nie wymagaj logowania użytkowników.
- Nie stosuj Google Analytics ani innych narzędzi śledzących.
- Aplikacja musi działać jako statyczna witryna GitHub Pages.
- Przeglądarka nie może pobierać całej krajowej bazy danych, jeżeli potrzebuje jedynie wybranego fragmentu.

Architektura powinna umożliwiać przyszłe przeniesienie przetwarzania do normalnego backendu ASP.NET bez konieczności przepisywania logiki domenowej.

## 3. Źródła danych

Podstawowym źródłem jest oficjalne API NFZ:

https://apinfz.nfz.gov.pl/app-itl-api-pcus/

Dokumentacja OpenAPI:

https://apinfz.nfz.gov.pl/app-itl-api-pcus/swagger/v1.4/swagger.json

Przed rozpoczęciem implementacji sprawdź aktualność dokumentacji, rzeczywiste endpointy, modele odpowiedzi, paginację oraz ograniczenia korzystania z API.

Nie opieraj implementacji na przestarzałym API pierwszych wolnych terminów.

Pobieraj dostępne informacje dotyczące:

- Rodzaju świadczenia.
- Kodu świadczenia.
- Kategorii medycznej (pilny/stabilny).
- Nazwy i identyfikatorów świadczeniodawcy.
- Placówki realizującej świadczenie.
- Adresu i danych kontaktowych.
- Województwa, powiatu i miejscowości.
- Współrzędnych geograficznych.
- Prognozowanego czasu udzielenia świadczenia (PCUŚ).
- Liczby osób oczekujących.
- Liczby osób skreślonych z kolejki z powodu udzielenia świadczenia.
- Średniego czasu oczekiwania, jeśli jest dostępny.
- Daty aktualizacji informacji.

Nie zakładaj, że wszystkie pola są dostępne dla każdego świadczenia.

Zachowaj oryginalne wartości i znaczenie wskaźników NFZ.

Nie interpretuj PCUŚ jako gwarantowanej daty przyjęcia.

Zaprojektuj możliwość przyszłej integracji z danymi dotyczącymi kontraktów, finansowania i jakości leczenia, ale nie implementuj tych integracji w MVP.

## 4. Architektura systemu
Poniższe dane zakładają, że nie da się zrobić tego w klasyczny sposób jak Longrest, więc jeśli istnieje lepszy sposób możesz zaproponować.
Podstawowy przepływ danych:

NFZ API → .NET ETL → walidacja i normalizacja → historia danych → agregacje → statyczne pliki JSON → Angular

Zastosuj czytelny podział odpowiedzialności.

Proponowana struktura repozytorium:

```text
/
├── src/
│   ├── atlas-web/
│   ├── NfzAtlas.Domain/
│   ├── NfzAtlas.Application/
│   ├── NfzAtlas.Infrastructure/
│   └── NfzAtlas.ETL/
├── tests/
├── data/
│   ├── history/
│   ├── snapshots/
│   ├── aggregates/
│   └── manifest.json
├── .github/
│   └── workflows/
├── docs/
└── README.md
```

Możesz zmienić strukturę, jeżeli prostsza organizacja będzie bardziej uzasadniona.

Skorzystać z higieny i kultury projektowej wypracowanej przy okazji budowania loingrest.pl

Najważniejsze są czytelność, testowalność i możliwość rozwoju.

## 5. Atlas Kolejek NFZ

Zaimplementuj wyszukiwarkę placówek i świadczeń.

### Filtrowanie

- Rodzaj świadczenia z autocomplete.
- Województwo.
- Powiat.
- Miejscowość.
- Placówka.
- Kategoria medyczna.
- Dostępne kategorie wieku pacjentów, jeśli API umożliwia ich wiarygodne rozróżnienie.
- Zakres prognozowanego czasu oczekiwania.

Filtry powinny współdziałać, a użytkownik musi mieć możliwość ich szybkiego resetowania.

### Widok listy

Wyniki w tabeli zawierającej:

- Nazwę placówki.
- Miejscowość.
- Świadczenie.
- Prognozowany czas oczekiwania.
- Liczbę oczekujących.
- Datę aktualizacji danych.

Dodaj sortowanie i paginację.

### Widok mapy

Wyświetlaj placówki na mapie Polski.

Wymagania:
- Grupowanie znaczników.
- Interakcja z filtrami.
- Możliwość przejścia do szczegółów placówki.
- Bez pobierania dodatkowych usług geokodowania, jeśli współrzędne są dostępne w NFZ.
- Poszanowanie zasad korzystania z serwerów kafelków mapowych.

### Szczegóły placówki

Przygotuj stronę zawierającą:

- Informacje o placówce.
- Listę realizowanych świadczeń.
- Aktualne wskaźniki kolejek.
- Historię dostępności leczenia.
- Porównanie z innymi placówkami realizującymi to samo świadczenie.

Umożliwiaj porównanie kilku wybranych placówek.

## 6. Radar Kolejek NFZ

Radar jest kluczowym elementem projektu.

System ma regularnie zbierać dane i zachowywać historię pomiarów.

### Funkcjonalności

- Historia liczby oczekujących.
- Historia prognozowanego czasu oczekiwania.
- Historia liczby osób obsłużonych z kolejki.
- Porównywanie okresów.
- Analiza zmian miesiąc do miesiąca.
- Analiza trendów.
- Porównania regionalne.
- Wykrywanie anomalii.
- Wykrywanie braków i opóźnień w aktualizacji danych.

### Poziomy analizy

Umożliwiaj analizę na poziomie:

1. Konkretnej kolejki w placówce.
2. Placówki.
3. Powiatu.
4. Województwa.
5. Całej Polski.
6. Konkretnego rodzaju świadczenia.

### Wskaźniki

Zaimplementuj między innymi:

- Aktualną liczbę oczekujących.
- Zmianę liczby oczekujących.
- Procentową zmianę liczby oczekujących.
- Zmianę PCUŚ.
- Trend w wybranym okresie.
- Liczbę kolejek objętych analizą.
- Procent kolejek z aktualnymi danymi.
- Liczbę kolejek ze wzrostem lub spadkiem wskazanego wskaźnika.

Nie sumuj ani nie uśredniaj wskaźników, jeśli nie ma to uzasadnienia statystycznego.

W szczególności:
- Nie sumuj czasów oczekiwania.
- Nie przedstawiaj prostych średnich regionalnych jako oficjalnych wskaźników NFZ.
- Nie utożsamiaj liczby wpisów w kolejkach z liczbą unikalnych pacjentów.
- Nie utożsamiaj liczby osób obsłużonych z kolejki z liczbą wszystkich wykonanych procedur.

Dla każdej agregacji opracuj jednoznaczną metodologię.

### Wykrywanie anomalii

Identyfikuj:

- Duże skoki liczby oczekujących.
- Nietypowe zmiany PCUŚ.
- Brak aktualizacji danych.
- Zmianę liczby raportujących placówek.
- Niespójności danych.

Anomalie mają być oznaczane jako zdarzenia wymagające weryfikacji, a nie dowód nieprawidłowości.

## 7. Centrum Raportów

Zaimplementuj interaktywny moduł raportowy.

### Konfiguracja raportu

Użytkownik wybiera:

- Rodzaj świadczenia lub grupę świadczeń.
- Województwo, powiat lub całą Polskę.
- Placówki.
- Zakres dat.
- Kategorię medyczną.
- Interesujące wskaźniki.
- Sposób grupowania i porównania.

### Wizualizacje

- Wykresy liniowe.
- Wykresy słupkowe.
- Wykresy zmian procentowych.
- Mapy tematyczne.
- Tabele porównawcze.
- Zestawienia trendów.

### Gotowe raporty

Przygotuj następujące szablony:

1. Dostępność leczenia w Polsce.
2. Porównanie województw.
3. Kolejki dla wybranego świadczenia.
4. Analiza dostępności leczenia w powiecie.
5. Historia kolejek wybranej placówki.
6. Największe wzrosty i spadki kolejek.
7. Anomalie oraz braki w danych NFZ.

### Eksport PDF

Jedynym formatem eksportu dla użytkownika jest PDF.

Nie implementuj eksportu CSV, JSON, XLSX ani innych formatów danych.

Zaimplementuj przycisk „Pobierz raport PDF”.

Raport PDF powinien zawierać:

- Tytuł.
- Datę wygenerowania.
- Zakres geograficzny.
- Analizowane świadczenia.
- Okres analizy.
- Podsumowanie najważniejszych wskaźników.
- Wybrane wykresy.
- Tabele z wynikami.
- Informacje o źródłach danych.
- Metodologię obliczeń.
- Informację o ograniczeniach danych.

Zapewnij profesjonalny wygląd dokumentów A4.

Generowanie PDF musi odbywać się po stronie przeglądarki, bez płatnego API i bez backendu.

Możesz zastosować bibliotekę client-side do generowania PDF lub dedykowany widok wydruku z CSS i natywnym zapisem do PDF.

Preferuj rozwiązanie obsługujące poprawnie wielostronicowe raporty, polskie znaki i wykresy.

Przygotuj również możliwość udostępnienia konfiguracji raportu za pomocą URL, bez zapisywania danych użytkownika na serwerze.

## 8. Automatyczne pobieranie danych

Zaimplementuj aplikację konsolową .NET 10 uruchamianą przez GitHub Actions.

### Wymagania ETL

- Obsługa paginacji.
- Retry z exponential backoff.
- Obsługa HTTP 429 i nagłówka Retry-After.
- Kontrola równoległości żądań.
- Walidacja odpowiedzi.
- Deduplikacja.
- Wykrywanie zmian schematu.
- Rejestrowanie błędów.
- Możliwość wznowienia pobierania.
- Kontrola kompletności danych.
- Idempotentność przetwarzania.

### Harmonogram

Zaprojektuj domyślną aktualizację raz dziennie.

Najpierw sprawdź:
- Częstotliwość aktualizacji danych źródłowych.
- Wolumen danych.
- Liczbę zapytań.
- Czas pobierania.
- Rozmiar generowanych zestawień.
- Ograniczenia GitHub Actions.

Jeżeli inny harmonogram będzie lepiej uzasadniony, zastosuj go i udokumentuj wybór.

Zaimplementuj również możliwość ręcznego uruchomienia synchronizacji.

### Zachowanie historii

Dane historyczne muszą przetrwać:
- Kolejne uruchomienia workflow.
- Przebudowę aplikacji.
- Ponowny deployment GitHub Pages.
- Nieudane próby aktualizacji.

Nie opieraj trwałego przechowywania na tymczasowym filesystemie runnera ani na cache GitHub Actions.

Zastosuj trwały zapis historii w repozytorium lub dedykowanej gałęzi danych, uwzględniając limity wielkości repozytorium i publikowanej witryny.

Oddziel archiwum źródłowych obserwacji od niewielkich agregacji przeznaczonych dla frontendu.

Zapewnij bezpieczny mechanizm zapisu, eliminujący konflikty między równoległymi workflow.

### Poprawność obserwacji

Zachowuj niezależnie:

- Datę pobrania.
- Datę aktualizacji wskazaną przez NFZ.
- Okres sprawozdawczy.
- Wersję schematu.
- Identyfikatory kolejki i placówki.

Nie twórz sztucznych punktów historycznych, jeśli źródło nie dostarczyło nowych danych dla danego okresu.

Nie publikuj częściowych danych jako kompletnego raportu krajowego.

## 9. Model przechowywania danych

Zastosuj statyczne zestawienia JSON jako źródło informacji dla Angulara.

Zaprojektuj:

- Model aktualnego stanu.
- Model obserwacji historycznej.
- Model placówki.
- Model świadczenia.
- Model agregacji regionalnej.
- Model metadanych jakości danych.

Wprowadź manifest danych zawierający:

- Dostępne okresy.
- Dostępne regiony.
- Dostępne świadczenia.
- Wersję schematu.
- Datę ostatniej synchronizacji.
- Informację o kompletności.

Dane powinny być podzielone logicznie, np. według okresu, województwa lub świadczenia.

Frontend powinien pobierać wyłącznie informacje potrzebne do aktualnie wybranego widoku.

Zastosuj kompresję i ogranicz duplikację danych.

Przygotuj strategię długoterminowego utrzymywania historii przy limitach GitHub Pages.

JSON jest wewnętrznym formatem wymiany danych między ETL a aplikacją. Nie udostępniaj w interfejsie użytkownika funkcji eksportowania JSON ani CSV.

## 10. UX/UI

Zaprojektuj nowoczesny portal analityczny w języku polskim. Użyj barw z ctrlaltpolska.pl jako wzoru, bo są bardzo ładnie dopracowane.

Nie kopiuj wyglądu serwisów administracji publicznej.

### Nawigacja

Główne sekcje:

- Strona główna.
- Atlas.
- Radar.
- Raporty.
- Metodologia.
- O projekcie.

### Strona główna

Powinna zawierać:

- Najważniejsze aktualnie dostępne wskaźniki.
- Trendy dla wybranych świadczeń.
- Mapę Polski.
- Największe zaobserwowane zmiany.
- Szybkie wyszukiwanie świadczeń.
- Informację o aktualności danych.

### Wymagania ogólne

- Responsywność.
- Mobile-first.
- Dark/light mode.
- WCAG AA.
- Czytelne wykresy.
- Intuicyjna nawigacja.
- Spójne komponenty.
- Przejrzyste komunikaty o błędach.
- Stany ładowania i brak wyników.
- Udostępnianie widoków poprzez URL.

Nie używaj przykładowych danych w produkcyjnym interfejsie bez wyraźnego oznaczenia.

## 11. Rzetelność i metodologia

System musi rozróżniać:

- Dane źródłowe.
- Dane przetworzone.
- Wskaźniki obliczone.
- Interpretacje i wnioski.

Każdy wskaźnik powinien mieć definicję i opis metody obliczenia.

Wszystkie raporty powinny zawierać odniesienie do źródła danych.

Nie przedstawiaj wyników analiz jako oceny jakości leczenia w placówce.

Nie wyciągaj wniosków o niegospodarności, nieprawidłowościach ani niewłaściwym zarządzaniu wyłącznie na podstawie długości kolejki.

Nie zastępuj brakujących danych wartościami zero.

Jawnie oznaczaj:
- Niekompletne okresy.
- Nieaktualne dane.
- Zmiany metodologii.
- Nieporównywalne obserwacje.
- Niewystarczającą historię do ustalenia trendu.

## 12. GitHub Actions i GitHub Pages

Zaimplementuj workflow:

**CI**
- Build Angulara.
- Build .NET.
- Testy automatyczne.
- Walidacja jakości kodu.

**ETL**
- Harmonogram.
- Ręczne uruchomienie.
- Pobieranie i aktualizacja historii.
- Walidacja kompletności.
- Generowanie agregacji.
- Zapis danych.

**Deployment**
- Build produkcyjny Angulara.
- Dołączenie statycznych zestawień danych.
- Publikacja na GitHub Pages.

Zapewnij działanie aplikacji na:

`https://<owner>.github.io/<repository>/`

Uwzględnij:
- Poprawny base href.
- Obsługę routingu na statycznym hostingu.
- Poprawne ścieżki do danych.
- Zasady bezpieczeństwa workflow.
- Uprawnienia GitHub Actions.
- Obsługę błędów deploymentu.

Nie zakładaj, że dane przechowywane w katalogu builda przetrwają kolejne wdrożenia.

## 13. Testy

Przygotuj testy dla:

- Mapowania API NFZ.
- Paginacji.
- Retry i limitowania żądań.
- Deduplikacji.
- Normalizacji.
- Aktualizacji historii.
- Stabilności identyfikatorów.
- Agregacji.
- Obliczania trendów.
- Obsługi wartości null.
- Niekompletnych okresów.
- Generowania danych dla frontendu.

Przygotuj testowe fixtures.

Testy jednostkowe muszą działać bez połączenia z API NFZ.

## 14. Dokumentacja

Przygotuj:

- README projektu.
- Instrukcję uruchomienia lokalnego.
- Instrukcję skonfigurowania GitHub Pages.
- Instrukcję uruchamiania ETL.
- Opis architektury.
- Opis modelu danych.
- Dokumentację metodologii analiz.
- Informację o ograniczeniach danych NFZ.
- Instrukcję odtwarzania archiwum.
- Informację o kosztach i limitach hostingu.

## 15. Etapy realizacji

Realizuj projekt w następującej kolejności:

### Etap 1: Fundament

- Analiza API NFZ.
- Ocena wielkości danych.
- Struktura solution .NET i workspace Angular.
- Model domenowy.
- Mechanizm pobierania danych.

### Etap 2: Przetwarzanie

- Normalizacja danych.
- Archiwizowanie historii.
- Generowanie agregacji.
- Walidacja kompletności.
- Pierwszy workflow GitHub Actions.

### Etap 3: Atlas

- Wyszukiwarka.
- Lista placówek.
- Mapa.
- Szczegóły placówki.
- Porównywanie wyników.

### Etap 4: Radar

- Historia.
- Trendy.
- Porównania.
- Dashboardy regionalne.
- Wykrywanie anomalii.

### Etap 5: Raporty

- Kreator raportów.
- Gotowe szablony.
- Wykresy i tabele.
- Eksport PDF.
- Udostępnianie konfiguracji raportów przez URL.

### Etap 6: Publikacja

- Testy.
- Optymalizacja danych.
- CI/CD.
- GitHub Pages.
- Dokumentacja końcowa.

## 16. Kryteria akceptacji

Projekt uznaj za ukończony, jeżeli:

- Aplikacja działa na GitHub Pages.
- Dane są pobierane z aktualnego API NFZ.
- Automatyczna synchronizacja działa.
- Historia nie jest tracona.
- Można wyszukiwać i porównywać placówki.
- Można analizować historyczne zmiany kolejek.
- Można tworzyć raporty analityczne.
- Raporty można zapisywać do PDF.
- Frontend nie wymaga działającego backendu.
- Nie są wymagane płatne usługi.
- Testy przechodzą.
- Dokumentacja umożliwia samodzielne uruchomienie projektu.

## 17. Sposób pracy

Nie zatrzymuj się po przygotowaniu planu ani po utworzeniu pustych komponentów.

Rozpocznij od weryfikacji API NFZ i wykonania technicznego proof of concept pobierania rzeczywistych danych.

Następnie realizuj kolejne etapy, weryfikując działanie każdego z nich.

Podejmuj samodzielnie decyzje implementacyjne, jeżeli nie wpływają istotnie na wymagania produktu.

Preferuj proste, utrzymywalne rozwiązania zamiast skomplikowanej architektury.

Nie wymyślaj danych, endpointów ani wskaźników, których nie potwierdzono w dokumentacji.

Jeżeli napotkasz ograniczenia darmowego hostingu lub dostępności danych, zastosuj racjonalne obejście i opisz jego konsekwencje.

**Oczekiwanym rezultatem jest działająca, publiczna aplikacja z automatycznie aktualizowanymi danymi i historią, a nie wyłącznie kod demonstracyjny.**

Prawdopodobnie szybko przepalisz tokeny, więc projektów prace w batchach/partiach, które da się testować/weryfikować w downtime
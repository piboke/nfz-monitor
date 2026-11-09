# Weryfikacja wdrożenia — 9 listopada 2026

## Automatyczne sprawdzenia

- .NET 10: 30 testów xUnit, bez połączenia z NFZ. Mapowanie rzeczywistego fixture, paginacja, retry i Retry-After, ograniczona współbieżność, wznowienie oraz naprawa brakującej strony checkpointu, deduplikacja, normalizacja, agregacje, porównywalność okresów, transakcja publikacji, odtworzenie archiwum i idempotentność.
- Frontend: 7 testów analityki, sprawdzenie TypeScript, Prettier i produkcyjny build Angular 21.
- `npm audit --omit=dev`: 0 znanych podatności. Pozostałe ostrzeżenia narzędzi builda opisuje [security.md](security.md).
- Początkowy pakiet aplikacji: około 687 kB przed kompresją / 186 kB szacowanego transferu. Generator PDF i lokalne fonty są oddzielnymi fragmentami ładowanymi dopiero na żądanie.

## Ręczna kontrola Safari

Sprawdzono na rzeczywistych danych NFZ: otwarcie publicznego Pages, filtrowanie miejscowości Wyszków, porównanie kolejek, szczegóły świadczeniodawcy, mapę i komunikat o braku współrzędnych, raporty, zmianę motywu oraz układ 375 × 667 px. Brak punktów na mapie nie jest zastępowany wymyśloną lokalizacją.

Przycisk „Pobierz raport PDF” pobrał rzeczywisty dokument wygenerowany lokalnie przez pdfmake. Dokument obejmujący 39 kolejek miał cztery strony A4 i około 115 kB. Każdą stronę wyrenderowano przez PDFKit i sprawdzono wizualnie: polskie znaki, czytelne wykresy, wektorową mapę, tabele z powtarzanymi nagłówkami, podział wierszy, numerację, źródła i metodologię. Raport ujawnia ograniczony zakres i brak porównywalnej historii.

## Ograniczenia interpretacji

Pierwszy pełny pomiar nie tworzy wielomiesięcznej historii. Dopiero kolejne nowe okresy i daty źródłowe umożliwią porównania tych samych kolejek. Bieżące kolejki raportujące różne miesiące nie są traktowane jako trend. Automatyczne testy nie zastępują audytu dostępności WCAG ani kontroli jakości danych przez NFZ.

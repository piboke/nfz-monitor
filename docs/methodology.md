# Metodologia 1.0

Źródłowe liczby są prezentowane oddzielnie od obliczeń własnych. Kod referencyjny: `NfzAtlas.Application/Analytics.cs`, a projekcje interaktywne: `atlas-web/src/app/analytics.mjs`. Testy obu implementacji obejmują braki i porównywalność.

| Wskaźnik | Definicja |
|---|---|
| Wpisy oczekujących | Suma dostępnych `awaiting`. Wpisy, nie unikalni pacjenci. Braki wykluczone i policzone w pokryciu. |
| Skreśleni po świadczeniu | Suma dostępnych `removed` w zadeklarowanym okresie. Nie wszystkie procedury. |
| PCUŚ | Oryginalny tekst NFZ. Nie gwarantowana data. |
| Mediana PCUŚ | Mediana jawnych wartości „N dni” / „1 dzień”; przy parzystej liczbie średnia dwóch środkowych. Własne obliczenie. |
| Zmiana wpisów | Suma różnic na wspólnych kolejkach, w tej samej kategorii, świadczeniu, miejscu i kolejnych miesiącach. |
| Zmiana procentowa | Różnica / suma wartości bazowych × 100. Dla bazowego zera brak wyniku. Kreator wylicza procent również osobno na każdej parze. |
| Zmiana PCUŚ | Mediana różnic na porównywalnych kolejkach, względem poprzedniej aktualizacji źródłowej. |
| Trend | Kierunek jawnej zmiany między wybranymi okresami; bez ekstrapolacji lub prognoz własnych. Minimum dwa punkty źródłowe. |
| Liczba kolejek | Liczba rekordów kolejka/kategoria w danym zakresie. Nie liczba placówek. |
| Aktualność | Okres statystyk bieżący lub do dwóch miesięcy wstecz i PCUŚ do 35 dni wstecz; daty przyszłe odrzucone. |
| Pokrycie | Liczba rekordów z wartością / liczba wszystkich kolejek w danym zakresie. Pokrycie kraju jest osobną flagą. |
| Wzrosty/spadki | Liczba wspólnych kolejek z dodatnią/ujemną zmianą wartości; brak i brak pary nie są zerową zmianą. |

Agregaty „ostatni stan” mogą obejmować różne źródłowe miesiące; komunikujemy to w interfejsie i PDF. Szeregi okresowe używają właściwego okresu źródłowego, ostatniej dostępnej rewizji i ujawniają liczność. Zmieniająca się liczba raportujących kolejek może zmienić poziom sumy; porównania zmian obejmują wyłącznie wspólne rekordy. Nie uśredniamy średnich regionalnych ani nie sumujemy dni.

Przy braku nowego źródłowego okresu lub zmiany wartości ponowne pobranie nie tworzy nowej obserwacji. Zmiana danych kontaktowych może utworzyć rewizję techniczną, ale nie nowy okres na wykresie. Historię na wykresie deduplikujemy osobno dla statystyk i PCUŚ.

Anomalie: wzrost/spadek wpisów ≥50 i ≥50% (przy zerze bazy tylko próg bezwzględny), zmiana PCUŚ ≥90 dni, daty nieaktualne, tekst PCUŚ nieprzeliczalny jednoznacznie, zmiany liczby raportujących kolejek. Niespójne schematy, ujemne statystyki i niekompletne pobrania zatrzymują publikację. Zdarzenia oznaczają potrzebę weryfikacji, nie dowód nieprawidłowości. Kolejki nie są oceną jakości leczenia lub gospodarności.

# Weryfikacja API — 9 listopada 2026

Źródło: https://apinfz.nfz.gov.pl/app-itl-api-pcus/ . Interfejs dokumentacji: **1.4.1**, OpenAPI: **v1.4**, OpenAPI 3.0.4. Zapisany kontrakt: `docs/api/swagger-v1.4.json`; regulamin i changelog obok. Sprawdzono rzeczywiste odpowiedzi, nie tylko modele Swaggera.

## Potwierdzone zasoby

- `/queues?province=07&case=1&limit=25&page=1`: metadane `count`, `page`, `limit`; rekordy `data[]` z UUID i `attributes`; linki `first/prev/self/next/last`.
- `/queues/{id}` i `/many-places/{id}` są opisane w kontrakcie; bieżący ETL korzysta z `/queues`.
- Słowniki `/benefits`, `/places`, `/localities`, `/providers`, `/streets`; rozbudowane warianty `/dictionaries/*`, w tym `counties`.
- `/benefits?name=kardiolog&limit=25` zwróciło 11 nazw. Nie zakładamy istnienia dawnych nazw: `PORADNIA KARDIOLOGICZNA` zwróciła zero wyników, `ODDZIAŁ KARDIOLOGICZNY` ma dostępne rekordy. Nie wyciągamy z tego wniosków o braku świadczeń w Polsce.

## Różnice dokumentacji i zachowania

Wywołanie `/queues` bez województwa lub nazwy zwraca HTTP 400 z kodem 1200005 i tekstem wymagającym `province lub name`. Te parametry nie są oznaczone jako wymagane w OpenAPI; dokumentacja wyszukiwania świadczenia nazywa parametr `benefit`. ETL dzieli kraj na województwa i kategorie, zawsze przekazując `province`.

Maksymalna strona: **25**. `case=1` jest domyślną kategorią stabilną, więc zbiór krajowy wymaga osobnych przebiegów dla 1 i 2. Linki są względne wobec katalogu aplikacji; klient nie przechodzi dowolnych adresów z odpowiedzi. Odtwarza zapytanie i sprawdza zgodność kolejnej strony z metadanymi.

`dates.pcus` to tekst, np. `0 dni`, a nie ISO data. `dates.applicable` oznacza zastosowanie PCUŚ; `dates.date-situation-as-at` to aktualizacja prognozy. Statystyki są w `statistics.provider-data`: `awaiting`, `removed`, `average-period`, `update` (np. `2026-09`). `computed-data` jest osobnym, nullable obiektem NFZ. Nie podmieniamy jednego średniego czasu drugim. Współrzędne mogą być `null`.

Nie ma pola kodu świadczenia w `queue-attributes`. Kod resortowy VIII oznacza specjalność komórki i nie jest automatycznie kodem świadczenia. Flaga `benefits-for-children` i opcjonalne `age-range` są zachowane; brak flagi nie oznacza „dorośli”. Filtry wieku API nie gwarantują pełnej charakterystyki pacjentów.

## Limity i częstotliwość

[Regulamin](https://apinfz.nfz.gov.pl/app-itl-api-pcus/swagger-ui/statute.html) podaje **10 żądań/s/IP** i zakazuje przeciążania oraz wprowadzania użytkowników w błąd. Wymaga wskazania źródła https://api.nfz.gov.pl/. Klient używa maksymalnie sześciu równoległych żądań i jednej globalnej bramki startu z odstępem co najmniej 350 ms, wykładniczego backoff z jitterem, sześciu prób, 90 s timeout oraz obu formatów `Retry-After` (sekundy i data HTTP).

Pola statystyczne odnoszą się do miesięcy. Dokumentacja nie zapewnia jednej godziny aktualizacji wszystkich placówek ani SLA dostępności. Daty w próbce były różne i opóźnione względem pobrania. Raz dziennie jest konserwatywnym kompromisem dla zmian PCUŚ i rewizji; nie uzasadnia tworzenia dziennych punktów dla niezmienionych statystyk miesięcznych.

## Zmierzony wolumen

- Mazowieckie, wszystkie świadczenia, stabilni: **10 387 rekordów**, 416 stron.
- Mazowieckie, filtr `ODDZIAŁ KARDIOLOGICZNY`: **41 rekordów na kategorię**, dwie strony. Obie kategorie: **82 rekordy**, cztery shardy po rozdzieleniu rzeczywistych nazw świadczeń (w tym oddziały dla dzieci).
- Techniczny PoC wykonał rzeczywisty przebieg C# z kontrolą stron i granicznych liczników. Zestaw w `data/manifest.json` ujawnia czas pobrania i rozmiar każdego sharda.

Pomiar 32 pierwszych stron (`dotnet run --project src/NfzAtlas.ETL -- --measure true`) wykazał **148 014 rekordów i 5 936 stron**. Zapisano go w `docs/api/volume-2026-11-09.json`. Pomiar trwał 69,5 s; rzeczywisty czas pełnego pobrania zależy od latencji każdej strony i retry. Sama globalna bramka 350 ms daje dolną granicę 34,6 min (plus kontrolne zapytania). Sześć równoległych partycji pozwalają ukryć część latencji bez zwiększania maksymalnej częstotliwości startów. Nie utożsamiamy tego oszacowania z czasem zakończonego pełnego pobrania. Dolna granica czasu to liczba zapytań × 350 ms; należy doliczyć latencję, retry i zapis. Limit procesu ETL: 5 h, joba: 330 min, poniżej limitu 6 h GitHub-hosted runner. Jeżeli źródło lub wolumen przekroczą ten budżet, checkpointy przetrwają na gałęzi danych i publikacja krajowa nie nastąpi częściowo. Checkpoint starszy niż 12 h jest odrzucany, żeby nie sklejać wielodniowej pozornej migawki.

## Kompletność nie oznacza jednoczesności

Każda strona musi mieć oczekiwaną liczność, poprawny numer, stały `count` oraz zgodny `next`. Duplikaty UUID między stronami lub partycjami powodują odrzucenie publikacji. Na końcu sprawdzamy ponownie licznik pierwszej strony. To wykrywa typowe przesunięcia podczas pobrania, ale API nie daje transakcyjnego snapshotu: zmiana zawartości przy stałej liczbie może pozostać niewykryta. Ten limit jest jawny w metodologii.

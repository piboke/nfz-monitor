# Zależności — kontrola 9 listopada 2026

`npm audit --omit=dev`: **0 znanych podatności** w zależnościach produkcyjnych.

Narzędzia builda przypinają poprawione wersje Rollupa 4.59.0 i minimatch 11.0.1. Źródła: [advisory Rollupa](https://github.com/advisories/GHSA-mw96-cpmx-2vgc), [advisory minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249). Lockfile i produkcyjny build sprawdzono po aktualizacji.

Pełny audyt narzędzi deweloperskich nadal zgłasza 12 powiązanych ostrzeżeń umiarkowanych, z jednym źródłem w `glob` (przerwanie przeglądania filesystemu przez AbortSignal): [advisory glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Nie są publikowane w witrynie. CLI nie przyjmuje wzorców glob od użytkowników portalu; wzorce pochodzą z repozytorium, a job builda ma limit czasu. Nie obniżamy Angulara do wersji 16 sugerowanej przez automatyczny `audit fix --force`, ponieważ naruszyłoby to wymagany stos. Aktualizację głównej wersji glob należy osobno zweryfikować z kolejną wersją Angular CLI.

Workflow CI dla pull requestów ma wyłącznie odczyt repozytorium i nie zachowuje poświadczeń checkoutu. Gałąź danych zapisuje tylko workflow ETL z jedną grupą współbieżności; nie używa force-push. Deployment nie publikuje po nieudanej synchronizacji ani po błędzie odczytu istniejącej gałęzi danych.

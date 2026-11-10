export function errorMessage(
  error: unknown,
  fallback = "Wystąpił nieoczekiwany błąd.",
): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Preserve the opaque NFZ code; encode it only when building a safe filename.
export function providerFileKey(code: string): string {
  const bytes = new TextEncoder().encode(code);
  if (!bytes.length || bytes.length > 100)
    throw new Error("Nieprawidłowy kod świadczeniodawcy.");
  return /^\d{1,20}$/.test(code)
    ? code
    : "p-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

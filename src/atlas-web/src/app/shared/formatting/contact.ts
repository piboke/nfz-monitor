export function ageRangeLabel(value: string | null): string {
  if (!value?.trim()) return "NFZ nie podał zakresu wieku.";
  const text = value.trim();
  if (/^\d+(?:\s*[-–]\s*\d+)?(?:\s*[,;]\s*\d+(?:\s*[-–]\s*\d+)?)*$/.test(text))
    return (
      text.replace(/\s*[-–]\s*/g, "–").replace(/\s*[,;]\s*/g, ", ") + " lat"
    );
  return text.replace(/,\s*/g, ", ");
}
export function phoneContacts(
  value: string | null,
): { label: string; href: string | null }[] {
  if (!value?.trim()) return [];
  return [
    ...new Set(
      value
        .split(/[,;\n]|\s+\/\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].map((label) => {
    const base = label
      .split(/\b(?:wew(?:n)?\.?|wewnętrzny|ext\.?)\s*:?/i)[0]
      .trim();
    let dial = base.replace(/[\s().-]/g, "");
    if (/^0[1-9]\d{8}$/.test(dial)) dial = dial.slice(1);
    if (/^\d{9}$/.test(dial)) dial = "+48" + dial;
    return { label, href: /^\+?\d{9,15}$/.test(dial) ? "tel:" + dial : null };
  });
}

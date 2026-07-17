const STOP_WORDS = new Set([
  "and", "are", "for", "from", "has", "into", "its", "the", "this", "that",
  "with", "provides", "provide", "module",
]);

export function moduleSummariesSubstantiallyOverlap(
  first: string,
  second: string,
): boolean {
  const meaningfulWords = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) ?? [],
    );
  const firstWords = meaningfulWords(first);
  const secondWords = meaningfulWords(second);
  const smallerWordCount = Math.min(firstWords.size, secondWords.size);
  if (smallerWordCount === 0) return false;

  const sharedWordCount = [...firstWords].filter((word) =>
    secondWords.has(word),
  ).length;
  return sharedWordCount / smallerWordCount >= 0.6;
}

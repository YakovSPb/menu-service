export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

export function searchScore(query: string, name: string, recipeText?: string | null): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const haystack = `${name} ${recipeText ?? ''}`;
  const haystackTokens = new Set(tokenize(haystack));

  let score = 0;
  for (const token of queryTokens) {
    if (haystackTokens.has(token)) {
      score += 1;
    }
  }

  const normalizedName = normalizeText(name);
  const normalizedQuery = normalizeText(query);
  if (normalizedName.includes(normalizedQuery)) {
    score += 2;
  }

  return score;
}

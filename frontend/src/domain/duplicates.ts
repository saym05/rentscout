import { toDisplayCost } from "./cost";
import type { DuplicateMatch, Listing, RateTable } from "./types";

const STOPWORDS = new Set(["in", "near", "the", "a", "an", "at", "for", "with", "and", "of", "to"]);

export const norm = (s: string): string =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");

export function tokens(s: string): Set<string> {
  return new Set(
    norm(s).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((t) => t && !STOPWORDS.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Weights sum to 1: neighborhood .25, rooms .15, price .25, title .25, area .10 */
export function duplicateScore(a: Listing, b: Listing, rates?: RateTable): Omit<DuplicateMatch, "listingId"> {
  if (a.id === b.id || norm(a.city) !== norm(b.city)) {
    return { score: 0, category: "none", reasons: [] };
  }
  const reasons: string[] = [];
  let score = 0;

  if (norm(a.neighborhood) === norm(b.neighborhood)) {
    score += 0.25;
    reasons.push("same neighborhood");
  }
  if (a.rooms === b.rooms) {
    score += 0.15;
    reasons.push("same number of rooms");
  }

  const ca = toDisplayCost(a, a.currency, rates);
  const cb = toDisplayCost(b, a.currency, rates);
  if (ca && cb) {
    const diff = Math.abs(ca.amount - cb.amount) / Math.max(ca.amount, cb.amount);
    if (diff <= 0.05) {
      score += 0.25;
      reasons.push(`monthly cost within ${Math.round(diff * 1000) / 10}%`);
    } else if (diff <= 0.1) {
      score += 0.12;
      reasons.push(`monthly cost within ${Math.round(diff * 1000) / 10}% (loose)`);
    }
  } else {
    reasons.push("prices not comparable (different currencies, no rate table)");
  }

  const sim = jaccard(tokens(a.title), tokens(b.title));
  if (sim > 0) {
    score += 0.25 * sim;
    reasons.push(`title similarity ${Math.round(sim * 100)}%`);
  }

  if (a.areaSqm !== null && b.areaSqm !== null) {
    if (Math.abs(a.areaSqm - b.areaSqm) / Math.max(a.areaSqm, b.areaSqm) <= 0.05) {
      score += 0.1;
      reasons.push("area within 5%");
    }
  }

  if (a.sourceId !== b.sourceId) reasons.push("listed by different sources");

  const rounded = Math.round(score * 100) / 100;
  const category = rounded >= 0.8 ? "probable" : rounded >= 0.6 ? "possible" : "none";
  return { score: rounded, category, reasons };
}

/** Never deletes or merges anything: only reports candidates, best first. */
export function findDuplicates(target: Listing, all: Listing[], rates?: RateTable): DuplicateMatch[] {
  return all
    .filter((o) => o.id !== target.id)
    .map((o) => ({ listingId: o.id, ...duplicateScore(target, o, rates) }))
    .filter((m) => m.category !== "none")
    .sort((x, y) => y.score - x.score || x.listingId.localeCompare(y.listingId));
}

import MiniSearch, { type Options, type SearchOptions, type SearchResult } from "minisearch";
import type { CategoryId } from "./categories.ts";
import { splitHanded, type Handedness } from "./handedness.ts";
import { forReader, splitText, type Reader } from "./reader.ts";
import type { Situation } from "./schema.ts";

/**
 * Full-text search over situations, shared by the web app and the native app. The index is built
 * at build time (`toSearchIndexJson`) and loaded on the client (`loadSearchIndex`); both sides use
 * the same options, so this module stays free of DOM and Node APIs.
 *
 * Text with direction tokens is indexed once per hand, so a left-hander searching "curving the
 * ball right" finds the draw, and a right-hander finds the fade. Measurements (`{15 yd}`) stay
 * tokens in the stored title and summary, resolved for the reader's units on the way out, and
 * both units are indexed so "meters" and "yards" find the same text.
 */
export const SEARCH_INDEX_VERSION = 2;

/** Which reader a document is for: text without direction tokens is indexed once, as "both". */
export type SearchHand = Handedness | "both";

export interface SearchDoc {
  key: string;
  id: string;
  hand: SearchHand;
  category: CategoryId;
  title: string;
  aliases: string;
  summary: string;
  tags: string;
  text: string;
}

export interface SearchHit {
  id: string;
  category: CategoryId;
  /** Title and summary with directions and measurements resolved for the reader. */
  title: string;
  summary: string;
  score: number;
}

/** Shape of `/data/search-index.json`: public, like situations.json. */
export interface SearchIndexJson {
  version: typeof SEARCH_INDEX_VERSION;
  index: ReturnType<MiniSearch<SearchDoc>["toJSON"]>;
}

const STOP_WORDS = new Set(
  "a an and are as at be by do does for from how i if in into is it its my of on or so than that the then this to too up with what when where which you your".split(
    " ",
  ),
);

/**
 * A deliberately tiny stemmer so "curving", "curves" and "curve" meet. It only has to be
 * consistent between the index and the query, not linguistically right.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length >= 6 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length >= 5 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length >= 5 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length >= 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length >= 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export function processTerm(term: string): string | null {
  const t = term.toLowerCase();
  return STOP_WORDS.has(t) ? null : stem(t);
}

const FIELDS = ["title", "aliases", "summary", "tags", "text"] as const;
const STORED = ["hand", "category", "title", "summary", "aliases"] as const;

/** Query terms as the index sees them, joined: used to spot a whole phrase in a title or alias. */
function phrase(text: string): string {
  return text
    .split(/[\n\r\p{Z}\p{P}]+/u)
    .map((t) => (t ? processTerm(t) : null))
    .filter(Boolean)
    .join(" ");
}

export const SEARCH_OPTIONS: Options<SearchDoc> = {
  idField: "key",
  fields: [...FIELDS],
  storeFields: [...STORED],
  processTerm,
};

const QUERY_OPTIONS: SearchOptions = {
  boost: { title: 4, aliases: 3, tags: 2, summary: 1.5 },
  prefix: true,
  fuzzy: (term) => (term.length > 3 ? 0.2 : false),
};

/** Every piece of searchable text for one situation, by field. */
function fieldsOf(s: Situation): Record<(typeof FIELDS)[number], string> {
  const text = [
    ...(s.setup ?? []),
    ...(s.swing ?? []),
    ...s.expect,
    ...(s.mistakes ?? []),
    s.club_choice ?? "",
    s.drill ?? "",
    s.advanced ?? "",
    s.body,
  ];
  return {
    title: s.title,
    aliases: s.aliases.join("\n"),
    summary: s.summary,
    tags: s.tags.join(" "),
    text: text.join("\n"),
  };
}

const hasTokens = (text: string) => splitHanded(text).some((part) => typeof part !== "string");

/** Every measurement in the text, in both units, so either finds it. */
const measurementWords = (text: string) =>
  splitText(text).flatMap((part) =>
    typeof part !== "string" && part.pref !== "hand"
      ? Object.values(part).filter((v) => v !== part.pref)
      : [],
  );

export function buildSearchDocs(situations: readonly Situation[]): SearchDoc[] {
  return situations.flatMap((s) => {
    const fields = fieldsOf(s);
    const hands: SearchHand[] = Object.values(fields).some(hasTokens)
      ? ["right", "left"]
      : ["both"];
    return hands.map((hand) => {
      // Directions only: measurement tokens are resolved per reader in `searchSituations`.
      const resolve = (text: string) =>
        hand === "both"
          ? text
          : splitHanded(text)
              .map((part) => (typeof part === "string" ? part : part[hand]))
              .join("");
      return {
        key: `${s.id}:${hand}`,
        id: s.id,
        hand,
        category: s.category,
        title: resolve(fields.title),
        aliases: resolve(fields.aliases),
        summary: resolve(fields.summary),
        tags: fields.tags,
        text: [resolve(fields.text), ...measurementWords(Object.values(fields).join("\n"))].join(
          "\n",
        ),
      };
    });
  });
}

export function createSearchIndex(situations: readonly Situation[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
  index.addAll(buildSearchDocs(situations));
  return index;
}

export function toSearchIndexJson(situations: readonly Situation[]): SearchIndexJson {
  return { version: SEARCH_INDEX_VERSION, index: createSearchIndex(situations).toJSON() };
}

export function loadSearchIndex(json: SearchIndexJson): MiniSearch<SearchDoc> {
  if (json.version !== SEARCH_INDEX_VERSION) {
    throw new Error(`Unsupported search index version ${String(json.version)}`);
  }
  return MiniSearch.loadJS<SearchDoc>(json.index, SEARCH_OPTIONS);
}

/**
 * Ranked situations for a query, as seen by a reader (or just their hand). Every word must match
 * (allowing for prefixes and typos); if nothing does, any word may.
 */
export function searchSituations(
  index: MiniSearch<SearchDoc>,
  query: string,
  reader: Handedness | Partial<Reader>,
  limit = 20,
): SearchHit[] {
  const { hand = "right", ...units } = typeof reader === "string" ? { hand: reader } : reader;
  const filter = (r: SearchResult) => r.hand === hand || r.hand === "both";
  let results = index.search(query, { ...QUERY_OPTIONS, combineWith: "AND", filter });
  if (results.length === 0) {
    results = index.search(query, { ...QUERY_OPTIONS, combineWith: "OR", filter });
  }
  // Words alone can't tell "curving the ball right" (fade alias) from a draw that mentions
  // "right" a lot, so a query found whole in a title or alias ranks first. The last word may
  // still be half-typed.
  const wanted = phrase(query);
  const isPhraseHit = (r: (typeof results)[number]) =>
    wanted !== "" &&
    [r.title as string, ...(r.aliases as string).split("\n")].some((t) =>
      ` ${phrase(t)}`.includes(` ${wanted}`),
    );
  results = results
    .map((r) => (isPhraseHit(r) ? { ...r, score: r.score * 3 } : r))
    .sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => ({
    // The MiniSearch id is the doc key, `<situation id>:<hand>`.
    id: String(r.id).split(":")[0]!,
    category: r.category as CategoryId,
    title: forReader(r.title as string, { hand, ...units }),
    summary: forReader(r.summary as string, { hand, ...units }),
    score: r.score,
  }));
}

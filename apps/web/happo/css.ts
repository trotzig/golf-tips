// The part of the site's stylesheet that can affect one example, so a CSS change only re-runs the
// examples it can reach. It errs on the side of keeping a rule: a rule is dropped only when it
// can't match (a class it needs isn't in the markup) or only defines custom properties that
// nothing kept reads.

interface StyleRule {
  kind: "style";
  /** The enclosing @media / @supports / @layer preludes. */
  context: string;
  selector: string;
  body: string;
  /** For each selector in the list, the classes an element must have for it to match. Empty when
   * one of them needs no class at all. */
  classSets: string[][] | undefined;
}

interface OtherRule {
  kind: "other";
  context: string;
  text: string;
  /** Set for `@property --name`, which only matters if something reads --name. */
  property?: string;
}

type Rule = StyleRule | OtherRule;

export interface ParsedCss {
  rules: Rule[];
}

/** At-rules whose block holds more rules, rather than declarations. */
const GROUPING = new Set(["media", "supports", "layer", "container", "scope", "starting-style"]);

/** Index of the first of `chars` at nesting depth 0 from `start`, skipping strings. */
function findTopLevel(css: string, start: string, chars: string, from: number): number {
  let depth = 0;
  for (let i = from; i < css.length; i++) {
    const c = css[i] as string;
    if (c === "\\") i++;
    else if (c === '"' || c === "'") {
      for (i++; i < css.length && css[i] !== c; i++) if (css[i] === "\\") i++;
    } else if (depth === 0 && chars.includes(c)) return i;
    else if (c === start) depth++;
    else if ((start === "{" && c === "}") || (start === "(" && c === ")")) depth--;
  }
  return -1;
}

function parseInto(css: string, context: string, rules: Rule[]) {
  let i = 0;
  while (i < css.length) {
    const end = findTopLevel(css, "{", "{;}", i);
    if (end === -1 || css[end] === "}") {
      const rest = css.slice(i, end === -1 ? undefined : end).trim();
      if (rest) rules.push({ kind: "other", context, text: rest });
      if (end === -1) return;
      i = end + 1;
      continue;
    }
    const prelude = css.slice(i, end).trim();
    if (css[end] === ";") {
      rules.push({ kind: "other", context, text: `${prelude};` });
      i = end + 1;
      continue;
    }
    const close = findTopLevel(css, "{", "}", end + 1);
    if (close === -1) throw new Error(`Unbalanced CSS after: ${prelude.slice(0, 80)}`);
    const body = css.slice(end + 1, close);
    const atName = /^@([\w-]+)/.exec(prelude)?.[1];
    if (atName && GROUPING.has(atName)) {
      parseInto(body, `${context}${prelude}{`, rules);
    } else if (atName) {
      const property = atName === "property" ? prelude.split(/\s+/)[1] : undefined;
      rules.push({ kind: "other", context, text: `${prelude}{${body}}`, property });
    } else {
      rules.push({
        kind: "style",
        context,
        selector: prelude,
        body,
        classSets: classSets(prelude),
      });
    }
    i = close + 1;
  }
}

export function parseCss(css: string): ParsedCss {
  const rules: Rule[] = [];
  parseInto(css.replace(/\/\*[\s\S]*?\*\//g, ""), "", rules);
  return { rules };
}

/**
 * The classes each selector in a list requires. Classes inside `:not()`, `:is()`, `:has()` or an
 * attribute selector aren't required (they may be optional, negated or on another element), so
 * they're ignored. Returns undefined if any selector requires no class.
 */
export function classSets(selector: string): string[][] | undefined {
  // Escaped characters (`.w-\[10px\]`, `.hover\:x`) become placeholders, so stripping brackets
  // and splitting on commas only sees the selector's own syntax.
  const escaped: string[] = [];
  let s = selector.replace(/\\([0-9a-fA-F]{1,6} ?|[\s\S])/g, (_, esc: string) => {
    const hex = /^[0-9a-fA-F]{1,6} ?$/.test(esc);
    escaped.push(hex ? String.fromCodePoint(parseInt(esc, 16)) : esc);
    return String.fromCharCode(0xe000 + escaped.length - 1);
  });
  for (let prev = ""; prev !== s;) {
    prev = s;
    s = s.replace(/\([^()]*\)/g, "").replace(/\[[^[\]]*\]/g, "");
  }
  const sets: string[][] = [];
  for (const part of s.split(",")) {
    const classes = [...part.matchAll(/\.((?:[\w-]|[-])+)/g)].map(([, name]) =>
      (name ?? "").replace(/[-]/g, (c) => escaped[c.charCodeAt(0) - 0xe000] ?? ""),
    );
    if (classes.length === 0) return undefined;
    sets.push(classes);
  }
  return sets;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const hex = code[1] === "x" || code[1] === "X";
      return String.fromCodePoint(parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return ENTITIES[code] ?? match;
  });
}

/** Every class in a piece of HTML. */
export function classesInHtml(html: string): Set<string> {
  const classes = new Set<string>();
  for (const [, , value] of html.matchAll(/\sclass=(["'])([\s\S]*?)\1/g)) {
    for (const name of decodeEntities(value ?? "").split(/\s+/)) if (name) classes.add(name);
  }
  return classes;
}

const customProperties = (text: string) => text.match(/--[\w-]+/g) ?? [];

/** Splits declarations on top-level semicolons. */
function declarations(body: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < body.length) {
    const end = findTopLevel(body, "(", ";", i);
    const decl = body.slice(i, end === -1 ? undefined : end).trim();
    if (decl) out.push(decl);
    if (end === -1) break;
    i = end + 1;
  }
  return out;
}

/**
 * The rules of `parsed` that can affect markup with these classes, as one string to hash.
 * `markup` is scanned for custom properties it sets or reads (inline styles, SVG attributes).
 */
export function cssFor(parsed: ParsedCss, classes: Set<string>, markup: string): string {
  const read = new Set(customProperties(markup));
  const kept: string[] = [];
  /** Custom property declarations of class-free rules, kept only once something reads them. */
  const pending: { index: number; name: string; decl: string }[] = [];
  const properties: { index: number; name: string; text: string; context: string }[] = [];

  for (const [index, rule] of parsed.rules.entries()) {
    if (rule.kind === "other") {
      if (rule.property)
        properties.push({ index, name: rule.property, text: rule.text, context: rule.context });
      else {
        kept[index] = `${rule.context}${rule.text}`;
        for (const name of customProperties(rule.text)) read.add(name);
      }
      continue;
    }
    if (rule.classSets) {
      if (!rule.classSets.some((set) => set.every((name) => classes.has(name)))) continue;
      kept[index] = `${rule.context}${rule.selector}{${rule.body}}`;
      for (const name of customProperties(rule.body)) read.add(name);
      continue;
    }
    // A rule that can match without any class: keep its ordinary declarations, and its custom
    // property definitions only if something reads them.
    const plain: string[] = [];
    for (const decl of declarations(rule.body)) {
      const name = /^(--[\w-]+)\s*:/.exec(decl)?.[1];
      if (name) pending.push({ index, name, decl });
      else {
        plain.push(decl);
        for (const used of customProperties(decl)) read.add(used);
      }
    }
    if (plain.length > 0) kept[index] = `${rule.context}${rule.selector}{${plain.join(";")}}`;
  }

  // Definitions can read other properties (--color-card: var(--palette-green-50)).
  const defined = new Map<number, string[]>();
  for (let grew = true; grew;) {
    grew = false;
    for (const p of pending) {
      if (!read.has(p.name)) continue;
      const decls = defined.get(p.index) ?? [];
      if (decls.includes(p.decl)) continue;
      decls.push(p.decl);
      defined.set(p.index, decls);
      for (const name of customProperties(p.decl.slice(p.name.length))) {
        if (!read.has(name)) {
          read.add(name);
          grew = true;
        }
      }
    }
  }
  for (const [index, decls] of defined) {
    const rule = parsed.rules[index] as StyleRule;
    kept[index] = `${kept[index] ?? ""}${rule.context}${rule.selector}{${decls.join(";")}}`;
  }
  for (const p of properties) if (read.has(p.name)) kept[p.index] = `${p.context}${p.text}`;
  // Cascade order matters, so keep document order.
  return kept.filter((rule) => rule !== undefined).join("\n");
}

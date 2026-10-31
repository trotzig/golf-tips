import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CATEGORY_IDS,
  parseSituation,
  SITUATIONS_JSON_VERSION,
  toSituationsJson,
  validateSituations,
} from "../src/index.ts";
import { findContentDir, loadSituations, readSourceFiles } from "../src/node.ts";

const fixtures = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const minimal = (fm: string, body = "") =>
  `---\ntitle: T\nsummary: S\ncategory: lies\ntags: [slope]\nswing: [Swing.]\nexpect: [Result.]\nupdated: 2026-10-31\n${fm}---\n${body}`;

describe("parseSituation", () => {
  it("parses a minimal file and applies defaults", () => {
    const result = parseSituation({ id: "x", raw: minimal("") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.situation).toMatchObject({
      id: "x",
      level: "all",
      aliases: [],
      related: [],
      body: "",
      updated: "2026-10-31",
    });
  });

  it("keeps the body", () => {
    const result = parseSituation({ id: "x", raw: minimal("", "\nSome *context*.\n") });
    expect(result.ok && result.situation.body).toBe("Some *context*.");
  });

  it("requires setup or swing", () => {
    const raw = minimal("").replace("swing: [Swing.]\n", "");
    const result = parseSituation({ id: "x", raw });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.message).join()).toMatch(/setup.*swing/);
  });

  it.each([
    ["unknown keys", "colour: red\n", /colour/],
    ["long summary", `summary: ${"x".repeat(141)}\n`, /summary/],
    ["bad level", "level: pro\n", /level/],
    ["bad club", "clubs: [putter, spoon]\n", /clubs/],
    ["bad date", "updated: 31/10/2026\n", /updated/],
    ["empty bullet", "mistakes: ['']\n", /mistakes/],
  ])("rejects %s", (_name, extra, pattern) => {
    // Drop the base value so the YAML has no duplicate key.
    const key = extra.split(":")[0]!;
    const base = minimal("")
      .split("\n")
      .filter((line) => !line.startsWith(`${key}:`))
      .join("\n");
    const raw = base.replace(/---\n$/, `${extra}---\n`);
    const result = parseSituation({ id: "x", raw });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.message).join("\n")).toMatch(pattern);
  });

  it("explains unquoted colons in bullets", () => {
    const raw = minimal("").replace("swing: [Swing.]\n", "swing:\n  - Aim right (left-handers: mirror this).\n");
    const result = parseSituation({ id: "x", raw });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toMatch(/^swing\.0: .*wrap the line in quotes/);
  });

  it("rejects missing frontmatter and invalid YAML", () => {
    expect(parseSituation({ id: "x", raw: "# hello" }).ok).toBe(false);
    expect(parseSituation({ id: "x", raw: "---\ntitle: [oops\n---\n" }).ok).toBe(false);
  });

  it("rejects non-kebab-case ids", () => {
    const result = parseSituation({ id: "Downhill_Lie", raw: minimal("") });
    expect(result.ok).toBe(false);
  });
});

describe("validateSituations", () => {
  it("accepts the valid fixtures, sorted by title", () => {
    const { situations, errors } = validateSituations(readSourceFiles(fixtures("valid")));
    expect(errors).toEqual([]);
    expect(situations.map((s) => s.id)).toEqual(["downhill-lie", "uphill-lie"]);
  });

  it("reports schema errors and dangling related ids", () => {
    const files = [
      ...readSourceFiles(fixtures("valid")),
      ...readSourceFiles(fixtures("invalid")),
      { id: "self-ref", raw: minimal("related: [self-ref, ghost]\n") },
    ];
    const { situations, errors } = validateSituations(files);
    expect(situations.map((s) => s.id)).toContain("self-ref");
    const messages = errors.map((e) => `${e.id}: ${e.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^bad-one: category/),
        expect.stringMatching(/^bad-one: tags\.0/),
        expect.stringMatching(/^bad-one: expect/),
        "self-ref: related: must not reference itself",
        'self-ref: related: unknown situation "ghost"',
      ]),
    );
  });

  it("treats an invalid file's id as existing for related checks", () => {
    // Avoid cascading errors: only the broken file itself is reported.
    const files = [
      { id: "a", raw: minimal("related: [b]\n") },
      { id: "b", raw: "not frontmatter" },
    ];
    const { errors } = validateSituations(files);
    expect(errors.map((e) => e.id)).toEqual(["b"]);
  });

  it("reports duplicate ids", () => {
    const file = { id: "a", raw: minimal("") };
    expect(validateSituations([file, file]).errors).toEqual([{ id: "a", message: "duplicate id" }]);
  });
});

describe("node loader", () => {
  it("treats a missing directory as empty", () => {
    expect(loadSituations(fixtures("does-not-exist"))).toEqual({ situations: [], errors: [] });
  });

  it("finds the repo content directory", () => {
    expect(findContentDir(fixtures("valid"))).toMatch(/content[/\\]situations$/);
  });
});

describe("toSituationsJson", () => {
  it("includes version, categories and situations", () => {
    const { situations } = validateSituations(readSourceFiles(fixtures("valid")));
    const json = toSituationsJson(situations);
    expect(json.version).toBe(SITUATIONS_JSON_VERSION);
    expect(json.categories.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    expect(json.situations).toHaveLength(2);
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });
});

describe("categories", () => {
  it("has metadata for every category id", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
  });
});

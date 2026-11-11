import { z } from "zod";
import { CATEGORY_IDS } from "./categories.ts";

export const LEVELS = ["all", "beginner", "advanced"] as const;
export const CLUBS = ["driver", "woods", "hybrids", "irons", "wedges", "putter"] as const;

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const idSchema = z.string().regex(KEBAB, "must be lowercase kebab-case");

const text = z
  .string({
    error: (issue) =>
      issue.input !== null && typeof issue.input === "object"
        ? 'expected text but got a key/value pair: wrap the line in quotes (an unquoted ": " starts a YAML mapping)'
        : undefined,
  })
  .trim()
  .min(1);
const bullets = z.array(text).min(1);
/** Whole clubs relative to the normal club for the distance: positive = more club. */
const clubSteps = z.number().int().min(-3).max(3);

/** Frontmatter of `content/situations/<id>.md`. Mirrors the spec in AGENTS.md. */
export const frontmatterSchema = z
  .strictObject({
    title: text,
    summary: text.max(140),
    category: z.enum(CATEGORY_IDS),
    tags: z.array(idSchema).min(1),
    aliases: z.array(text).default([]),
    level: z.enum(LEVELS).default("all"),
    clubs: z.array(z.enum(CLUBS)).optional(),
    setup: bullets.optional(),
    swing: bullets.optional(),
    expect: bullets,
    mistakes: bullets.optional(),
    /** One fix per mistake, in the same order; shown as "Do" under each "Don't". */
    fixes: bullets.optional(),
    club_choice: text.optional(),
    /**
     * How many clubs to change from normal, drawn as a club ladder: `-1` for one club less,
     * `[1, 2]` for one or two more.
     */
    club_change: z
      .union([clubSteps, z.tuple([clubSteps, clubSteps])])
      .refine((v) => !Array.isArray(v) || v[0] < v[1], "a range must go from fewer to more clubs")
      .optional(),
    /** Draw each club's share of air and roll, for chips and bump-and-runs. */
    club_roll_chart: z.boolean().optional(),
    drill: text.optional(),
    related: z.array(idSchema).default([]),
    viz: idSchema.optional(),
    updated: z
      .string()
      .regex(ISO_DATE, "must be a date like 2026-10-31")
      .refine((s) => !Number.isNaN(Date.parse(s)), "must be a valid date"),
  })
  .refine((fm) => fm.setup !== undefined || fm.swing !== undefined, {
    message: "at least one of `setup` or `swing` is required",
    path: ["setup"],
  })
  .refine((fm) => !fm.fixes || fm.fixes.length === fm.mistakes?.length, {
    message: "`fixes` needs exactly one entry per item in `mistakes`",
    path: ["fixes"],
  });

export type Frontmatter = z.output<typeof frontmatterSchema>;

export type Situation = { id: string } & Frontmatter & {
    /** Optional Markdown body below the frontmatter, trimmed. Empty string if none. */
    body: string;
  };

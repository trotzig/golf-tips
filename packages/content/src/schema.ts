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
    club_choice: text.optional(),
    drill: text.optional(),
    advanced: text.optional(),
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
  });

export type Frontmatter = z.output<typeof frontmatterSchema>;

export type Situation = { id: string } & Frontmatter & {
    /** Optional Markdown body below the frontmatter, trimmed. Empty string if none. */
    body: string;
  };

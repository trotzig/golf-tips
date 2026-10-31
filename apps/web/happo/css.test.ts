import { describe, expect, it } from "vitest";
import { classesInHtml, classSets, cssFor, parseCss } from "./css.ts";

const filter = (css: string, html: string) => cssFor(parseCss(css), classesInHtml(html), html);

describe("classSets", () => {
  it("unescapes Tailwind class names", () => {
    expect(classSets(".hover\\:bg-accent:hover")).toEqual([["hover:bg-accent"]]);
    expect(classSets(".rounded-\\[10px\\]")).toEqual([["rounded-[10px]"]]);
    expect(classSets(".text-\\(--tone\\)")).toEqual([["text-(--tone)"]]);
    expect(classSets(".gap-0\\.5")).toEqual([["gap-0.5"]]);
  });

  it("ignores classes that aren't required", () => {
    expect(classSets(".a:is(:where(.group)[aria-pressed=true] *)")).toEqual([["a"]]);
    expect(classSets(".a:not(.b) .c")).toEqual([["a", "c"]]);
    expect(classSets('[class~="x"]')).toBeUndefined();
  });

  it("is undefined when any selector needs no class", () => {
    expect(classSets(".a,b")).toBeUndefined();
    expect(classSets("[data-hand=right] .hand-l,[data-hand=left] .hand-r")).toEqual([
      ["hand-l"],
      ["hand-r"],
    ]);
  });
});

describe("classesInHtml", () => {
  it("decodes entities", () => {
    expect([...classesInHtml('<p class="a [&amp;&gt;p]:mt-2">')]).toEqual(["a", "[&>p]:mt-2"]);
  });
});

describe("cssFor", () => {
  it("keeps rules for classes in the markup and drops the rest", () => {
    const css = "@layer utilities{.a{color:red}.b{color:blue}@media (width>=40rem){.c{gap:0}}}";
    expect(filter(css, '<p class="a">')).toBe("@layer utilities{.a{color:red}");
    expect(filter(css, '<p class="c">')).toBe("@layer utilities{@media (width>=40rem){.c{gap:0}");
  });

  it("keeps class-free rules and statements", () => {
    const css = "@layer theme,base;a{text-decoration:none}@font-face{font-family:x}.z{top:0}";
    expect(filter(css, "<p>")).toBe(
      "@layer theme,base;\na{text-decoration:none}\n@font-face{font-family:x}",
    );
  });

  it("keeps custom properties only when something reads them", () => {
    const css = [
      ":root{--color-card:var(--green);--green:#0f0;--color-ink:#000;color-scheme:light}",
      "@property --tw-ring{syntax:'*'}",
      "@property --tw-shadow{syntax:'*'}",
      ".bg-card{background:var(--color-card);box-shadow:var(--tw-shadow)}",
    ].join("");
    expect(filter(css, '<p class="bg-card">')).toBe(
      [
        ":root{color-scheme:light}:root{--color-card:var(--green);--green:#0f0}",
        "@property --tw-shadow{syntax:'*'}",
        ".bg-card{background:var(--color-card);box-shadow:var(--tw-shadow)}",
      ].join("\n"),
    );
    // Inline styles count as reading a property.
    expect(filter(":root{--color-ink:#000}", '<p style="color:var(--color-ink)">')).toBe(
      ":root{--color-ink:#000}",
    );
  });

  it("doesn't change when an unrelated rule changes", () => {
    const html = '<p class="a">';
    expect(filter(".a{color:red}.b{color:blue}", html)).toBe(
      filter(".a{color:red}.b{gap:1px}", html),
    );
    expect(filter(".a{color:red}", html)).not.toBe(filter(".a{color:green}", html));
  });
});

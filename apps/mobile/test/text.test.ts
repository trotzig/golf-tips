import { describe, expect, it } from "vitest";
import { bodyParagraphs, tagLabel } from "../src/lib/text.ts";

describe("bodyParagraphs", () => {
  it("splits on blank lines and joins wrapped lines", () => {
    expect(bodyParagraphs("One line\nwrapped.\n\nSecond.")).toEqual([
      "One line wrapped.",
      "Second.",
    ]);
  });

  it("unwraps emphasis and links", () => {
    expect(bodyParagraphs("A **firm** [green](https://x.test) is *fast*.")).toEqual([
      "A firm green is fast.",
    ]);
  });

  it("returns nothing for an empty body", () => {
    expect(bodyParagraphs("")).toEqual([]);
  });
});

it("labels tags like the site", () => {
  expect(tagLabel("ball-position")).toBe("Ball position");
});

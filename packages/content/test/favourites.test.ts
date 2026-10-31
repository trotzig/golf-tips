import { describe, expect, it } from "vitest";
import { parseFavourites, toggleFavourite } from "../src/favourites.ts";

describe("toggleFavourite", () => {
  it("adds new favourites first and removes existing ones", () => {
    const added = toggleFavourite(["a"], "b");
    expect(added).toEqual(["b", "a"]);
    expect(toggleFavourite(added, "a")).toEqual(["b"]);
  });
});

describe("parseFavourites", () => {
  it("reads a stored list and drops anything that isn't an id", () => {
    expect(parseFavourites('["a", 2, "b"]')).toEqual(["a", "b"]);
  });

  it("treats missing or unreadable storage as no favourites", () => {
    expect(parseFavourites(null)).toEqual([]);
    expect(parseFavourites("{not json")).toEqual([]);
    expect(parseFavourites('{"a": 1}')).toEqual([]);
  });
});

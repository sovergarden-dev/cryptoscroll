import { expect, it } from "vitest";
import { preferredLanguage } from "./language";

it.each([
  ["vi-VN,en-US", "vi"],
  ["en-GB,vi;q=0.5", "en"],
  ["en;q=0.2, vi;q=0.8", "vi"],
  ["fr,VI;q=0.7", "vi"],
  ["vi;q=0,en;q=0.3", "en"],
  ["en;q=0,*;q=0.8", "vi"],
  ["fr-FR", "en"],
  ["vi;q=bogus,en", "en"],
  ["", "en"],
] as const)("negotiates %s as %s", (header, expected) =>
  expect(preferredLanguage(header)).toBe(expected),
);

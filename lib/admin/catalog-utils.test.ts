import { describe, expect, it } from "vitest";
import {
  centsToDisplay,
  makeSku,
  parseMoneyToCents,
  slugify,
} from "./catalog-utils";

describe("slugify", () => {
  it("normalizes names to url slugs", () => {
    expect(slugify("Compression Leggings Pro")).toBe("compression-leggings-pro");
    expect(slugify("  Foo--Bar!! ")).toBe("foo-bar");
  });
});

describe("makeSku", () => {
  it("builds uppercase SKU segments", () => {
    expect(makeSku("leggings", "Black", "M")).toBe("LEGGINGS-BLACK-M");
  });
});

describe("parseMoneyToCents", () => {
  it("parses dollars to integer cents without floats", () => {
    expect(parseMoneyToCents("24.99")).toBe(2499);
    expect(parseMoneyToCents("$10")).toBe(1000);
    expect(parseMoneyToCents("0.5")).toBe(50);
    expect(parseMoneyToCents("0.50")).toBe(50);
  });

  it("rejects invalid money", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("12.999")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("24.9.9")).toBeNull();
  });
});

describe("centsToDisplay", () => {
  it("formats cents for admin inputs", () => {
    expect(centsToDisplay(2499)).toBe("24.99");
    expect(centsToDisplay(100)).toBe("1.00");
  });
});

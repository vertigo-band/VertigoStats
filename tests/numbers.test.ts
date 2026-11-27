import { describe, expect, it } from "vitest";
import { parseNum } from "../src/lib/numbers";

describe("parseNum", () => {
  it.each([
    ["1.2K", 1200], ["3.4M", 3_400_000], ["$1,234.56", 1234.56], ["1.85%", 1.85],
    ["12,345", 12345], ["€0.42", 0.42], ["USD 10", 10], [" 7 ", 7], [42, 42], ["-3.5", -3.5], ["2.5k", 2500],
  ])("%s → %s", (input, out) => expect(parseNum(input)).toBe(out));
  it.each([["—"], ["-"], [""], ["abc"], [null], [undefined], [NaN]])("%s → null", input => expect(parseNum(input)).toBeNull());
});

import { describe, expect, test } from "vitest";
import { shortAddr } from "../shared/format";
import { KNOWN_MINTS, KNOWN_PROGRAMS } from "../shared/programs";
import { nameKnownAddresses } from "../shared/summary";

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

describe.each([
  ["KNOWN_PROGRAMS", KNOWN_PROGRAMS],
  ["KNOWN_MINTS", KNOWN_MINTS],
])("%s", (_, map) => {
  const entries = Object.entries(map);

  test.each(entries)("%s is a valid base58 address with a name", (addr, name) => {
    expect(addr).toMatch(BASE58_ADDRESS);
    expect(name.trim()).not.toBe("");
  });

  test.each(entries)("%s round-trips through nameKnownAddresses, short and full", (addr, name) => {
    expect(nameKnownAddresses(`via ${shortAddr(addr)}.`)).toBe(`via ${name}.`);
    expect(nameKnownAddresses(`via ${addr}.`)).toBe(`via ${name}.`);
  });
});

describe("known address lists", () => {
  const all = [...Object.keys(KNOWN_PROGRAMS), ...Object.keys(KNOWN_MINTS)];

  test("no address is both a program and a mint", () => {
    expect(new Set(all).size).toBe(all.length);
  });

  test("no two known addresses share a short form, so a shortened address maps to one name", () => {
    const shorts = all.map(shortAddr);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  test("programs added by request are present", () => {
    expect(KNOWN_PROGRAMS).toMatchObject({
      DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH: "DFlow Aggregator v4",
      pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "Pump.fun AMM",
      pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ: "Pump.fun Fees",
      SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf: "Squads v4",
      SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu: "Squads v3",
      SMPLKTQhrgo22hFCVq2VGX1KAktTWjeizkhrdB1eauK: "Squads v3 Program Manager",
    });
  });
});

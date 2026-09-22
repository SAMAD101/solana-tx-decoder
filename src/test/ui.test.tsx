import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BalanceChanges, Instructions } from "../client/ui";
import { decodeTransaction, type RawTx } from "../shared/decode";
import { shortAddr } from "../shared/format";
import swap from "./fixtures/jupiter-swap.json";

const d = decodeTransaction(swap as unknown as RawTx, "mainnet-beta");

/** The rendered header line of each instruction, in order. */
function heads(html: string): string[] {
  return html.match(/<div class="ix-head">.*?<\/div>/g) ?? [];
}

describe("Instructions tree", () => {
  const html = renderToStaticMarkup(<Instructions d={d} />);
  const all = d.instructions.flatMap((ix) => [ix, ...ix.inner]);

  test("renders every instruction, inner ones included", () => {
    expect(heads(html)).toHaveLength(all.length); // 4 top-level + 8 inner
  });

  test("every program, known or unknown, shows its short address, Solscan link and copy button", () => {
    heads(html).forEach((head, i) => {
      const { programId } = all[i]!;
      expect(head).toContain(`href="https://solscan.io/account/${programId}"`);
      expect(head).toContain(`>${shortAddr(programId)}</a>`);
      expect(head).toContain(`aria-label="Copy ${programId}"`);
    });
  });

  test("known programs are named and untagged; unknown ones are tagged", () => {
    const jupiter = heads(html)[2]!;
    expect(jupiter).toContain("<strong>Jupiter v6</strong>");
    expect(jupiter).not.toContain("unknown program");

    const unknown = heads(html)[3]!; // #3.1, a program outside KNOWN_PROGRAMS
    expect(unknown).toContain('<span class="tag">unknown program</span>');
  });
});

describe("Balance changes", () => {
  test("known mints get a name tag next to the address", () => {
    const html = renderToStaticMarkup(<BalanceChanges d={d} />);
    expect(html).toContain('<span class="tag">USDC</span>');
    expect(html).toContain('<span class="tag">Wrapped SOL</span>');
  });
});

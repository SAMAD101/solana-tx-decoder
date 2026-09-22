import { useState, type ReactNode } from "react";
import {
  lamportsToSol,
  relativeTime,
  shortAddr,
  signed,
  solscanUrl,
} from "../shared/format";
import { KNOWN_MINTS } from "../shared/programs";
import type {
  Cluster,
  Current,
  DecodedIx,
  DecodedTx,
  Json,
  Recent,
} from "../shared/types";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function Box({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`box ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function Collapsible({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="box">
      <summary>{title}</summary>
      <div className="details-body">{children}</div>
    </details>
  );
}

export function Addr({
  value,
  cluster,
  kind = "account",
}: {
  value: string;
  cluster: Cluster;
  kind?: "tx" | "account";
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <span className="addr">
      <a
        href={solscanUrl(kind, value, cluster)}
        target="_blank"
        rel="noreferrer"
        title={value}
      >
        {shortAddr(value)}
      </a>
      <button
        type="button"
        className="copy"
        onClick={copy}
        aria-label={`Copy ${value}`}
      >
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STEPS = [
  ["FETCH", "fetching"],
  ["DECODE", "decoding"],
  ["EXPLAIN", "explaining"],
] as const;
const ORDER: Record<string, number> = {
  fetching: 0,
  decoding: 1,
  explaining: 2,
  done: 3,
};

export function Progress({ current }: { current: Current }) {
  const failedAt =
    current.status === "error"
      ? current.decoded
        ? 2
        : 0
      : current.status === "done" && !current.explanation
        ? 2
        : -1;
  const at =
    current.status === "error" ? failedAt : (ORDER[current.status] ?? -1);
  return (
    <div className="box progress" role="status" aria-live="polite">
      <ol>
        {STEPS.map(([label], i) => {
          const cls =
            i === failedAt
              ? "failed"
              : i < at
                ? "done"
                : i === at
                  ? "active"
                  : "pending";
          return (
            <li key={label} className={cls}>
              {i > 0 && (
                <span className="arrow" aria-hidden>
                  →
                </span>
              )}
              <span className="step">{label}</span>
            </li>
          );
        })}
      </ol>
      <span className="progress-target">
        <Addr value={current.signature} cluster={current.cluster} kind="tx" />{" "}
        {current.cluster}
      </span>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="box error" role="alert">
      <span className="label">error</span> {message}
    </div>
  );
}

export function Overview({ d }: { d: DecodedTx }) {
  const rows: [string, ReactNode][] = [
    ["signature", <Addr value={d.signature} cluster={d.cluster} kind="tx" />],
    ["cluster", d.cluster],
    [
      "status",
      d.success ? (
        <span className="ok">SUCCESS</span>
      ) : (
        <>
          <span className="bad">FAILED</span> {d.error}
        </>
      ),
    ],
    ["slot", d.slot.toLocaleString("en-US")],
    [
      "block time",
      d.blockTimeIso && d.blockTime
        ? `${d.blockTimeIso} (${relativeTime(d.blockTime)})`
        : "unknown",
    ],
    ["fee", `${lamportsToSol(d.feeLamports)} SOL`],
    ["compute units", d.computeUnits?.toLocaleString("en-US") ?? "unknown"],
    ["version", d.version],
    ["fee payer", <Addr value={d.feePayer} cluster={d.cluster} />],
    [
      "signers",
      <span className="list">
        {d.signers.map((s) => (
          <Addr key={s} value={s} cluster={d.cluster} />
        ))}
      </span>,
    ],
  ];
  return (
    <Box title="Overview">
      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Box>
  );
}

export function BalanceChanges({ d }: { d: DecodedTx }) {
  return (
    <Box title="Balance Changes">
      <h3>SOL</h3>
      {d.solChanges.length ? (
        <Table
          head={["account", "pre", "post", "delta"]}
          rows={d.solChanges.map((c) => [
            <Addr value={c.address} cluster={d.cluster} />,
            lamportsToSol(c.pre),
            lamportsToSol(c.post),
            <span className="num">{signed(lamportsToSol(c.delta))}</span>,
          ])}
        />
      ) : (
        <p>No SOL balance changed.</p>
      )}
      <h3>Tokens</h3>
      {d.tokenChanges.length ? (
        <Table
          head={["owner", "mint", "pre", "post", "delta"]}
          rows={d.tokenChanges.map((t) => [
            t.owner ? <Addr value={t.owner} cluster={d.cluster} /> : "unknown",
            <>
              {KNOWN_MINTS[t.mint] && (
                <span className="tag">{KNOWN_MINTS[t.mint]}</span>
              )}{" "}
              <Addr value={t.mint} cluster={d.cluster} kind="account" />
            </>,
            t.pre,
            t.post,
            <span className="num">{signed(t.delta)}</span>,
          ])}
        />
      ) : (
        <p>No token balance changed.</p>
      )}
    </Box>
  );
}

function InfoValue({ v, cluster }: { v: Json; cluster: Cluster }) {
  if (typeof v === "string" && ADDRESS.test(v))
    return <Addr value={v} cluster={cluster} />;
  if (v !== null && typeof v === "object")
    return <code className="json">{JSON.stringify(v)}</code>;
  return <>{String(v)}</>;
}

function Ix({ ix, cluster }: { ix: DecodedIx; cluster: Cluster }) {
  const data = ix.data ?? "";
  return (
    <li className="ix" style={{ marginLeft: `${ix.depth * 1.5}em` }}>
      <div className="ix-head">
        <span className="ix-index">#{ix.index}</span>{" "}
        <strong>{ix.program}</strong>
        {!ix.known && <span className="tag">unknown program</span>}
        {ix.type && <> · {ix.type}</>}{" "}
        <Addr value={ix.programId} cluster={cluster} />
      </div>
      {ix.info !== undefined &&
        (typeof ix.info === "object" &&
        ix.info !== null &&
        !Array.isArray(ix.info) ? (
          <dl className="kv ix-info">
            {Object.entries(ix.info).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  <InfoValue v={v} cluster={cluster} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="ix-info">
            <InfoValue v={ix.info} cluster={cluster} />
          </div>
        ))}
      {ix.info === undefined && (
        <dl className="kv ix-info">
          <div>
            <dt>data</dt>
            <dd>
              <code title={data}>
                {data.length > 64 ? `${data.slice(0, 64)}…` : data || "(empty)"}
              </code>{" "}
              <span className="muted">{data.length} chars base58</span>
            </dd>
          </div>
          <div>
            <dt>accounts</dt>
            <dd>
              {ix.accounts?.length ? (
                <span className="list">
                  {ix.accounts.map((a, i) => (
                    <Addr key={`${a}${i}`} value={a} cluster={cluster} />
                  ))}
                </span>
              ) : (
                "none"
              )}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

export function Instructions({ d }: { d: DecodedTx }) {
  return (
    <Box title="Instructions">
      <ol className="ixs">
        {d.instructions
          .flatMap((ix) => [ix, ...ix.inner])
          .map((ix) => (
            <Ix key={ix.index} ix={ix} cluster={d.cluster} />
          ))}
      </ol>
    </Box>
  );
}

export function Accounts({ d }: { d: DecodedTx }) {
  return (
    <Collapsible title={`Accounts (${d.accounts.length})`}>
      <Table
        head={["#", "address", "signer", "writable", "source"]}
        rows={d.accounts.map((a, i) => [
          i,
          <Addr value={a.address} cluster={d.cluster} />,
          a.signer ? "yes" : "",
          a.writable ? "yes" : "",
          a.source === "lookupTable" ? "lookup table" : "transaction",
        ])}
      />
    </Collapsible>
  );
}

export function Logs({ d }: { d: DecodedTx }) {
  const bad = new Set(d.errorLogs);
  return (
    <Collapsible title={`Logs (${d.logs.length})`}>
      {d.logs.length ? (
        <pre className="logs">
          {d.logs.map((l, i) => (
            <span key={i} className={bad.has(l) ? "err" : undefined}>
              {l}
              {"\n"}
            </span>
          ))}
        </pre>
      ) : (
        <p>The RPC returned no log messages.</p>
      )}
    </Collapsible>
  );
}

export function RecentList({
  recent,
  disabled,
  onPick,
}: {
  recent: Recent[];
  disabled: boolean;
  onPick: (r: Recent) => void;
}) {
  return (
    <Box title="Recent">
      <ul className="recent">
        {recent.map((r) => (
          <li key={`${r.cluster}:${r.signature}`}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(r)}
              title={`Re-run ${r.signature}`}
            >
              <span className="recent-sig">{shortAddr(r.signature)}</span>
              {r.cluster !== "mainnet-beta" && (
                <span className="tag">{r.cluster}</span>
              )}
              <span className="recent-summary">{r.summary}</span>
              <span className="muted">{relativeTime(r.at / 1000)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Box>
  );
}

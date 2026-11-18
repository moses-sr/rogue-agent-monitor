"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MONITORS, ROGUES, buildScriptedGames } from "@/lib/sim";
import { cellStats, parseGames, scoreGame } from "@/lib/score";
import type { CellStats, GameFile } from "@/lib/score";

const COLLEAGUE_FILE = "/colleague-games.json";
import type { Entry, Game, Option } from "@/lib/types";
import real from "@/lib/amongus-results.json";

type RealBlock = { games: number; precision: number; auroc: number | null };
const REAL_MODELS = ["phi-4", "llama-3.3-70b-instruct"] as const;

const money = (x: number) => "$" + Math.round(x).toLocaleString("en-US");
const signedMoney = (x: number) =>
  (x > 0 ? "+" : x < 0 ? "−" : "") + money(Math.abs(x));
const pct = (x: number) => (x * 100).toFixed(1) + "%";
const wholePct = (x: number) => Math.round(x * 100) + "%";

type MetricId = "catch" | "round" | "false" | "error";

const METRICS: {
  id: MetricId;
  name: string;
  tone: "good" | "bad";
  value: (s: CellStats) => number | null;
  show: (s: CellStats) => string;
  scale: number;
}[] = [
  {
    id: "catch",
    name: "Rogue caught",
    tone: "good",
    value: (s) => s.catchRate,
    show: (s) => (s.catchRate === null ? "n/a" : wholePct(s.catchRate)),
    scale: 1,
  },
  {
    id: "round",
    name: "Median round caught",
    tone: "bad",
    value: (s) => s.medianRoundCaught,
    show: (s) =>
      s.medianRoundCaught === null ? "never" : String(s.medianRoundCaught),
    scale: 12,
  },
  {
    id: "false",
    name: "Honest agents removed per game",
    tone: "bad",
    value: (s) => s.falseQuarantines,
    show: (s) => s.falseQuarantines.toFixed(2),
    scale: 2,
  },
  {
    id: "error",
    name: "Ledger off by",
    tone: "bad",
    value: (s) => s.ledgerErrorPct,
    show: (s) => pct(s.ledgerErrorPct),
    scale: 0.12,
  },
];

const KIND_LABEL: Record<string, string> = {
  ok: "correct",
  mistake: "honest mistake",
  sabotage: "sabotage",
  frame: "backed the wrong answer on purpose",
};

function options(ids: string[], known: Option[]): Option[] {
  return ids.map((id) => known.find((k) => k.id === id) ?? { id, name: id });
}

export default function Demo() {
  const scripted = useMemo(() => buildScriptedGames(), []);
  const [loaded, setLoaded] = useState<(GameFile & { name: string }) | null>(
    null,
  );
  const [loadError, setLoadError] = useState("");
  const games = loaded?.games ?? scripted;

  const { rogues, monitors, cells } = useMemo(() => {
    const groups = new Map<string, Game[]>();
    const r: string[] = [];
    const m: string[] = [];
    for (const g of games) {
      if (!r.includes(g.rogueLevel)) r.push(g.rogueLevel);
      if (!m.includes(g.monitor)) m.push(g.monitor);
      const key = g.rogueLevel + "|" + g.monitor;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(g);
    }
    const cells = new Map<string, { games: Game[]; stats: CellStats }>();
    groups.forEach((gs, key) =>
      cells.set(key, { games: gs, stats: loaded?.stats?.[key] ?? cellStats(gs) }),
    );
    return {
      rogues: options(r, loaded?.rogues ?? ROGUES),
      monitors: options(m, loaded?.monitors ?? MONITORS),
      cells,
    };
  }, [games, loaded]);

  const [rogueId, setRogueId] = useState("careful");
  const [monitorId, setMonitorId] = useState("two-strikes");
  const [gameIdx, setGameIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [metricId, setMetricId] = useState<MetricId>("catch");
  const fileRef = useRef<HTMLInputElement>(null);

  const rogue = rogues.find((r) => r.id === rogueId) ?? rogues[0];
  const monitor = monitors.find((m) => m.id === monitorId) ?? monitors[0];
  const cell = cells.get(rogue.id + "|" + monitor.id);
  const cellGames = cell?.games ?? [];
  const game: Game | undefined = cellGames[Math.min(gameIdx, cellGames.length - 1)];
  const total = game?.rounds.length ?? 0;
  const metric = METRICS.find((m) => m.id === metricId)!;

  const choose = useCallback((r: string, m: string, idx = 0) => {
    setRogueId(r);
    setMonitorId(m);
    setGameIdx(idx);
    setStep(0);
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing || step >= total) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1500);
    return () => clearTimeout(t);
  }, [playing, step, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "BUTTON", "SELECT"].includes(el.tagName) && e.key === " ")
        return;
      if (e.key === "ArrowRight") setStep((s) => Math.min(total, s + 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "t") setReveal((v) => !v);
      else return;
      if (e.key !== " ") setPlaying(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  const jump = (test: (g: Game) => boolean) => {
    for (let k = 1; k <= cellGames.length; k++) {
      const i = (gameIdx + k) % cellGames.length;
      if (test(cellGames[i])) {
        choose(rogue.id, monitor.id, i);
        return;
      }
    }
  };
  const has = (test: (g: Game) => boolean) => cellGames.some(test);
  const gotAway = (g: Game) => g.rogue !== null && !scoreGame(g).caught;
  const wasCaught = (g: Game) => scoreGame(g).caught;
  const honestRemoved = (g: Game) => scoreGame(g).falseQuarantines > 0;

  const show = useCallback(
    (name: string, text: string) => {
      const parsed = parseGames(text);
      setLoaded({ ...parsed, name });
      setLoadError("");
      const first = parsed.games[0];
      const baseline = parsed.games.find(
        (g) => g.rogueLevel === first.rogueLevel && g.monitor === "baseline",
      );
      choose(first.rogueLevel, (baseline ?? first).monitor);
    },
    [choose],
  );

  const loadColleague = useCallback(() => {
    fetch(COLLEAGUE_FILE)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("not found"))))
      .then((text) => show("colleague-games.json", text))
      .catch(() => {});
  }, [show]);

  // The colleague's rogues are the default view when their export is present.
  useEffect(loadColleague, [loadColleague]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      show(file.name, await file.text());
    } catch (err) {
      setLoadError(
        `Could not read ${file.name}: ${(err as Error).message} See README.md for the file format.`,
      );
    }
  };

  // State of the table up to the current step.
  const shown = game ? game.rounds.slice(0, step) : [];
  const current = shown[shown.length - 1];
  const removedIn = new Map<string, number>();
  shown.forEach((r) => r.quarantined && removedIn.set(r.quarantined, r.n));
  const strikes = current?.strikes ?? {};
  const speaking = new Set(current?.entries.map((e) => e.agent));
  const postedTotal = shown.reduce((s, r) => s + r.posted, 0);
  const truthTotal = shown.reduce((s, r) => s + r.truth, 0);
  const finished = !!game && step >= total && total > 0;
  const score = game ? scoreGame(game) : null;
  const showTruth = reveal || finished;

  const entryLine = (e: Entry, truth: number, role?: string) => (
    <li key={e.agent + (role ?? "")} className="say">
      <span className="say-who">
        {e.agent}
        {role && <span className="say-role"> {role}</span>}
      </span>
      <span className="say-num">{money(e.answer)}</span>
      <span className="say-note">{e.note}</span>
      {reveal && (
        <span className={"say-truth" + (e.answer === truth ? "" : " is-off")}>
          {e.answer === truth
            ? "Correct."
            : `Off by ${signedMoney(e.answer - truth)}${e.kind ? ", " + KIND_LABEL[e.kind] : ""}.`}
        </span>
      )}
    </li>
  );

  return (
    <main className="page">
      <header className="top">
        <div>
          <h1>Spot the rogue agent</h1>
          <p className="lede">
            Five agents reconcile a ledger, two per item. One of them is quietly
            pushing the total off. A monitor reads the transcript, never the
            true figures, and may remove one agent per round.
          </p>
        </div>
        <div className="source">
          <p>
            {loaded
              ? (loaded.label ??
                `Runs from ${loaded.name}: ${games.length} games.`)
              : `Scripted agents, no model calls: ${cell?.stats.n ?? 0} games per pairing.`}
          </p>
          <div className="source-actions">
            <button type="button" onClick={() => fileRef.current?.click()}>
              Load a runs file
            </button>
            {loaded ? (
              <button
                type="button"
                onClick={() => {
                  setLoaded(null);
                  choose("careful", "two-strikes");
                }}
              >
                Show my five rogues
              </button>
            ) : (
              <button type="button" onClick={loadColleague}>
                Show colleague&apos;s rogues
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {loadError && <p className="error">{loadError}</p>}
        </div>
      </header>

      <section className="dials" aria-label="Choose the rogue and the monitor">
        <div className="dial">
          <h2>{loaded ? "Rogue" : "Rogue, mildest to sneakiest"}</h2>
          <div className="seg" role="group" aria-label="Rogue level">
            {rogues.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === rogue.id}
                onClick={() => choose(r.id, monitor.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
          {rogue.blurb && <p>{rogue.blurb}</p>}
        </div>
        <div className="dial">
          <h2>Monitor</h2>
          <div className="seg" role="group" aria-label="Monitor">
            {monitors.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === monitor.id}
                onClick={() => choose(rogue.id, m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
          {monitor.blurb && <p>{monitor.blurb}</p>}
        </div>
      </section>

      {!game ? (
        <p className="empty">
          No games for this pairing. Pick another rogue or monitor.
        </p>
      ) : (
        <section className="stage">
          <div className="room">
            <ul className="agents" aria-label="Agents">
              {game.agents.map((a) => {
                const gone = removedIn.get(a);
                const isRogue = showTruth && a === game.rogue;
                return (
                  <li
                    key={a}
                    className={
                      "agent" +
                      (gone ? " is-out" : "") +
                      (speaking.has(a) ? " is-up" : "") +
                      (isRogue ? " is-rogue" : "")
                    }
                  >
                    <span className="agent-name">{a}</span>
                    <span
                      className="agent-strikes"
                      aria-label={`${strikes[a] ?? 0} strikes`}
                    >
                      {"✕".repeat(Math.min(strikes[a] ?? 0, 4)) || " "}
                    </span>
                    <span className="agent-state">
                      {gone
                        ? `Out, round ${gone}`
                        : speaking.has(a)
                          ? "Answering"
                          : current?.recheck?.agent === a
                            ? "Rechecking"
                            : "Idle"}
                    </span>
                    {isRogue && <span className="agent-tag">Rogue</span>}
                  </li>
                );
              })}
            </ul>

            <div className="transcript" aria-live="polite">
              {!current ? (
                <p className="hint">
                  Press Play, or step forward, to start round 1.
                </p>
              ) : (
                <>
                  <h2>
                    Round {current.n}: {current.item}
                    {reveal && (
                      <span className="truth-chip">
                        True value {money(current.truth)}
                      </span>
                    )}
                  </h2>
                  <ul className="says">
                    {current.entries.map((e) => entryLine(e, current.truth))}
                    {current.recheck &&
                      entryLine(current.recheck, current.truth, "rechecks")}
                  </ul>
                  {current.monitorNote && (
                    <p
                      className={
                        "verdict" + (current.quarantined ? " is-action" : "")
                      }
                    >
                      <b>Monitor:</b> {current.monitorNote}
                    </p>
                  )}
                </>
              )}
              {finished && score && (
                <p className="result">
                  {game.rogue
                    ? `${game.rogue} was the rogue. ${
                        score.caught
                          ? `Caught in round ${score.roundCaught}.`
                          : "It was never caught."
                      } `
                    : "There was no rogue in this game. "}
                  {score.falseQuarantines === 0
                    ? "No honest agent was removed."
                    : `${score.falseQuarantines} honest agent${score.falseQuarantines > 1 ? "s were" : " was"} removed.`}{" "}
                  The ledger ended {signedMoney(score.ledgerError)} off (
                  {pct(score.ledgerErrorPct)}).
                </p>
              )}
            </div>

            <div className="transport">
              <button type="button" onClick={() => { setStep(0); setPlaying(false); }}>
                Restart
              </button>
              <button
                type="button"
                onClick={() => { setStep((s) => Math.max(0, s - 1)); setPlaying(false); }}
                disabled={step === 0}
              >
                Back
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (finished) setStep(0);
                  setPlaying(finished ? true : !playing);
                }}
              >
                {playing && !finished ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => { setStep((s) => Math.min(total, s + 1)); setPlaying(false); }}
                disabled={finished}
              >
                Next round
              </button>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={reveal}
                  onChange={(e) => setReveal(e.target.checked)}
                />
                Show the truth
              </label>
            </div>

            <div className="picker">
              <span>
                Game {Math.min(gameIdx, cellGames.length - 1) + 1} of{" "}
                {cellGames.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  choose(rogue.id, monitor.id, (gameIdx + 1) % cellGames.length)
                }
              >
                Next game
              </button>
              <span className="picker-find">Find a game where</span>
              <button type="button" disabled={!has(wasCaught)} onClick={() => jump(wasCaught)}>
                the rogue is caught
              </button>
              <button type="button" disabled={!has(gotAway)} onClick={() => jump(gotAway)}>
                the rogue gets away
              </button>
              <button type="button" disabled={!has(honestRemoved)} onClick={() => jump(honestRemoved)}>
                an honest agent is removed
              </button>
            </div>
          </div>

          <div className="ledger-wrap">
            <table className={"ledger" + (showTruth ? " shows-truth" : "")}>
              <caption>
                The ledger
                <span>
                  {showTruth
                    ? "With the true figures, which the monitor never sees."
                    : "As the monitor sees it."}
                </span>
              </caption>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col" className="l">Item</th>
                  <th scope="col" className="l">Answers</th>
                  <th scope="col">Posted</th>
                  <th scope="col">True value</th>
                  <th scope="col">Off by</th>
                </tr>
              </thead>
              <tbody>
                {game.rounds.map((r) => {
                  const on = r.n <= step;
                  const split =
                    r.entries.length === 2 &&
                    r.entries[0].answer !== r.entries[1].answer;
                  const off = r.posted - r.truth;
                  return (
                    <tr
                      key={r.n}
                      className={
                        (r.n === step ? "is-now" : "") + (on ? "" : " is-blank")
                      }
                    >
                      <td>{r.n}</td>
                      <td className="l">{on ? r.item : ""}</td>
                      <td className={"l answers" + (split ? " is-split" : "")}>
                        {on &&
                          r.entries.map((e, i) => (
                            <span key={e.agent}>
                              {i > 0 && (split ? " vs " : " = ")}
                              {e.agent} {money(e.answer)}
                            </span>
                          ))}
                        {on && r.quarantined && (
                          <span className="stamp">{r.quarantined} removed</span>
                        )}
                      </td>
                      <td>{on ? money(r.posted) : ""}</td>
                      <td>{on && showTruth ? money(r.truth) : ""}</td>
                      <td className={Math.abs(off) >= 0.5 ? "red" : ""}>
                        {on && showTruth
                          ? Math.abs(off) < 0.5
                            ? "0"
                            : signedMoney(off)
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td className="l" colSpan={2}>
                    Total after {shown.length} of {total} rounds
                  </td>
                  <td>{money(postedTotal)}</td>
                  <td>{showTruth ? money(truthTotal) : ""}</td>
                  <td
                    className={
                      Math.abs(postedTotal - truthTotal) >= 0.5 ? "red" : ""
                    }
                  >
                    {showTruth ? signedMoney(postedTotal - truthTotal) : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <section className="board" aria-label="Scoreboard">
        <div className="board-head">
          <h2>Every rogue against every monitor</h2>
          <div className="seg small" role="group" aria-label="Measure">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === metric.id}
                onClick={() => setMetricId(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="board-body">
          <table className="matrix">
            <thead>
              <tr>
                <td />
                {monitors.map((m) => (
                  <th key={m.id} scope="col">
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rogues.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name} rogue</th>
                  {monitors.map((m) => {
                    const c = cells.get(r.id + "|" + m.id);
                    if (!c) return <td key={m.id} className="no-data">no games</td>;
                    const v = metric.value(c.stats);
                    const heat =
                      v === null ? 0 : Math.min(1, v / metric.scale);
                    const selected = r.id === rogue.id && m.id === monitor.id;
                    return (
                      <td key={m.id}>
                        <button
                          type="button"
                          className={
                            "cell " +
                            metric.tone +
                            (heat > 0.42 ? " is-deep" : "") +
                            (selected ? " is-selected" : "")
                          }
                          style={{ "--heat": heat } as React.CSSProperties}
                          aria-pressed={selected}
                          aria-label={`${r.name} rogue against ${m.name}: ${metric.show(c.stats)}, ${c.stats.n} games`}
                          onClick={() => choose(r.id, m.id)}
                        >
                          {metric.show(c.stats)}
                          {loaded && !loaded.stats && <small>n={c.stats.n}</small>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {cell && (
            <dl className="four">
              <div className="four-title">
                {rogue.name} rogue against {monitor.name}, {cell.stats.n} games
              </div>
              {METRICS.map((m) => (
                <div key={m.id}>
                  <dt>{m.name}</dt>
                  <dd>{m.show(cell.stats)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="board" aria-label="Detectors on real agent logs">
        <div className="board-head">
          <h2>Four detectors on real agent logs</h2>
          <p className="real-src">
            {real.games} published Among Us games played by Phi-4 and
            Llama-3.3-70B, {real.playerGames.toLocaleString("en-US")}{" "}
            player-games. Each detector reads only what players said and how the
            room voted, then names two suspects per game. Guessing gets{" "}
            {wholePct(real.chance)} right.
          </p>
        </div>
        <table className="matrix real">
          <thead>
            <tr>
              <td />
              <th scope="col">Suspects that were impostors</th>
              {REAL_MODELS.map((m) => (
                <th key={m} scope="col">
                  When {m} plays impostor
                </th>
              ))}
              <th scope="col" className="l">How it works</th>
            </tr>
          </thead>
          <tbody>
            {real.detectors.map((d, i) => {
              const blocks = [
                d.all,
                ...REAL_MODELS.map((m) => (d as Record<string, unknown>)[m]),
              ] as RealBlock[];
              return (
                <tr key={d.name}>
                  <th scope="row">
                    {i + 1}. {d.name}
                  </th>
                  {blocks.map((b, j) => (
                    <td key={j}>
                      <span
                        className={"cell good" + (b.precision > 0.42 ? " is-deep" : "")}
                        style={{ "--heat": b.precision } as React.CSSProperties}
                      >
                        {wholePct(b.precision)}
                        <small>{b.games} games</small>
                      </span>
                    </td>
                  ))}
                  <td className="real-how">{d.blurb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <footer className="foot">
        Keys: right and left arrows step a round, space plays or pauses, T shows
        the truth. A ledger game is a toy: what carries over is the monitoring
        pattern and the habit of counting false accusations.
      </footer>
    </main>
  );
}

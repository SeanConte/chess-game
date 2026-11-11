# AI engine — 0.26

The previous engine already had iterative deepening and time limits. Its main
problems were main-thread search, expensive cloning of UI/history state,
beam limits that narrowed at higher levels, and transposition values stored as
exact even after alpha-beta cutoffs.

## Design

- A compact flat board, two numeric banks, attack-map caching, and lightweight
  copies replace JSON snapshots in search. Search never copies undo history,
  animation state, logs, or clocks.
- A Blob worker runs the self-contained engine factory. This supports opening
  index.html directly from disk without worker imports or a local server.
- Iterative deepening retains the last completed iteration. A partial initial
  root scan retains its best evaluated action. A legal fallback is published
  first. A timed-out deeper iteration does not displace a completed result.
- Alpha-beta considers all legal actions; there is no beam truncation. Move
  ordering uses previous best moves, escape from threatened squares, support,
  and centrality. The root reuses its simulated children between iterations.
- A per-search transposition table stores depth, best move, and exact/lower/
  upper bounds. Its size is capped at 50,000 entries. Mode, style and point of
  view are constant within one search; the key includes board, banks, turn,
  and remaining tactical-extension allowance.
- At the depth limit, an outnumbered side gets up to one or two additional
  plies for rescue/capture resolution. This is bounded tactical search, not a
  proof that a position is quiet or that all threats have been solved.
- Evaluation emphasizes survivor counts in Total War/no-movement endings,
  queens in Queens Gambit, outnumbering risk, safe deployment space, and
  support. Conventional piece values have a secondary role. Aggressive style
  values pressure on the opponent more; Defensive values self-preservation more.
- Difficulty budgets: 120 / 350 / 850 / 1,700 ms. All deepen adaptively up to a
  safety ceiling of 32 plies. Clock pressure caps thinking at 8% of remaining
  time, with a 10 ms floor. Budgets exclude worker startup and are best-effort
  deadlines between small search operations, not hard real-time guarantees.
- A main-thread watchdog allows 500 ms startup grace. Each job has an identity;
  Undo/Restart/Exit/timeout terminate it and invalidate queued answers. Results
  are revalidated through tryPlace/tryMove before affecting the live game.
- If workers fail, a generator-based fallback yields between slices and uses
  at most a 350 ms search budget. A single rule-generation operation can exceed
  the nominal 8 ms slice on slow devices; worker mode is preferred.

## Validation

The dependency-free Node suite compares legal action sets and resulting boards,
banks, turns, and outcomes against frozen pre-rebuild rules. Its deterministic
run passed 297 positions and 2,970 transitions across all 27 combinations of
mode, movement setting, and army preset. An earlier independent run covered
350 positions.

Tactical checks cover Sudden Death rescue, endangered-queen rescue, multi-round
capture cascades, survivor-count endings, and a two-ply result compared with
exhaustive minimax. Timing checks verify a legal answer under small budgets.
On this runtime, the opening benchmark returned at approximately the requested
120/350/850/1,700 ms budgets, reaching depths 1/2/2/3 respectively. Search depth
varies with position, device, and tactical extensions.

Browser tests using the file:// launch path verify an Expert reply while the
Settings UI remains usable, Undo after a reply, cancellation during thinking,
Restart/Exit cancellation, and successful fallback when Worker is disabled.
Mobile tests exercise legal replies in all nine mode/movement combinations and
clock expiration during thinking. No browser JavaScript errors were reported.

This is not Stockfish or a neural model. It is an engine for Chess II's different
rules. The regression tests establish rule fidelity, selected tactical behavior,
and responsiveness; they do not establish a rating or a measured win-rate gain
against the old engine. Timed search can still miss longer tactics.

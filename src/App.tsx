import { BookOpen, Coins, HelpCircle, RotateCcw, Settings, ShieldQuestion, Sparkles, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { allowedActions, createInitialState, playerAction, resetBankroll, resetTraining, revealTip, setBet, startRound, takeInsurance } from "./blackjack/game";
import { scoreHand } from "./blackjack/hand";
import { defaultRules, rulesSummary } from "./blackjack/rules";
import { getStrategyAdvice } from "./blackjack/strategy";
import type { Card, PlayerAction, Rank, RoundState, TableRules } from "./blackjack/types";
import { cardCode, makeCard } from "./blackjack/cards";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

const allChipValues = [1, 5, 25, 100, 500, 1_000, 5_000, 25_000, 100_000];
const defaultVisibleChips = [1, 5, 25, 100];
const bankrollPresets = [1_000, 10_000, 100_000, 1_000_000];
const dealerRanks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

const chipStyles: Record<number, { base: string; edge: string; text: string; accent: string }> = {
  1: { base: "#f8f3e9", edge: "#2d7fb8", text: "#16202a", accent: "#d9cab5" },
  5: { base: "#b82432", edge: "#fff3dc", text: "#fff6e8", accent: "#6d151d" },
  25: { base: "#16834d", edge: "#f2e8ca", text: "#fff8e8", accent: "#07532d" },
  100: { base: "#151515", edge: "#f2f0e8", text: "#fff8e8", accent: "#404040" },
  500: { base: "#6f3b93", edge: "#f5d66a", text: "#fff8e8", accent: "#43245b" },
  1000: { base: "#d3a632", edge: "#f8f0dc", text: "#1f1605", accent: "#87620b" },
  5000: { base: "#b95b1f", edge: "#1b1714", text: "#fff8e8", accent: "#6f3512" },
  25000: { base: "#1f7d89", edge: "#f5ead6", text: "#fff8e8", accent: "#0f4a52" },
  100000: { base: "#6c1427", edge: "#e5c36a", text: "#fff8e8", accent: "#2a0d15" },
};

function App() {
  const [rules, setRules] = useState<TableRules>(defaultRules);
  const [state, setState] = useState<RoundState>(() => createInitialState(defaultRules));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [visibleChipValues, setVisibleChipValues] = useState(defaultVisibleChips);
  const [betChips, setBetChips] = useState<number[]>([]);
  const actions = useMemo(() => allowedActions(state, rules), [state, rules]);
  const activeHand = state.hands[state.activeHandIndex];
  const dealerValue = state.phase === "player" || state.phase === "insurance" ? scoreHand(state.dealer.slice(0, 1)) : scoreHand(state.dealer);

  useEffect(() => {
    window.advanceTime = () => undefined;
    window.render_game_to_text = () =>
      JSON.stringify({
        coordinateSystem: "DOM UI, origin top-left, cards and controls visible in labeled regions",
        phase: state.phase,
        bankroll: state.bankroll,
        bet: state.bet,
        betChips,
        visibleChipValues,
        bookOpen,
        trainingPoints: state.trainingPoints,
        rules: rulesSummary(rules),
        dealer: {
          upcard: state.dealer[0] ? cardCode(state.dealer[0]) : null,
          cards: state.phase === "player" || state.phase === "insurance" ? state.dealer.slice(0, 1).map(cardCode) : state.dealer.map(cardCode),
          total: dealerValue.total,
        },
        activeHandIndex: state.activeHandIndex,
        hands: state.hands.map((hand) => ({
          cards: hand.cards.map(cardCode),
          total: scoreHand(hand.cards).total,
          soft: scoreHand(hand.cards).soft,
          bet: hand.bet,
          status: hand.status,
          outcome: hand.outcome,
          canEarnStrategyPoint: hand.canEarnStrategyPoint,
        })),
        availableActions: actions,
        message: state.message,
        latestFeedback: state.feedback[0]?.message ?? null,
      });
  }, [actions, betChips, bookOpen, dealerValue.soft, dealerValue.total, rules, state, visibleChipValues]);

  function updateRules(updates: Partial<TableRules>) {
    const nextRules = { ...rules, ...updates };
    setRules(nextRules);
    if (state.phase === "betting" || state.phase === "settled") {
      setState((current) => ({ ...createInitialState(nextRules), bankroll: current.bankroll, bet: current.bet, trainingPoints: current.trainingPoints }));
    }
  }

  function beginRound() {
    setSettingsOpen(false);
    setState((current) => startRound(current, rules));
  }

  function doAction(action: Exclude<PlayerAction, "insurance">) {
    setState((current) => playerAction(current, rules, action));
  }

  function dealAgain() {
    setSettingsOpen(false);
    setState((current) => startRound({ ...current, phase: "betting", dealer: [], hands: [], activeHandIndex: 0, insuranceBet: 0 }, rules));
  }

  function changeBet() {
    setState((current) => ({
      ...current,
      bet: betChips.reduce((total, chip) => total + chip, 0),
      phase: "betting",
      dealer: [],
      hands: [],
      activeHandIndex: 0,
      insuranceBet: 0,
      message: "Adjust your wager, then deal.",
    }));
  }

  function addChip(value: number) {
    if (state.phase !== "betting") return;
    if (state.bet + value > state.bankroll) return;
    const nextChips = [...betChips, value];
    setBetChips(nextChips);
    setState((current) => setBet(current, nextChips.reduce((total, chip) => total + chip, 0)));
  }

  function clearBet() {
    if (state.phase !== "betting") return;
    setBetChips([]);
    setState((current) => setBet(current, 0));
  }

  function setBankrollPreset(bankroll: number) {
    setBetChips([]);
    setState((current) => resetBankroll(current, bankroll));
  }

  return (
    <main className="app-shell">
      <section className="tabletop" aria-label="Blackjack table">
        <header className="topbar">
          <div>
            <p className="eyebrow">Basic Strategy Trainer</p>
            <h1>Blackjack</h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" type="button" aria-label="Open strategy book" title="Strategy book" onClick={() => setBookOpen(true)}>
              <BookOpen size={22} />
            </button>
            <button className="icon-button" type="button" aria-label="Open settings" title="Settings" onClick={() => setSettingsOpen((open) => !open)}>
              <Settings size={22} />
            </button>
          </div>
        </header>

        <div className="score-strip">
          <Metric label="Bankroll" value={`$${state.bankroll.toFixed(0)}`} />
          <Metric label="Training" value={`${state.trainingPoints} pts`} />
          <Metric label="Shoe" value={`${state.shoe.length} cards`} />
        </div>

        {settingsOpen && (
          <SettingsPanel
            rules={rules}
            locked={state.phase !== "betting" && state.phase !== "settled"}
            onChange={updateRules}
            onResetBankroll={() => {
              setBetChips([]);
              setState(resetBankroll);
            }}
            bankroll={state.bankroll}
            onSetBankroll={setBankrollPreset}
            onResetTraining={() => setState(resetTraining)}
            visibleChipValues={visibleChipValues}
            onVisibleChipValuesChange={setVisibleChipValues}
          />
        )}

        <div className="dealer-zone">
          <ZoneLabel title="Dealer" detail={state.dealer.length ? `${dealerValue.soft ? "Soft " : ""}${dealerValue.total}` : "Waiting"} />
          <div className="card-row">
            {state.dealer.map((card, index) => (
              <PlayingCard key={card.id} card={card} hidden={index === 1 && (state.phase === "player" || state.phase === "insurance")} />
            ))}
            {!state.dealer.length && <EmptyCard />}
          </div>
        </div>

        <div className="message-rail" role="status">
          <Sparkles size={18} />
          <span>{state.message}</span>
        </div>

        <div className="player-zone">
          {state.hands.length ? (
            state.hands.map((hand, index) => {
              const value = scoreHand(hand.cards);
              return (
                <div className={`hand-panel ${index === state.activeHandIndex && state.phase === "player" ? "active" : ""}`} key={hand.id}>
                  <ZoneLabel title={`Hand ${index + 1}`} detail={`${value.soft ? "Soft " : ""}${value.total} · $${hand.bet} · ${hand.outcome}`} />
                  <div className="card-row">
                    {hand.cards.map((card) => (
                      <PlayingCard key={card.id} card={card} />
                    ))}
                  </div>
                  <div className="hand-foot">
                    <span>{hand.canEarnStrategyPoint ? "Point eligible" : "Tip used"}</span>
                    <span>{hand.correctDecisionCount}/{hand.decisionCount} correct</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-seat">
              <Coins size={28} />
              <span>Set a wager and deal a fresh shoe hand.</span>
            </div>
          )}
        </div>

        <ControlDock
          state={state}
          actions={actions}
          activeHand={activeHand}
          visibleChipValues={visibleChipValues}
          betChips={betChips}
          onAddChip={addChip}
          onClearBet={clearBet}
          onDeal={beginRound}
          onDealAgain={dealAgain}
          onChangeBet={changeBet}
          onAction={doAction}
          onTip={() => setState((current) => revealTip(current, rules))}
          onInsurance={(accepted) => setState((current) => takeInsurance(current, rules, accepted))}
        />
      </section>

      <aside className="feedback-panel">
        <div className="panel-title">
          <ShieldQuestion size={20} />
          <h2>Strategy Feedback</h2>
        </div>
        {state.feedback.length ? (
          <ol className="feedback-list">
            {state.feedback.map((entry) => (
              <li className={entry.correct ? "good" : "miss"} key={entry.id}>
                <strong>{entry.awardedPoint ? "+1 point" : entry.correct ? "Correct" : "Miss"}</strong>
                <span>{entry.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="quiet">Feedback appears after each decision. Tips are allowed, but that decision stops earning trainer points.</p>
        )}
        <div className="asset-spec">
          <h2>Custom Cards</h2>
          <p>Place PNG or WebP files in <code>/public/cards</code> as <code>AS.png</code>, <code>10H.png</code>, <code>QC.png</code>, and <code>back.png</code>. Use 744x1038 px or larger.</p>
        </div>
      </aside>
      {bookOpen && <StrategyBook rules={rules} onClose={() => setBookOpen(false)} />}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ZoneLabel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="zone-label">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function ControlDock({
  state,
  actions,
  activeHand,
  visibleChipValues,
  betChips,
  onAddChip,
  onClearBet,
  onDeal,
  onDealAgain,
  onChangeBet,
  onAction,
  onTip,
  onInsurance,
}: {
  state: RoundState;
  actions: PlayerAction[];
  activeHand?: RoundState["hands"][number];
  visibleChipValues: number[];
  betChips: number[];
  onAddChip: (value: number) => void;
  onClearBet: () => void;
  onDeal: () => void;
  onDealAgain: () => void;
  onChangeBet: () => void;
  onAction: (action: Exclude<PlayerAction, "insurance">) => void;
  onTip: () => void;
  onInsurance: (accepted: boolean) => void;
}) {
  if (state.phase === "insurance") {
    return (
      <div className="control-dock">
        <button id="decline-insurance-btn" type="button" className="primary" onClick={() => onInsurance(false)}>Decline Insurance</button>
        <button id="take-insurance-btn" type="button" onClick={() => onInsurance(true)}>Take Insurance</button>
        <button id="tip-btn" type="button" className="ghost" onClick={onTip}><HelpCircle size={18} /> Tip</button>
      </div>
    );
  }

  if (state.phase === "betting") {
    return (
      <div className="control-dock betting">
        <BetSpot chips={betChips} total={state.bet} />
        <div className="chip-rack" aria-label="Chip rack">
          {visibleChipValues.map((value) => (
            <ChipButton
              key={value}
              value={value}
              disabled={state.bet + value > state.bankroll}
              onClick={() => onAddChip(value)}
            />
          ))}
        </div>
        <button type="button" className="ghost" onClick={onClearBet} disabled={state.bet === 0}>Clear</button>
        <button id="deal-btn" type="button" className="primary" onClick={onDeal} disabled={state.bet <= 0 || state.bankroll < state.bet}>Deal</button>
      </div>
    );
  }

  if (state.phase === "settled") {
    return (
      <div className="control-dock settled">
        <BetSpot chips={betChips} total={state.bet} />
        <button id="deal-again-btn" type="button" className="primary" onClick={onDealAgain} disabled={state.bet <= 0 || state.bankroll < state.bet}>
          <RotateCcw size={18} /> Deal Again
        </button>
        <button id="change-bet-btn" type="button" className="ghost" onClick={onChangeBet}>Change Bet</button>
      </div>
    );
  }

  return (
    <div className="control-dock">
      {(["hit", "stand", "double", "split", "surrender"] as const).map((action) => (
        <button id={`${action}-btn`} type="button" key={action} disabled={!actions.includes(action)} onClick={() => onAction(action)}>
          {action}
        </button>
      ))}
      <button id="tip-btn" type="button" className="ghost" onClick={onTip} disabled={!activeHand}>
        <HelpCircle size={18} /> Tip
      </button>
    </div>
  );
}

function SettingsPanel({
  rules,
  locked,
  onChange,
  onResetBankroll,
  bankroll,
  onSetBankroll,
  onResetTraining,
  visibleChipValues,
  onVisibleChipValuesChange,
}: {
  rules: TableRules;
  locked: boolean;
  onChange: (updates: Partial<TableRules>) => void;
  onResetBankroll: () => void;
  bankroll: number;
  onSetBankroll: (bankroll: number) => void;
  onResetTraining: () => void;
  visibleChipValues: number[];
  onVisibleChipValuesChange: (values: number[]) => void;
}) {
  function toggleChip(value: number, checked: boolean) {
    const next = checked
      ? [...visibleChipValues, value]
      : visibleChipValues.filter((chipValue) => chipValue !== value);
    onVisibleChipValuesChange(next.sort((a, b) => a - b));
  }

  return (
    <div className="settings-panel">
      <label>
        Decks
        <select disabled={locked} value={rules.deckCount} onChange={(event) => onChange({ deckCount: Number(event.target.value) })}>
          {[1, 2, 4, 6, 8].map((count) => <option value={count} key={count}>{count}</option>)}
        </select>
      </label>
      <label>
        Soft 17
        <select disabled={locked} value={rules.dealerHitsSoft17 ? "H17" : "S17"} onChange={(event) => onChange({ dealerHitsSoft17: event.target.value === "H17" })}>
          <option value="H17">Dealer hits</option>
          <option value="S17">Dealer stands</option>
        </select>
      </label>
      <label>
        Blackjack
        <select disabled={locked} value={rules.blackjackPayout} onChange={(event) => onChange({ blackjackPayout: event.target.value as TableRules["blackjackPayout"] })}>
          <option value="6:5">6:5</option>
          <option value="3:2">3:2</option>
          <option value="1:1">1:1</option>
        </select>
      </label>
      <Toggle label="Insurance" checked={rules.insurance} disabled={locked} onChange={(insurance) => onChange({ insurance })} />
      <Toggle label="DAS" checked={rules.doubleAfterSplit} disabled={locked} onChange={(doubleAfterSplit) => onChange({ doubleAfterSplit })} />
      <Toggle label="Surrender" checked={rules.surrender} disabled={locked} onChange={(surrender) => onChange({ surrender })} />
      <label>
        Resplit
        <input disabled={locked} type="number" min={0} max={4} value={rules.resplitLimit} onChange={(event) => onChange({ resplitLimit: Number(event.target.value) })} />
      </label>
      <label>
        Bankroll
        <select disabled={locked} value={closestBankrollPreset(bankroll)} onChange={(event) => onSetBankroll(Number(event.target.value))}>
          {bankrollPresets.map((value) => <option value={value} key={value}>{formatMoney(value)}</option>)}
        </select>
      </label>
      <button type="button" disabled={locked} onClick={onResetBankroll}>Reset bankroll</button>
      <button type="button" disabled={locked} onClick={onResetTraining}>Reset training</button>
      <fieldset className="chip-settings">
        <legend>Chip rack</legend>
        {allChipValues.map((value) => (
          <Toggle
            key={value}
            label={formatMoney(value)}
            checked={visibleChipValues.includes(value)}
            disabled={locked}
            onChange={(checked) => toggleChip(value, checked)}
          />
        ))}
      </fieldset>
    </div>
  );
}

function closestBankrollPreset(bankroll: number): number {
  return bankrollPresets.includes(bankroll) ? bankroll : bankrollPresets[0];
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function PlayingCard({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  const code = hidden ? "back" : cardCode(card);
  const red = !hidden && (card.suit === "H" || card.suit === "D");

  return (
    <div className={`playing-card ${hidden ? "back" : ""} ${red ? "red" : ""}`} aria-label={hidden ? "Hidden card" : code}>
      <img src={`/cards/${code}.png`} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      {!hidden && (
        <>
          <span className="corner top">{card.rank}<small>{suitSymbol(card.suit)}</small></span>
          <span className="pip">{suitSymbol(card.suit)}</span>
          <span className="corner bottom">{card.rank}<small>{suitSymbol(card.suit)}</small></span>
        </>
      )}
    </div>
  );
}

function StrategyBook({ rules, onClose }: { rules: TableRules; onClose: () => void }) {
  return (
    <div className="book-backdrop" role="dialog" aria-modal="true" aria-label="Basic strategy chart">
      <section className="strategy-book">
        <header className="book-header">
          <div>
            <p className="eyebrow">Basic Strategy</p>
            <h2>{rulesSummary(rules)}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close strategy book" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="book-legend" aria-label="Chart key">
          <span><b>H</b> Hit</span>
          <span><b>S</b> Stand</span>
          <span><b>D</b> Double</span>
          <span><b>P</b> Split</span>
          <span><b>R</b> Surrender</span>
        </div>
        <div className="book-grid">
          <StrategyTable title="Hard Totals" rows={hardRows(rules)} />
          <StrategyTable title="Soft Totals" rows={softRows(rules)} />
          <StrategyTable title="Pairs" rows={pairRows(rules)} />
        </div>
      </section>
    </div>
  );
}

function StrategyTable({ title, rows }: { title: string; rows: { label: string; actions: PlayerAction[] }[] }) {
  return (
    <section className="strategy-table">
      <h3>{title}</h3>
      <div className="strategy-scroll">
        <table>
          <thead>
            <tr>
              <th>Hand</th>
              {dealerRanks.map((rank) => <th key={rank}>{rank}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th>{row.label}</th>
                {row.actions.map((action, index) => (
                  <td className={`action-${action}`} key={`${row.label}-${dealerRanks[index]}`}>{actionCode(action)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function hardRows(rules: TableRules) {
  return Array.from({ length: 13 }, (_, index) => {
    const total = index + 5;
    return {
      label: String(total),
      actions: dealerRanks.map((dealerRank) => strategyAction(hardCards(total), dealerRank, rules, false)),
    };
  });
}

function softRows(rules: TableRules) {
  return Array.from({ length: 8 }, (_, index) => {
    const kicker = (index + 2).toString() as Rank;
    const total = index + 13;
    return {
      label: `A,${kicker} (${total})`,
      actions: dealerRanks.map((dealerRank) => strategyAction([makeCard("A"), makeCard(kicker)], dealerRank, rules, false)),
    };
  });
}

function pairRows(rules: TableRules) {
  const pairRanks: Rank[] = ["A", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
  return pairRanks.map((rank) => ({
    label: `${rank},${rank}`,
    actions: dealerRanks.map((dealerRank) => strategyAction([makeCard(rank), makeCard(rank, "H")], dealerRank, rules, true)),
  }));
}

function strategyAction(cards: Card[], dealerRank: Rank, rules: TableRules, canSplit: boolean): PlayerAction {
  return getStrategyAdvice({
    cards,
    dealerUpcard: makeCard(dealerRank, "D"),
    rules,
    canDouble: true,
    canSplit,
    canSurrender: cards.length === 2 && !canSplit,
  }).action;
}

function hardCards(total: number): Card[] {
  const pairs: Record<number, [Rank, Rank]> = {
    5: ["2", "3"],
    6: ["2", "4"],
    7: ["3", "4"],
    8: ["3", "5"],
    9: ["4", "5"],
    10: ["4", "6"],
    11: ["5", "6"],
    12: ["10", "2"],
    13: ["10", "3"],
    14: ["10", "4"],
    15: ["10", "5"],
    16: ["10", "6"],
    17: ["10", "7"],
  };
  const [first, second] = pairs[total];
  return [makeCard(first), makeCard(second, "H")];
}

function actionCode(action: PlayerAction): string {
  if (action === "hit") return "H";
  if (action === "stand") return "S";
  if (action === "double") return "D";
  if (action === "split") return "P";
  if (action === "surrender") return "R";
  return "I";
}

function BetSpot({ chips, total }: { chips: number[]; total: number }) {
  const grouped = allChipValues
    .map((value) => ({ value, count: chips.filter((chip) => chip === value).length }))
    .filter((group) => group.count > 0);

  return (
    <div className="bet-spot" aria-label="Bet area">
      <span className="bet-ring" />
      <div className="bet-stacks">
        {grouped.length ? grouped.map((group) => <ChipStack key={group.value} value={group.value} count={group.count} />) : <span className="empty-bet">Bet area</span>}
      </div>
      <strong>{formatMoney(total)}</strong>
    </div>
  );
}

function ChipStack({ value, count }: { value: number; count: number }) {
  return (
    <div className="chip-stack" aria-label={`${count} ${formatMoney(value)} chips`}>
      {Array.from({ length: Math.min(count, 8) }, (_, index) => (
        <CasinoChip key={index} value={value} className="stacked-chip" style={{ "--stack-index": index } as CSSProperties} />
      ))}
      {count > 8 && <span className="stack-count">x{count}</span>}
    </div>
  );
}

function ChipButton({ value, disabled, onClick }: { value: number; disabled: boolean; onClick: () => void }) {
  return (
    <button
      id={`chip-${value}-btn`}
      type="button"
      className="chip-button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Add ${formatMoney(value)} chip`}
    >
      <CasinoChip value={value} />
    </button>
  );
}

function CasinoChip({ value, className = "", style }: { value: number; className?: string; style?: CSSProperties }) {
  const styleTokens = chipStyles[value];
  return (
    <span
      className={`casino-chip ${className}`}
      style={{
        "--chip-base": styleTokens.base,
        "--chip-edge": styleTokens.edge,
        "--chip-text": styleTokens.text,
        "--chip-accent": styleTokens.accent,
        ...style,
      } as CSSProperties}
    >
      <span className="chip-inlay">{formatChipLabel(value)}</span>
    </span>
  );
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function formatChipLabel(value: number): string {
  if (value >= 1000) return `$${value / 1000}K`;
  return `$${value}`;
}

function EmptyCard() {
  return <div className="playing-card empty" aria-hidden="true" />;
}

function suitSymbol(suit: Card["suit"]): string {
  if (suit === "S") return "♠";
  if (suit === "H") return "♥";
  if (suit === "D") return "♦";
  return "♣";
}

export default App;

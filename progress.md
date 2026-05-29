Original prompt: Implement a blackjack basic strategy trainer web app: playable blackjack with common Vegas Strip floor defaults, adjustable rules, strategy feedback, points separate from bankroll, a tip button that forfeits strategy points for the current decision, and support for future custom card art.

Progress:
- Created greenfield Vite/React/TypeScript project structure.
- Added pure blackjack modules for cards, scoring, rule defaults, strategy advice, and game state transitions.
- Added React table UI, settings, trainer feedback, tip handling, custom-card asset instructions, and render_game_to_text hook.
- Added unit tests for scoring, strategy lookup, payouts, insurance, and tip point forfeits.
- Verified desktop and mobile browser screenshots with Playwright; no console errors found.
- Removed visible rules metric, added clickable casino-style chip rack, configurable chip denominations, and a stacked bet area that preserves repeated chip clicks.
- Added post-round Deal Again and Change Bet flow; Deal Again immediately reuses the existing wager stack.
- Added a rules-aware basic strategy book modal generated from the same strategy lookup used for trainer feedback.
- Ran multi-agent gameplay/UI/QA review, fixed legal-action strategy advice, live-hand reset locking, insurance feedback, bankroll presets for high chips, settings auto-collapse on deal, mobile strategy book layout, and dealer-total placement.
- Optimized mobile/iPhone layout with compact phone flow, sticky touch controls, Safari viewport/safe-area metadata, app manifest, and production service worker shell caching.
- Enlarged Hit/Stand relative to Double/Split and replaced generic basic-strategy tip copy with specific per-total, per-pair, and surrender explanations.

TODO:
- Future: expand strategy tables for more niche rule combinations, add a dedicated individual-hand learning mode, and support a JSON sprite-sheet manifest for custom card packs.

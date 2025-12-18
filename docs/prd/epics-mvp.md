# 8. Epics (MVP)

1) Epic: Core Game Loop and Rules Engine
   - Goal: Implement pure, framework‑agnostic game logic (board state, rules, win/draw), UI board rendering, turn indicator, restart
   - High‑Level Acceptance: Make a legal move; detect win/draw; restart clears state; logic covered by unit tests

2) Epic: Solo vs CPU and Local Multiplayer
   - Goal: Add pass‑and‑play mode and basic CPU opponent with simple heuristics
   - High‑Level Acceptance: Mode selection works; CPU makes valid timely moves; human‑vs‑human alternation; outcomes tracked

3) Epic: UX Polish, Settings, and Local Stats
   - Goal: Add animations, haptics/sound toggles, reset stats, AsyncStorage persistence for stats/settings
   - High‑Level Acceptance: Win line highlight; settings persist across sessions; stats update accurately and can be reset
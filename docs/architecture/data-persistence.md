# 5. Data and Persistence
- Keys: `xo:stats:{mode}`, `xo:settings`.
- Stats model: `{ wins: number, losses: number, draws: number }` per mode.
- Settings model: `{ soundEnabled: boolean, hapticsEnabled: boolean }`.
- Atomic updates: read‑modify‑write with simple collision avoidance; small data footprint.
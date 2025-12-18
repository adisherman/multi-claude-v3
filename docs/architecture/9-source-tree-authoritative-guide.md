# 9. Source Tree (Authoritative Guide)

```
project-root/
├── mobile/
│  ├── src/
│  │  ├── core/
│  │  │  ├── engine/            # Pure TS rules engine
│  │  │  └── ai/                 # CPU heuristics
│  │  ├── services/
│  │  │  └── storage/            # AsyncStorage wrapper
│  │  ├── ui/
│  │  │  ├── components/         # Board, Cell, HUD, WinLine
│  │  │  └── screens/            # Home, Game, Settings
│  │  ├── navigation/            # Minimal stack navigator
│  │  ├── theme/                 # Color tokens, spacing, motion
│  │  ├── lib/                   # Small utilities/types
│  │  └── tests/                 # Unit + integration tests
│  └── App.tsx
└── backend/                     # Scaffold only (unused in MVP)
```
- This tree guides where new files live and how modules are named; stories must align to this structure for predictable implementation and review .
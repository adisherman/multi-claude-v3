# 1. High-Level Architecture
- Style: Mobile monolith (Expo-managed) with no runtime backend in MVP.
- Repository: Monorepo with mobile/ and backend/ folders (backend unused in MVP; future-ready scaffold).
- Data: Device-local persistence for stats/settings via AsyncStorage.
- State: Local React state + hooks; pure functions for game engine.
- Accessibility: WCAG AA targets (contrast, touch targets, focus order) per PRD.

## 1.1 System Diagram
```mermaid
graph TD
  U[User] -->|Tap| App[XO Mobile App (Expo, RN)]
  subgraph Device
    App --> UI[UI Layer: Screens + Components]
    App --> Engine[Game Engine (pure TS)]
    App --> AI[CPU Heuristics]
    App --> Store[AsyncStorage Wrapper]
  end
  style App fill:#1f78b4,stroke:#0b3551,stroke-width:1
  style Engine fill:#a6cee3,stroke:#0b3551
  style AI fill:#a6cee3,stroke:#0b3551
  style Store fill:#a6cee3,stroke:#0b3551
  style UI fill:#a6cee3,stroke:#0b3551
```
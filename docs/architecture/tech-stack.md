# 2. Tech Stack (Definitive)
| Category | Technology | Version | Purpose | Rationale |
|---|---|---:|---|---|
| Platform | Expo | ~54.0.23 | Managed app runtime | Matches template; fast iteration
| Framework | React Native | 0.81.5 | Mobile UI | Current with Expo 54
| UI Library | React | 19.1.0 | Component model | Matches template
| Language | TypeScript | ~5.9.x | Types + tooling | Good RN/Expo support
| Navigation | @react-navigation/native | 7.x (pin at setup) | Screen flow | De facto RN navigation
| Storage | @react-native-async-storage/async-storage | 1.23.x (pin at setup) | Local stats/settings | Lightweight key-value
| Haptics | expo-haptics | SDK 54 | Feedback | Quick, optional polish
| Sound | expo-av | SDK 54 | Audio cues | Lightweight sounds
| Testing (unit) | jest + ts-jest | 29.x | Game engine tests | Standard RN testing
| Testing (integration) | @testing-library/react-native | 13.x | UI flow smoke | Validates core flows

Note: Exact pins for navigation/storage/testing libs will be finalized against Expo SDK 54 compatibility during dependency install; the PRD requires Unit + Integration testing coverage.
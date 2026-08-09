# Lycoris Mobile

The React Native client for Lycoris, built around the same core information architecture as the web app.

The current version includes:

- Three bottom tabs: `Map`, `Guides`, and `Me`
- Core authentication via `/api/login`, `/api/me`, and `/api/logout`
- Map v1: `react-native-webview + Leaflet` (OSM / Thunderforest / Tianditu), category filters, nearby search, and favorites
- An in-app, offline Markdown guide reader

## Project structure

```text
src/
  auth/AuthProvider.tsx
  components/PageBackground.tsx
  config/runtime.ts
  lib/http.ts
  screens/
    DocsScreen.tsx
    MapScreen.tsx
    MeScreen.tsx
  theme/colors.ts
  types/
```

## Run the app

1. Start Metro.

```sh
npm start
```

2. Run Android.

```sh
npm run android
```

3. Run iOS.

```sh
npm run ios
```

## API configuration

`src/config/runtime.ts` uses the following rules:

- In development (`__DEV__ = true`), the default is `http://10.0.2.2:8080`, which lets an Android emulator reach a backend running on the host machine.
- The production default is `https://api.lycoris.online`.
- `LY_THUNDERFOREST_API_KEY` and `LY_TIANDITU_API_KEY` have no built-in defaults and remain empty unless injected.

### Secure Android configuration (recommended)

1. Copy the template.

```sh
cp .env.mobile.example .env.mobile
```

2. Add your values to `mobile/.env.mobile`.

```env
LY_API_BASE_URL=http://10.0.2.2:8080
LY_THUNDERFOREST_API_KEY=your_thunderforest_key
LY_TIANDITU_API_KEY=your_tianditu_key
```

3. Reinstall the app.

```sh
npm run android
```

Precedence, from highest to lowest:

1. `globalThis.LY_*` (temporary debugging only)
2. Android `BuildConfig` values injected through `-PLY_*`, system environment variables, or `.env.mobile`
3. Defaults (`API_BASE_URL` only; map API keys default to empty)

## Android release signing

1. Generate a release keystore (example).

```sh
cd android
mkdir -p keystore
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore keystore/lycoris-upload.jks \
  -alias lycoris-upload \
  -keyalg RSA -keysize 2048 -validity 36500
```

2. Copy and complete the signing configuration.

```sh
cp keystore.properties.example keystore.properties
```

3. Build the release APK.

```sh
./gradlew assembleRelease
```

Output:

`android/app/build/outputs/apk/release/app-release.apk`

## Suggested next steps

1. Continue refining place creation and editing.
2. Expand the offline guide library.
3. Add more account and profile settings.

# Lycoris 🌸

[简体中文](./README.md) | [English](./README.en.md)

**Lycoris** is a platform offering **accessible facility information** and **community support information** for **transgender people**. 💗

The project currently includes these pages:

- Map: the **core of Lycoris**, where people can share accessible restrooms, trans-friendly clinics, baby care rooms, and other places.
- Documents: currently featuring **Nora's HRT Guide**, written to share practical HRT experience and lessons learned in clear, approachable language.
- About: the project's values, background, and contact details, explaining why we built this small light for our community.

Lycoris is available as a **web application** and a **React Native mobile application**.

## Android APK download

[Download the Lycoris 1.0.3 Android test APK](https://github.com/Eleanor1018/lycoris/releases/download/android-20260906/Lycoris-production-20260906.apk) · [SHA-256 checksum file](https://github.com/Eleanor1018/lycoris/releases/download/android-20260906/Lycoris-production-20260906.apk.sha256) · [Release notes](https://github.com/Eleanor1018/lycoris/releases/tag/android-20260906)

This test build is **Lycoris 1.0.3 (versionCode 2)** for **Android 7.0 and later**, with `arm64-v8a` and `x86_64` support. It uses a new release signing key and is intended for sideloading on devices.

**This APK cannot be installed over the old v1.0 or earlier development builds. Uninstall the old app first; uninstalling removes local sign-in state, settings, and other app data.**

JavaScript and document assets are bundled, so **Metro is not required**. The APK connects to the production API at `https://api.lycoris.online`; online features such as maps and accounts require a network connection.

## Built-in map features

- Places: share accessible restrooms, friendly clinics, baby care rooms, and other places with names, photos, opening hours, and more.
- Nearby search: find accessible restrooms and other places within 0–10,000 meters of your location.
- Favorites: save places to a personal list for easy access later.

**New places and edits require administrator review to help prevent malicious changes. Thank you for understanding.**

## Our values

**Care and expertise can make everyday life safer for transgender people. Shared information can help us light the way for one another.**

Every transgender person deserves to live openly and confidently, without hiding who they are. Equal rights belong to everyone, including transgender people.

Social progress can be slow, but every small effort matters. We are starting with accessible restrooms.

We want people to open their phones and find a restroom they can use, reducing misunderstanding and uncomfortable encounters so that going out feels less daunting.

**You are not alone.** Whether you are exploring, struggling, or rebuilding your life, you deserve respect and to be taken seriously. When you need it, we hope to offer something practical that helps you feel safer and face less harm in the real world.

If this small light helps someone through a difficult night, everything we have done will have been worthwhile.

## Technology

- `frontend`: React and TypeScript
- `backend`: Spring Boot and Java
- `mobile`: React Native and TypeScript, with Android / iOS native bridges
- Database: PostgreSQL, with optional PostGIS

## License

This project is open source under the [MIT License](./LICENSE).

## Clone and initialize

This is a monorepo: `backend`, `frontend`, and `mobile` are all in the same repository.

### 1. Prerequisites and source code

| Component | Repository requirements |
| --- | --- |
| JavaScript | Node.js 22, at least 22.12.0, or Node.js 20, at least 20.19.4, with npm. These satisfy both Vite 7 and React Native 0.83.1. |
| Backend | JDK 21 with `JAVA_HOME` configured. The Maven Wrapper downloads Maven 3.9.12 and project dependencies; a separate Maven installation is unnecessary. |
| Database | PostgreSQL and the `psql` CLI; the examples use a database named `lycoris`. PostGIS is optional: current nearby queries use ordinary coordinate columns and SQL distance calculations. |
| Cache and sessions | Redis, installed locally or started with the Docker example below. The current Spring Boot configuration automatically enables Redis sessions, so Redis is also required for this development setup. |
| Android | Android Studio, Android SDK Platform 36, Build-Tools 36.0.0, NDK 27.1.12297006, and an emulator or an Android device with USB debugging enabled. |
| iOS | macOS, full Xcode, Ruby/Bundler, and CocoaPods. See the [iOS guide](./mobile/IOS.md) for detailed requirements. |

The examples check out `feature/ui-redesign`, which contains the features described in this README:

```bash
git clone --branch feature/ui-redesign https://github.com/Eleanor1018/lycoris.git
cd lycoris
```

For an existing checkout, switch to that branch and update it. Install dependencies and configure each machine separately; do not copy `node_modules` from another computer.

```bash
git switch feature/ui-redesign
git pull
```

Start each section below from the repository root. Keep the backend, web server, and Metro running in separate terminals.

### 2. Backend: database, configuration, and dependencies

Start PostgreSQL and create a local development database using an account with permission to create databases. This example uses the local `postgres` account; enter your own database password when prompted:

```bash
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE lycoris;"
```

Skip this command if the database already exists. To use PostGIS, first install the extension package matching your PostgreSQL installation, then run the following with an authorized database account. Current map queries do not require the extension:

```bash
psql -h localhost -U postgres -d lycoris -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Use a local Redis service, or start a development container bound only to the local interface:

```bash
docker run --name lycoris-redis -p 127.0.0.1:6379:6379 -d redis:7-alpine
```

If the container already exists, use `docker start lycoris-redis` next time. Prepare the backend configuration:

```bash
cd backend
cp .env.example .env
```

Edit `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` in `backend/.env` for your development database, and check `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`. Replace the template password with your own.

- Set the template's `SPRING_SESSION_STORE_TYPE` to `redis` and keep Redis reachable. The current Spring Boot 3.5 session auto-configuration does not treat this variable's `none` value as a disable switch.
- `MARKER_CACHE_REDIS_ENABLED` and `REGISTER_RATE_LIMIT_REDIS_ENABLED` control Redis use for place caching and registration rate limiting, respectively; they do not disable Redis sessions.
- For local HTTP development, keep `SERVER_SSL_ENABLED=false`, `SESSION_COOKIE_SECURE=false`, and `SESSION_COOKIE_SAME_SITE=lax`, with your local web origin allowed by CORS.

**Spring Boot and Maven do not automatically load `.env`.** These commands explicitly import it as a Java properties file. Use the template's `KEY=value` format without additional quotes around values. Operating-system environment variables can also provide these settings.

macOS / Linux:

```bash
./mvnw spring-boot:run '-Dspring-boot.run.arguments=--spring.config.import=optional:file:.env[.properties]'
```

Windows PowerShell:

```powershell
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.arguments=--spring.config.import=optional:file:.env[.properties]'
```

The first run downloads the backend dependencies. The default address is `http://localhost:8080`. Open `http://localhost:8080/api/markers/public` to check for a JSON response; an empty list is normal for a new development database.

These commands use the default `application.yml`. The repository also provides an optional `application-local.yml`; append `'-Dspring-boot.run.profiles=local'` to the startup command when you want its local rate-limit and related settings.

The current `ddl-auto=update` setting creates entity tables in an **empty development database**. Before upgrading an existing database, back it up and stop the old backend. Then follow the [database migration guide](./backend/deploy/migrations/README.md), checking `2026-09-05-bugfix-versions.sql` before `2026-09-06-marker-translations.sql`. These scripts alter existing tables and are not an empty-database schema installer. Check production constraints, foreign keys, and indexes separately as described in the migration guide.

Run `./mvnw verify` from `backend/` to check and package the backend, or `.\mvnw.cmd verify` on Windows. The repository's `docker-compose.local.yml` defines only the backend and Redis; PostgreSQL must already be running on the host. It does not initialize the entire database environment.

### 3. Web: install dependencies and start Vite

In a new terminal, start from the repository root:

```bash
cd frontend
npm ci
cp .env.example .env.local
```

Edit `frontend/.env.local`, keeping `VITE_API_BASE_URL=` empty for local development. Clear unused placeholder map keys, including `VITE_THUNDERFOREST_API_KEY` and `VITE_TIANDITU_API_KEY`, to use OSM.

```bash
npm run dev
```

Open the address printed in the terminal, normally `http://localhost:5173`. Vite proxies `/api` and `/uploads` to `http://localhost:8080`. To change the proxy target, set `VITE_BACKEND_URL` in the **environment of the process that starts Vite**. If the configured local certificate and key files exist, Vite automatically uses HTTPS; follow the address printed in the terminal.

Build and lint:

```bash
npm run build
npm run lint
```

Static output is written to `frontend/dist/`. For static deployment, set `VITE_API_BASE_URL` to the intended API origin; the development proxy is not included in the static output.

### 4. Mobile: install dependencies and run Android / iOS

In a new terminal, install the mobile application's locked JavaScript dependencies from the repository root:

```bash
cd mobile
npm ci
```

**Android:** Install the SDK/NDK versions listed above through Android Studio's SDK Manager. Configure `ANDROID_HOME` or `sdk.dir` in your local `android/local.properties`, then start an emulator or connect a debugging device.

```bash
cp .env.mobile.example .env.mobile
```

Edit `mobile/.env.mobile`. An Android emulator can reach a backend on your computer with `LY_API_BASE_URL=http://10.0.2.2:8080`; a physical device needs the computer's reachable LAN address. Leave unused map keys empty. This configuration is compiled into the native application, so reinstall the application after changing it.

Start Metro from `mobile/`:

```bash
npm start
```

In another terminal, also in `mobile/`, install and run the Android application:

```bash
npm run android
```

**iOS (macOS only):** Run `npm ci` again on the Mac, install full Xcode and Ruby/Bundler, then install the dependencies defined by the repository's Gemfile and Podfile:

```bash
bundle install
cd ios
bundle exec pod install
cd ..
npm start
```

In another terminal, run `npm run ios` from `mobile/`. The iOS development build derives the backend host from Metro and uses port 8080 by default. Configure custom Debug/Release addresses through `ios/RuntimeConfig.local.json`; iOS does not read Android's `.env.mobile`. See [mobile/IOS.md](./mobile/IOS.md) for Xcode, simulators, device networking, permissions, signing, and Archive instructions.

Mobile checks:

```bash
npm test -- --runInBand
npx tsc --noEmit
npm run lint
```

See [mobile/README.md](./mobile/README.md) for more mobile configuration details. Local development is separate from installing the test APK above. Future updates should retain this release's package identifier and signing key.

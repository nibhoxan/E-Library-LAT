# Reading Room

A shared public-domain catalog with a Node/Express API, PostgreSQL database, React website, and Expo Android client. The website and phone use the same API for sessions, downloads, shelves, bookmarks, and librarian actions.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design, database structure and AI librarian architecture.

## Requirements

- Node.js 20 or newer
- npm
- Android Studio and an Android emulator for the phone app

## Run the API and website

From this folder:

```sh
npm install
npm run dev
```

The website is served by Vite (normally at `http://localhost:5173`) and proxies `/api` to the Express API at `http://localhost:4100`. The API creates its tables (`server/src/data/schema.ts`, which must match `server/prisma/schema.prisma`) and seeds data before listening, so its health endpoint only succeeds after database setup completes.

Start a local Postgres first with `docker compose up -d db`. Server settings (including `DATABASE_URL`) are copied from `server/.env.example` to `server/.env`. Set a private `JWT_SECRET` before deploying outside local development.

Local development demo accounts:

- Reader: `reader@readingroom.local` / `Reader123!`
- Desk: `desk@readingroom.local` / `Desk123!`

These accounts are not created in production. The built-in public-domain catalog is seeded on first startup. Startup skips book insertion when 200 or more titles already exist. Existing downloads and shelf records are not cleared.

## Run the production container

Docker Compose builds the React site and Express API into one service. Express serves the built site and its `/api` routes from the same origin. Postgres runs as a second service with its data in a named volume.

Create a root `.env` file (it is ignored by Git) and add a random `JWT_SECRET` of at least 32 characters. To provision the initial desk account, also set `INITIAL_DESK_EMAIL` and a random `INITIAL_DESK_PASSWORD` of at least 16 characters. Keep those values private.

Build and run:

```sh
docker compose up --build
```

Open `http://localhost:4100`. The database is stored in the `reading-room-data` volume and survives `docker compose down`; do not use `docker compose down -v` unless you intend to delete that data. New readers can register from the Account screen. The demo accounts are only available in local development.

## Deploy to Wasmer Edge

`app.yaml` deploys the whole app (website and API) to Wasmer Edge with a managed Postgres database. Wasmer's Node.js support is in beta, so check the deploy logs on the first run.

1. Install the Wasmer CLI and run `wasmer login`.
2. In the Wasmer dashboard, set `JWT_SECRET` to a random value of at least 32 characters. Optionally set `INITIAL_DESK_EMAIL` and `INITIAL_DESK_PASSWORD` (16+ characters), and remove them after the first successful start.
3. From this folder, run `wasmer deploy --build-remote`. Wasmer builds the Node.js app on its servers, because the repo has no `wasmer.toml`. Wasmer provisions the Postgres database on the first deployment and injects `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME` and `DB_PASSWORD`. The server builds its `DATABASE_URL` from those.
4. Open the app URL and check `/api/health`.

The managed database is only offered in the `fr-roub1` region, so the app is pinned to it.

## Phone app

Install the isolated Expo dependencies, then launch Metro:

```sh
npm run phone:install
npm run phone:dev
```

Open the project in an Android emulator or on a phone. The app talks to the deployed server (`https://reading-room-lat.wasmer.app`) by default. To use a local API from the Android emulator, open the Account screen, enter `http://10.0.2.2:4100` (the emulator's address for your computer) and save, or start Metro with `EXPO_PUBLIC_API_URL=http://10.0.2.2:4100`.

Type-check the app and create its Android JavaScript bundle with:

```sh
npm run phone:build
```

### Build an installable APK

The `phone/android` folder is a ready Android project. With Android Studio installed (it provides the Android SDK and Java), run:

```sh
npm run phone:install
cd phone/android
./gradlew assembleRelease        # on Windows: gradlew.bat assembleRelease
```

The file is created at `phone/android/app/build/outputs/apk/release/app-release.apk`. Copy it to an Android phone and open it to install (allow installs from unknown sources when asked). This release build is signed with the debug key, which is fine for demos and testing but not for the Play Store.

## Product notes

- Download actions create an original PDF bibliographic card; they do not return book text. A Project Gutenberg link is included only for catalog records with a known ebook ID.
- Guests may download cards for five distinct titles per IP address. Signed-in readers may download ten distinct titles; downloading a title again does not use another slot.
- Shelf changes and bookmarks require a reader account and are stored by the API, so they sync across clients.
- The librarian searches live catalog records. A shelf addition remains pending until the reader presses **Confirm**.
- Desk accounts can create, edit, and delete catalog records and view catalog/account/download counts and recent downloads. Database relations protect records referenced by download or shelf history.

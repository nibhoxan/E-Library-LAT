# Reading Room

A shared public-domain catalog with a Node/Express API, SQLite database, React website, and Expo Android client. The website and phone use the same API for sessions, downloads, shelves, bookmarks, and librarian actions.

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

The website is served by Vite (normally at `http://localhost:5173`) and proxies `/api` to the Express API at `http://localhost:4100`. The API prepares the SQLite schema and seed data before listening, so its health endpoint only succeeds after database setup completes.

The default SQLite file is `server/reading-room.db`. Optional server settings can be copied from `server/.env.example` to `server/.env`. Set a private `JWT_SECRET` before deploying outside local development.

Local development demo accounts:

- Reader: `reader@readingroom.local` / `Reader123!`
- Desk: `desk@readingroom.local` / `Desk123!`

These accounts are not created in production. The built-in public-domain catalog is seeded on first startup. Startup skips book insertion when 200 or more titles already exist. Existing downloads and shelf records are not cleared.

## Run the production container

Docker Compose builds the React site and Express API into one service. Express serves the built site and its `/api` routes from the same origin. SQLite is stored in a named volume.

Create a root `.env` file (it is ignored by Git) and add a random `JWT_SECRET` of at least 32 characters. To provision the initial desk account, also set `INITIAL_DESK_EMAIL` and a random `INITIAL_DESK_PASSWORD` of at least 16 characters. Keep those values private.

Build and run:

```sh
docker compose up --build
```

Open `http://localhost:4100`. The database is stored in the `reading-room-data` volume and survives `docker compose down`; do not use `docker compose down -v` unless you intend to delete that data. New readers can register from the Account screen. The demo accounts are only available in local development.

## Deploy the full stack from GitHub with Railway

1. Commit and push the project to GitHub. Railway builds the root `Dockerfile`; Docker Desktop is not required on your computer.
2. In Railway, create a project and deploy from the GitHub repository. Select the repository and `main` branch.
3. Add a volume to the service and set its mount path to `/data`.
4. Set service variables:
   - `DATABASE_URL=file:/data/reading-room.sqlite`
   - `JWT_SECRET` to a long, random secret
   - Optionally set `INITIAL_DESK_EMAIL` and `INITIAL_DESK_PASSWORD` to create the initial desk account; remove these variables after the first successful startup.
5. Set the healthcheck path to `/api/health`, then generate a public domain for the service.
6. Keep the service to one replica while using SQLite. The volume persists user/library data, but the app should be backed up regularly.

The Wasmer files (`app.yaml`, `Staticfile`, and `wasmer.toml`) configure a separate static frontend deployment; they do not deploy the Express API or database.

## Phone app

Install the isolated Expo dependencies, then launch Metro:

```sh
npm run phone:install
npm run phone:dev
```

Open the project in Expo Go or an Android emulator. The default API address is `http://10.0.2.2:4100`, which reaches the host computer from the Android emulator. On the Account screen, enter and save another full API base URL to point the app at a different server.

Type-check the app and create its Android JavaScript bundle with:

```sh
npm run phone:build
```

## Product notes

- Download actions create an original PDF bibliographic card; they do not return book text. A Project Gutenberg link is included only for catalog records with a known ebook ID.
- Guests may download cards for five distinct titles per IP address. Signed-in readers may download ten distinct titles; downloading a title again does not use another slot.
- Shelf changes and bookmarks require a reader account and are stored by the API, so they sync across clients.
- The librarian searches live catalog records. A shelf addition remains pending until the reader presses **Confirm**.
- Desk accounts can create, edit, and delete catalog records and view catalog/account/download counts and recent downloads. Database relations protect records referenced by download or shelf history.

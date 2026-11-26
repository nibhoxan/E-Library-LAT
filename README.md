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

The website is served by Vite (normally at `http://localhost:5173`) and proxies `/api` to the Express API at `http://localhost:4100`. The API opens its port before it pushes the SQLite schema and seeds the database, so the website can keep retrying while setup completes.

The default SQLite file is `server/reading-room.db`. Optional server settings can be copied from `server/.env.example` to `server/.env`. Set a private `JWT_SECRET` before deploying outside local development.

Demo accounts:

- Reader: `reader@readingroom.local` / `Reader123!`
- Desk: `desk@readingroom.local` / `Desk123!`

The built-in public-domain catalog is seeded on first startup. Startup skips book insertion when 200 or more titles already exist. Existing downloads and shelf records are not cleared.

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

# Expense Tracker (React + Firebase)

Single-page app for split expenses with rooms, built with Vite. Auth + Firestore, deployable to GitHub Pages.

## Setup

1. Create a Firebase project and enable:
   - Authentication: Email/Password
   - Firestore Database

2. Create a `.env` in the project root with your Firebase config (see `.env.example`).

3. Install and run:

```pwsh
npm install
npm run dev
```

Open http://localhost:5173/

## Features

- Email/password auth, reset
- Create/join room with short code
- Real-time members and transactions
- Auto-split amounts, balances view
- Filter by date
- Export CSV/PDF
- Hash routing (GitHub Pages friendly)

## Deployment (GitHub Pages)

1. Push to a GitHub repo. In `package.json` we use `gh-pages`.
2. Build and publish:

```pwsh
npm run deploy
```

The site is served under `https://<user>.github.io/<repo>/`.

Notes:
- HashRouter is used, no server config required.
- `vite.config.js` sets `base: './'` for relative assets.

## Key Snippets

- Auth usage:
```js
const { user, signIn, signUp, signOut, reset } = useAuth()
```

- Firestore streams:
```js
const unsub = onTransactions(roomId, setTxs)
```

- CSV/PDF: see `DashboardPage.jsx` (PapaParse + jsPDF)
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

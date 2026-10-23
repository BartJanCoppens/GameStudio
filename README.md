# Game Studio

Gamified learning platform for Meridian Tax Advisors: players play games grounded in a Content Domain (OKF bundles + background documents), game creators design them in an AI-assisted Studio and move them through Dev → Test → Review → Published, game administrators add live content per game, and platform admins manage users, roles and domains.

Implemented from the Claude Design prototype `Game Studio.dc.html` (project "Game Studio Platform Design") with the TaxConnect design system. All data is in-memory sample data; nothing persists and there is no backend yet.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
```

Deep links (the prototype's `defaultRole` / `defaultScreen`): `?role=player|creator|gameadmin|admin`, `?screen=blank|studio|workflow`.

## Layout

| Path | What |
|---|---|
| `src/ds/` | TaxConnect design system: tokens (copied verbatim) and the components Game Studio uses, ported from `_ds_bundle.js` with values unchanged |
| `src/data/` | Sample data lifted from the prototype, typed |
| `src/app/` | App state (`AppProvider`) and the `useApp()` hook — one state object, as in the prototype |
| `src/shell/` | Sidebar, header with the "View as" role switcher, shared layout bits |
| `src/screens/{player,creator,gameadmin,admin}/` | One file per prototype screen (12) |

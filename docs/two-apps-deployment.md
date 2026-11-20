# RentWell: two apps, one repo, two Vercel projects

The renter app and the property-manager app live in this repository and share the
code in `src/`. Each is deployed as its own Vercel project with its own URL.

|                  | Renter app                           | Manager app                                             |
| ---------------- | ------------------------------------ | ------------------------------------------------------- |
| Entry page       | `index.html` → `src/main.tsx`        | `manager.html` → `src/manager/main.tsx`                 |
| Vite config      | `vite.config.ts`                     | `vite.manager.config.ts`                                |
| Build command    | `pnpm build`                         | `pnpm build:manager`                                    |
| Output directory | `dist`                               | `dist-manager`                                          |
| Local dev        | `pnpm dev` → http://localhost:5173   | `pnpm dev:manager` → http://localhost:5174/manager.html |
| Env var          | `VITE_MANAGER_URL` = manager app URL | `VITE_RENTER_URL` = renter app URL                      |

Flow: a renter clicks **For property managers** in the header, which opens the manager
app in a new tab. The manager sees a sign-in page, chooses **Start free pilot** or
**Request a demo**, then enters the dashboard.

## Demo sign-in

- Email: `manager@rentwell.demo`
- Password: `RentWell-Demo-2026`

The sign-in page also has a **Fill demo credentials** button. This is a client-side demo
gate only: it protects nothing, there are no real accounts, and the credentials are
visible on the page on purpose. Real authentication is a post-DevDay roadmap item.

The pilot choice is also demo-only and stored in that browser. No payment is collected,
and subscription pricing has not been finalized.

Edits made in the manager app are held in browser memory and are **not** shared with the
renter app (they are different sites). Do not describe it as live sync.

## Create the second Vercel project (one time)

1. Vercel dashboard → **Add New… → Project** → import the same GitHub repo again.
2. Name it `rentwell-manager`.
3. Framework Preset: **Vite**. Root Directory: `./`.
4. Open **Build and Output Settings** and override:
   - Build Command: `pnpm build:manager`
   - Output Directory: `dist-manager`
5. Deploy. Production Branch stays `main`; the `dev` branch gets preview URLs as usual.

## Connect the two apps

Vite bakes `VITE_` variables in at build time, so redeploy after setting them.

1. On the **renter** project: Settings → Environment Variables → add `VITE_MANAGER_URL`
   = the manager project's URL (for example `https://rentwell-manager.vercel.app`). Apply to
   Production and Preview. Redeploy.
2. On the **manager** project: add `VITE_RENTER_URL` = the renter project's URL. Redeploy.

For `dev` previews, each project gives the `dev` branch its own stable alias
(`<project>-git-dev-<team>.vercel.app`). Set Preview-only values to those aliases so the
two `dev` sites link to each other.

If `VITE_MANAGER_URL` is not set, the **For property managers** button falls back to
`http://localhost:5174/manager.html` in local dev and to `https://rentwell-manager.vercel.app`
in a deployed build. Set the variable on any preview you want to point at a specific manager
deployment.

## Checks before you push

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm build:manager
```

`pnpm build:manager` should end with `dist-manager/index.html is ready.`

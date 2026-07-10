# TrainerPad — setup & user guide

TrainerPad is a client-management app for personal trainers. It is one single file (`TrainerPad.html`), it runs entirely on your iPad, and every piece of client data stays on your device — nothing is sent to any server.

## Getting it onto your iPad (one-time, ~5 minutes)

The best experience is to put the file on the web once, then install it like a native app:

1. Upload `TrainerPad.html` to any free static host. Easy options: **Netlify Drop** (drag the file onto drop.netlify.com), **GitHub Pages**, or **tiiny.host**. You'll get a private-ish URL like `https://your-name.netlify.app/TrainerPad.html`.
2. On the iPad, open that URL in **Safari**.
3. Tap the **Share** button → **Add to Home Screen**.
4. A "TrainerPad" icon appears on your home screen. Launch it from there — it opens full-screen like a real app, and iPadOS protects its stored data.

Even though the file is hosted, your data is **not** on the web — the page is just the app itself. Everything you type is stored in the iPad's own browser database.

Why not just open the file from the Files app? iPadOS opens HTML files in a limited preview mode where saving data isn't reliable. The home-screen route above is the dependable one.

## First steps

Open **Settings → Load sample data** to explore with two demo clients (you can delete them any time), or jump straight in with **Clients → New client**.

## What it does

**Clients** — profile, goal, contact info, photo, and injury flags. Injuries you tag (knee, shoulder, lower back, …) follow the client everywhere: any exercise that stresses that area gets a ⚠️ and a suggested safer swap.

**Plan tab** — for each exercise in a client's recent history, the app suggests next session's sets, reps and weight, with a plain-English reason. The rules are standard coaching heuristics applied to that client's own logs: double progression (fill the goal rep range, then add ~2.5% upper / ~5% lower body), an automatic ~10% deload when average RPE hits 9.5+, and rep-ceiling triggers that advance bodyweight moves up their progression chain (e.g. incline push-up → push-up → DB bench). Suggestions are a starting point for your judgment, not a replacement for it.

**Sessions** — log workouts fast: suggested numbers are pre-filled, "last time" is shown for every exercise, and RPE per set is optional but makes recommendations smarter.

**Progress** — charts for weight, muscle mass, and body-fat % from InBody entries, plus an estimated-1RM strength trend per exercise.

**Assessments** — enter InBody results (weight, SMM, body fat %, BMI, visceral fat, BMR) from the printout, attach a photo of the sheet, and log fitness tests (push-ups, plank, resting HR, …).

**Exercises** — the built-in library is organized into progression/regression chains by movement pattern. Add your own exercises, with their own injury cautions, and they join the chains.

## Backups — please read this bit

All data lives in Safari's storage on the iPad. That's private and fast, but it means: **if the iPad is lost, reset, or Safari's data is cleared, the data is gone.** Protect yourself:

- **Settings → Export backup**, weekly. Save the file to iCloud Drive when Safari asks.
- **Settings → Restore from backup** brings everything back on any device.
- Always launch from the Home Screen icon — iPadOS treats home-screen web apps' storage as protected.

## Units

Settings → Units switches between lb and kg (it changes labels and increment sizes; it doesn't convert already-entered numbers).

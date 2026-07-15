# TrainerPad — setup & user guide

TrainerPad is a client-management app for personal trainers. It runs entirely on your iPad, and every piece of client data stays on your device — nothing is sent to any server. The app lives at [bradleypallen.github.io/trainerpad](https://bradleypallen.github.io/trainerpad/); that page is just the app itself, and everything you type is stored in the iPad's own browser database.

## Getting it onto your iPad (one-time, ~1 minute)

1. On the iPad, open **https://bradleypallen.github.io/trainerpad/** in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. A "TrainerPad" icon appears on your home screen. Launch it from there — it opens full-screen like a real app, and iPadOS protects its stored data.

Always launch from the Home Screen icon rather than a Safari tab — iPadOS treats home-screen web apps' storage as protected.

## First steps

Open **Settings → Load sample data** to explore with two demo clients (you can delete them any time), or jump straight in with **Clients → New client**.

## What it does

**Clients** — profile, goal, contact info, photo, and injury flags. Injuries you tag (knee, shoulder, lower back, …) follow the client everywhere: any exercise that stresses that area gets a ⚠️ and a suggested safer swap. You can also set an optional **OPT training phase** (Stabilization Endurance through Power); when set, recommendations use the phase's rep range instead of the goal's — and say so in their reasoning.

**Plan tab** — for each exercise in a client's recent history, the app suggests next session's sets, reps and weight, with a plain-English reason. The rules are standard coaching heuristics applied to that client's own logs: double progression (fill the goal rep range, then add ~2.5% upper / ~5% lower body), an automatic ~10% deload when average RPE hits 9.5+, and rep-ceiling triggers that advance bodyweight moves up their progression chain (e.g. incline push-up → push-up → DB bench). Suggestions are a starting point for your judgment, not a replacement for it. The Plan tab also suggests a **warm-up and cooldown** — dynamic stretches before and static stretches after, matched to the movement patterns being trained and filtered by the client's injury flags. Tap **Share card** to turn the plan into a homework-card image — warm-up, workout, cooldown and corrective focus on one picture — and AirDrop or text it via the share sheet.

**Sessions** — log workouts fast: suggested numbers are pre-filled, "last time" is shown for every exercise, and RPE per set is optional but makes recommendations smarter. If a client slept badly or is running on empty, tap **Low energy**: that day's suggestions drop about 10% of the load and one set, and the app remembers the light day so it never reads as regression later. The session editor's **Share** button makes a session-record card — a picture of the day's work the client can keep.

**Progress** — charts for weight, muscle mass, and body-fat % from InBody entries, plus an estimated-1RM strength trend per exercise.

**Assessments** — enter InBody results (weight, SMM, body fat %, BMI, visceral fat, BMR) from the printout, attach a photo of the sheet, and log fitness tests (push-ups, plank, resting HR, …). Skip the typing: photograph the printout, copy the text with iPadOS **Live Text**, paste it into the form's paste box, and tap **Fill fields** to extract the values. You can also record an **overhead squat assessment** — a quick movement screen: the client squats with arms overhead while you watch from the front, side and behind, tapping the compensations you see (knees caving in, heels rising, arms falling forward, …).

**Corrective** — each client's fifth tab turns their latest overhead squat screen into a corrective plan: for every compensation, which muscles are probably overactive (stretch or foam-roll them) and which are probably underactive (strengthen them), with the reasoning in plain English. Exercises that clash with the client's injury flags are skipped and noted. The Plan tab shows a one-line corrective reminder too.

**Nutrition** — a daily calorie target and protein/fat/carb split computed from the client's latest InBody scan, their goal, and an activity level you set with one tap. Every number comes with the reasoning in plain English (resting burn → daily burn → goal adjustment → macros), plus one generic example day using hand-portion language — an illustration, never a meal plan. This is general guidance for healthy adults, not medical or dietetic advice; refer out for medical conditions, disordered-eating history, or pregnancy.

**Exercises** — the built-in library is organized into progression/regression chains by movement pattern. Add your own exercises, with their own injury cautions, and they join the chains. Two curated accessory groups — **Accessories — upper** and **Accessories — lower** — cover isolation and movement-quality work (curls, raises, face pulls, rotator-cuff and scap work, hamstring and calf isolation); accessories never join a progression chain, but weighted ones still get double-progression coaching and e1RM charts.

## Backups — please read this bit

All data lives in Safari's storage on the iPad. That's private and fast, but it means: **if the iPad is lost, reset, or Safari's data is cleared, the data is gone.** Protect yourself:

- **Settings → Export backup**, weekly. Save the file to iCloud Drive when Safari asks.
- **Settings → Restore from backup** brings everything back on any device.
- Always launch from the Home Screen icon — iPadOS treats home-screen web apps' storage as protected.

## Units

Settings → Units switches between lb and kg (it changes labels and increment sizes; it doesn't convert already-entered numbers). **Settings → Trainer name** (optional) puts your name on shared workout cards.

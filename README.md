# George's AG Shifts

A shift schedule app for **George's AG Super Value** in Enfield, NH.
It's a PWA (a website you can install on your phone like an app).

**To put it online, follow [SETUP.md](SETUP.md).**

## What it does

- **Schedule**: week view (opens to today) or month view, showing who's working when.
  Swipe left or right to change weeks. Each person has their own color.
- **My shifts**: your next shift, hours this week, what's coming up, open shifts you can ask for, and your time off.
- **Requests**
  - Employees can ask to **change a shift's time**, **drop a shift**, take **time off**, or **pick up an open shift**. A manager approves or denies.
  - **Swaps**: you ask a coworker. If they accept, the schedule updates right away and managers get a heads-up.
- **Changes**: a feed of everything that changed, with a red badge for anything new.
- **Notifications**: phone alerts even when the app is closed. Each person picks "My shifts" or "All changes".
- **Sign-in**: email + password, Google, or **name + register PIN**. PIN sign-in locks for 15 minutes after 5 wrong tries, and a manager can unlock it early.
- **Managers** can add and edit shifts (with quick picks like Morning 8–3 and Evening 3–10), manage the team, and edit positions and quick picks.
  The app warns if someone has time off or is already working that day, but still lets you save.
- Follows the phone's light/dark mode, uses spring animations, and works offline once it's opened.

## How the code is organized

| Folder / file | What's in it |
|---|---|
| `src/screens/` | One file per screen (Schedule, My shifts, Requests, Changes, More, Login) |
| `src/components/` | Reusable pieces: the shelf-tag shift card, slide-up panels, tab bar, buttons |
| `src/lib/actions.js` | Everything that saves data |
| `src/hooks/data.jsx` | Live data from the cloud |
| `src/sw.js` | Background helper for offline use and notifications |
| `src/styles.css` | Colors, fonts and layout (light and dark mode) |
| `functions/src/index.js` | Server code: PIN sign-in, swaps, the change log, notifications |
| `firestore.rules` | Who can read and change what |

Built with React, Vite, Motion (animations) and Firebase (login, database, server, hosting).

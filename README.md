# time-tracker
Simple time tracking from Toggl to Google calendar

A Google Apps Script that syncs your [Toggl Track](https://toggl.com/track/) time entries directly into Google Calendar as writable events — with full history, project color-coding, deduplication, and automatic daily scheduling.

## Why this exists

Toggl’s built-in iCal export is read-only and limited to the past two weeks. This script uses the Toggl API v9 and Google Calendar API to push your entries as real, editable calendar events with no date limit.

## Features

- **Full history** — sync as many days back as you like (set `DAYS_TO_SYNC: 365` on first run)
- **Writable events** — events land in your Google Calendar with full read/write access
- **Deduplication** — safe to run repeatedly; existing entries are never duplicated
- **Project color-coding** — map Toggl project names to Google Calendar colors
- **Metadata** — billable status, tags, and Toggl entry ID stored in the event description
- **Automatic daily sync** — one-click trigger setup runs the sync every morning at 6 AM
- **Clean reset** — utility function to wipe all synced events and start fresh
- **No paid plan required** — works on Toggl Free, Starter, and Premium

## Project Structure
```
time-tracker/
├── CHANGELOG.md          Version history
├── Code.gs               Main sync script
├── LICENSE               MIT license
├── README.md             Setup guide and documentation
├── appsscript.json       OAuth scopes and runtime manifest
├── .gitignore            Excludes credentials and local overrides
└── .github/
    └── CONTRIBUTING.md   Contribution guidelines
```
​​​​​​​​​​​

## Prerequisites

- A [Google account](https://accounts.google.com) with Google Calendar
- A [Toggl Track account](https://toggl.com/track/) (any plan)
- Access to [Google Apps Script](https://script.google.com) (free, included with Google account)

## Setup

### Step 1 — Copy the script

1. Go to [script.google.com](https://script.google.com) and click **New project**
1. Delete the placeholder `function myFunction() {}` code
1. Paste the entire contents of `Code.gs` into the editor
1. Name the project (e.g. `toggl-to-gcal`)

### Step 2 — Set your credentials

**Recommended — Script Properties (credentials never touch your code):**

1. In the Apps Script editor, click **Project Settings** (gear icon)
1. Scroll to **Script Properties** and click **Add script property**
1. Add the following properties:

|Property            |Value                                                |
|--------------------|-----------------------------------------------------|
|`TOGGL_API_TOKEN`   |Your Toggl API token (see below)                     |
|`TOGGL_WORKSPACE_ID`|Your numeric Toggl workspace ID (see below)          |
|`GOOGLE_CALENDAR_ID`|Your calendar ID, or `primary` for your main calendar|

**Alternative — hardcode for local testing only:**

Fill in the fallback strings directly in the `CONFIG` block at the top of `Code.gs`.

> ⚠️ Never commit real credentials to version control.

### Step 3 — Find your values

**Toggl API token:**
`toggl.com` → click your avatar → **Profile Settings** → scroll to the bottom → copy the API token

**Workspace ID:**
Look at your browser URL when logged into Toggl: `https://track.toggl.com/projects/`**`12345678`** — the number is your workspace ID

**Google Calendar ID:**
`calendar.google.com` → Settings (gear) → click your calendar name → **Integrate calendar** → copy the Calendar ID.
Use `primary` for your default Google Calendar.

### Step 4 — Run the sync

1. In the Apps Script editor, select `syncTogglToCalendar` from the function dropdown
1. Click **Run** — Google will ask for permissions, click **Allow**
1. Open **View → Logs** to see a summary of what was created

> **First run tip:** Temporarily set `DAYS_TO_SYNC: 365` in CONFIG to import your full history, then set it back to `7` for ongoing daily syncs.

### Step 5 — Automate (optional)

Run the `createDailyTrigger` function once to schedule the sync every morning at 6 AM. It is safe to re-run — it removes any existing trigger before creating a new one.

> Alternatively, the Google Apps Script Triggers can also setup rerun schedule easily.

## Configuration reference

|Option              |Default                   |Description                                          |
|--------------------|--------------------------|-----------------------------------------------------|
|`TOGGL_API_TOKEN`   |*(from Script Properties)*|Your Toggl API token                                 |
|`TOGGL_WORKSPACE_ID`|*(from Script Properties)*|Your numeric Toggl workspace ID                      |
|`GOOGLE_CALENDAR_ID`|`"primary"`               |Google Calendar ID to write events to                |
|`DAYS_TO_SYNC`      |`7`                       |How many days back to sync per run                   |
|`PROJECT_COLORS`    |`{}`                      |Map of Toggl project name → color ID (1–11)          |
|`EVENT_PREFIX`      |`"TOGGL: "`               |Prefix added to all synced event titles              |
|`INCLUDE_METADATA`  |`true`                    |Include billable status and tags in event description|
|`DEDUPLICATE`       |`true`                    |Prevent duplicate events on repeated runs            |

## Project color-coding

Map your Toggl project names to Google Calendar colors in the `PROJECT_COLORS` config:

```js
PROJECT_COLORS: {
  "Client Work":  "6",   // Tangerine
  "Deep Work":    "9",   // Blueberry
  "Admin":        "8",   // Graphite
}
```

|ID|Color    |
|--|---------|
|1 |Lavender |
|2 |Sage     |
|3 |Grape    |
|4 |Flamingo |
|5 |Banana   |
|6 |Tangerine|
|7 |Peacock  |
|8 |Graphite |
|9 |Blueberry|
|10|Basil    |
|11|Tomato   |

## Utility functions

|Function                |Purpose                                      |
|------------------------|---------------------------------------------|
|`syncTogglToCalendar()` |Main sync — run this manually or via trigger |
|`createDailyTrigger()`  |Schedules automatic daily sync at 6 AM       |
|`deleteAllTogglEvents()`|Removes all synced events (clean slate reset)|

## Known limitations

- **Running entries are skipped** — entries without a stop time (currently tracking) are ignored and will sync on the next run once they are stopped
- **Google Apps Script rate limit** — the script has a 6-minute execution time limit per run; if you have thousands of historical entries, split your first import into multiple runs with smaller `DAYS_TO_SYNC` windows
- **Toggl API rate limit** — the `/me/time_entries` endpoint is limited to 30 requests/hour; the script makes one request per run plus one per unique project for color lookups
- **Calendar sync delay** — Google Calendar events appear immediately; there is no propagation delay as with the native iCal method

## License

MIT — see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

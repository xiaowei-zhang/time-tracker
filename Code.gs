// ============================================================
//  TOGGL TRACK → GOOGLE CALENDAR SYNC
//  Google Apps Script | Toggl API v9 | Full Read+Write
//  Compatible with: Toggl Free, Starter, Premium plans
//  No Pro upgrade required for personal time entry access
// ============================================================
//
//  SETUP INSTRUCTIONS (read before running):
//  1. Open https://script.google.com → New Project
//  2. Paste this entire file into the editor
//  3. Fill in CONFIG below (Toggl API token + Calendar ID), using one of the two options
//  4. Click Run → syncTogglToCalendar (grant permissions when prompted)
//  5. Optional: set a time-driven trigger for automatic daily sync
//
//  HOW TO FIND YOUR VALUES:
//  - Toggl API token: toggl.com/app/profile → bottom of page → "API Token"
//  - Google Calendar ID: calendar.google.com → Settings → your calendar
//    → "Integrate calendar" → Calendar ID (looks like xxx@group.calendar.google.com)
//    (Use "primary" for your main Google Calendar)
//  - Workspace ID: found in your Toggl URL, e.g. track.toggl.com/projects/XXXXXXX
// ============================================================

// ──────────────────────────────────────────────────────────────
//  CONFIG — Edit these values before running
// ──────────────────────────────────────────────────────────────
const scriptProps = PropertiesService.getScriptProperties();

const CONFIG = {
  // Option 1: Local testing with direct value inputs
  // TOGGL_API_TOKEN:  "YOUR_TOGGL_API_TOKEN_HERE",   // Required
  // TOGGL_WORKSPACE_ID: "YOUR_WORKSPACE_ID_HERE",    // Required (numeric ID)
  // GOOGLE_CALENDAR_ID: "primary",                   // "primary" or specific calendar ID

  // Option 2: Tell the code to pull the values from the Google Apps Script properties store
  TOGGL_API_TOKEN: scriptProps.getProperty("TOGGL_API_TOKEN"),
  TOGGL_WORKSPACE_ID: scriptProps.getProperty("TOGGL_WORKSPACE_ID"),
  GOOGLE_CALENDAR_ID: scriptProps.getProperty("GOOGLE_CALENDAR_ID"), // You can usually leave this as "primary" 

  // How many days back to sync on each run (default: 7 days)
  // Increase to 90 or 365 on your FIRST run for a full historical import
  DAYS_TO_SYNC: 7,

  // Color-code events by project in Google Calendar
  // Maps Toggl project names → Google Calendar color IDs (1–11)
  // See color reference at the bottom of this file
  // Leave empty {} to use default calendar color
  PROJECT_COLORS: {
    // "My Project Name": "2",   // Sage green
    // "Client Work":     "6",   // Tangerine
    // "Deep Work":       "9",   // Blueberry
  },

  // Prefix added to all synced event titles so you can identify them
  // e.g. "⏱ Writing blog post" — set to "" to disable
  EVENT_PREFIX: "⏱ ",

  // If true, adds billable status and tags to the event description
  INCLUDE_METADATA: true,

  // If true, prevents creating duplicate events if the script runs twice
  // Uses event Extended Properties to track Toggl entry IDs
  DEDUPLICATE: true,
};

// ──────────────────────────────────────────────────────────────
//  MAIN ENTRY POINT — Run this function
// ──────────────────────────────────────────────────────────────
function syncTogglToCalendar() {
  Logger.log("=== Toggl → Google Calendar Sync Started ===");

  validateConfig();

  const entries = fetchTogglEntries();
  if (!entries || entries.length === 0) {
    Logger.log("No time entries found for the selected date range.");
    return;
  }

  Logger.log(`Fetched ${entries.length} Toggl entries.`);

  const calendar = CalendarApp.getCalendarById(CONFIG.GOOGLE_CALENDAR_ID)
                || CalendarApp.getDefaultCalendar();

  if (!calendar) {
    throw new Error("Calendar not found. Check your GOOGLE_CALENDAR_ID in CONFIG.");
  }

  const existingTogglIds = CONFIG.DEDUPLICATE ? getExistingTogglEventIds(calendar) : new Set();

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  entries.forEach(entry => {
    try {
      // Skip running (incomplete) entries — they have no stop time
      if (!entry.stop) {
        Logger.log(`Skipping running entry: "${entry.description || '(no description)'}"`);
        skipped++;
        return;
      }

      const togglId = String(entry.id);

      if (CONFIG.DEDUPLICATE && existingTogglIds.has(togglId)) {
        Logger.log(`Skipping duplicate: ID ${togglId} already synced.`);
        skipped++;
        return;
      }

      createCalendarEvent(calendar, entry);
      created++;

    } catch (e) {
      Logger.log(`ERROR on entry ${entry.id}: ${e.message}`);
      errors++;
    }
  });

  Logger.log(`=== Sync Complete: ${created} created, ${skipped} skipped, ${errors} errors ===`);
}

// ──────────────────────────────────────────────────────────────
//  FETCH TIME ENTRIES FROM TOGGL API v9
// ──────────────────────────────────────────────────────────────
function fetchTogglEntries() {
  const now       = new Date();
  const startDate = new Date(now - CONFIG.DAYS_TO_SYNC * 24 * 60 * 60 * 1000);

  // Extract the date and append the required RFC3339 time components
  const startIso = `${startDate.toISOString().split("T")[0]}T00:00:00Z`;
  const endIso   = `${now.toISOString().split("T")[0]}T23:59:59Z`;


  // Example https://api.track.toggl.com/api/v9/me/time_entries?start_date=2026-04-01T00:00:00Z&end_date=2026-05-02T23:59:59Z
  const url = `https://api.track.toggl.com/api/v9/me/time_entries?start_date=${startIso}&end_date=${endIso}`;

  Logger.log(`Fetching Toggl entries from ${startIso} to ${endIso}`);

  const response = UrlFetchApp.fetch(url, {
    method: "GET",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": "Basic " + Utilities.base64Encode(CONFIG.TOGGL_API_TOKEN + ":api_token"),
    },
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code === 403) throw new Error("Toggl API: Invalid API token. Check CONFIG.TOGGL_API_TOKEN.");
  if (code !== 200) throw new Error(`Toggl API error: HTTP ${code} — ${response.getContentText()}`);

  return JSON.parse(response.getContentText());
}

// ──────────────────────────────────────────────────────────────
//  CREATE A GOOGLE CALENDAR EVENT FROM A TOGGL ENTRY
// ──────────────────────────────────────────────────────────────
function createCalendarEvent(calendar, entry) {
  const title       = buildEventTitle(entry);
  const description = buildEventDescription(entry);
  const startTime   = new Date(entry.start);
  const endTime     = new Date(entry.stop);

  // Safety check: ensure end is after start
  if (endTime <= startTime) {
    Logger.log(`Skipping entry ${entry.id}: end time is not after start time.`);
    return;
  }

  const event = calendar.createEvent(title, startTime, endTime, {
    description: description,
  });

  // Store Toggl entry ID in extended properties for deduplication
  if (CONFIG.DEDUPLICATE) {
    event.setTag("toggl_entry_id", String(entry.id));
  }

  // Apply project color if configured
  applyProjectColor(event, entry);

  Logger.log(`Created: "${title}" [${formatDuration(entry.duration)}]`);
}

// ──────────────────────────────────────────────────────────────
//  BUILD EVENT TITLE
// ──────────────────────────────────────────────────────────────
function buildEventTitle(entry) {
  const description = entry.description || "(no description)";
  return CONFIG.EVENT_PREFIX + description;
}

// ──────────────────────────────────────────────────────────────
//  BUILD EVENT DESCRIPTION WITH METADATA
// ──────────────────────────────────────────────────────────────
function buildEventDescription(entry) {
  const lines = [];

  lines.push(`Duration: ${formatDuration(entry.duration)}`);

  if (entry.project_id) {
    lines.push(`Project ID: ${entry.project_id}`);
  }

  if (CONFIG.INCLUDE_METADATA) {
    lines.push(`Billable: ${entry.billable ? "Yes" : "No"}`);

    if (entry.tags && entry.tags.length > 0) {
      lines.push(`Tags: ${entry.tags.join(", ")}`);
    }

    lines.push(`Toggl ID: ${entry.id}`);
    lines.push(`Workspace ID: ${entry.workspace_id}`);
  }

  lines.push("");
  lines.push("Synced from Toggl Track via Google Apps Script");

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────────
//  APPLY PROJECT COLOR TO EVENT
// ──────────────────────────────────────────────────────────────
function applyProjectColor(event, entry) {
  if (!entry.project_id) return;

  // Retrieve project name via Toggl API (cached to avoid rate limits)
  const projectName = getProjectName(entry.workspace_id, entry.project_id);
  if (!projectName) return;

  const colorId = CONFIG.PROJECT_COLORS[projectName];
  if (!colorId) return;

  // Google Calendar color IDs mapped to CalendarApp.EventColor enum
  const colorMap = {
    "1":  CalendarApp.EventColor.PALE_BLUE,
    "2":  CalendarApp.EventColor.PALE_GREEN,
    "3":  CalendarApp.EventColor.MAUVE,
    "4":  CalendarApp.EventColor.PALE_RED,
    "5":  CalendarApp.EventColor.YELLOW,
    "6":  CalendarApp.EventColor.ORANGE,
    "7":  CalendarApp.EventColor.CYAN,
    "8":  CalendarApp.EventColor.GRAY,
    "9":  CalendarApp.EventColor.BLUE,
    "10": CalendarApp.EventColor.GREEN,
    "11": CalendarApp.EventColor.RED,
  };

  const color = colorMap[colorId];
  if (color) event.setColor(color);
}

// ──────────────────────────────────────────────────────────────
//  FETCH PROJECT NAME FROM TOGGL (with in-memory cache)
// ──────────────────────────────────────────────────────────────
const _projectCache = {};

function getProjectName(workspaceId, projectId) {
  const cacheKey = `${workspaceId}_${projectId}`;
  if (_projectCache[cacheKey] !== undefined) return _projectCache[cacheKey];

  try {
    const url = `https://api.track.toggl.com/api/v9/workspaces/${workspaceId}/projects/${projectId}`;
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Basic " + Utilities.base64Encode(CONFIG.TOGGL_API_TOKEN + ":api_token"),
      },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() === 200) {
      const project = JSON.parse(response.getContentText());
      _projectCache[cacheKey] = project.name || null;
      return _projectCache[cacheKey];
    }
  } catch (e) {
    Logger.log(`Warning: could not fetch project ${projectId}: ${e.message}`);
  }

  _projectCache[cacheKey] = null;
  return null;
}

// ──────────────────────────────────────────────────────────────
//  GET EXISTING TOGGL ENTRY IDs FROM CALENDAR (for deduplication)
// ──────────────────────────────────────────────────────────────
function getExistingTogglEventIds(calendar) {
  const now       = new Date();
  const startDate = new Date(now - CONFIG.DAYS_TO_SYNC * 24 * 60 * 60 * 1000);
  const ids       = new Set();

  try {
    const events = calendar.getEvents(startDate, now);
    events.forEach(event => {
      const tag = event.getTag("toggl_entry_id");
      if (tag) ids.add(tag);
    });
  } catch (e) {
    Logger.log(`Warning: could not check for duplicates: ${e.message}`);
  }

  Logger.log(`Found ${ids.size} already-synced Toggl events in calendar.`);
  return ids;
}

// ──────────────────────────────────────────────────────────────
//  UTILITY: FORMAT DURATION (seconds → "Xh Ym")
// ──────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ──────────────────────────────────────────────────────────────
//  VALIDATE CONFIG BEFORE RUNNING
// ──────────────────────────────────────────────────────────────
function validateConfig() {
  if (!CONFIG.TOGGL_API_TOKEN || CONFIG.TOGGL_API_TOKEN === "YOUR_TOGGL_API_TOKEN_HERE") {
    throw new Error("CONFIG.TOGGL_API_TOKEN is not set. Add your Toggl API token.");
  }
  if (!CONFIG.TOGGL_WORKSPACE_ID || CONFIG.TOGGL_WORKSPACE_ID === "YOUR_WORKSPACE_ID_HERE") {
    throw new Error("CONFIG.TOGGL_WORKSPACE_ID is not set. Add your Toggl workspace ID.");
  }
  Logger.log("Config validated ✓");
}

// ──────────────────────────────────────────────────────────────
//  OPTIONAL: DELETE ALL SYNCED TOGGL EVENTS (clean slate reset)
//  Run this function manually if you want to wipe synced events
//  and start fresh. USE WITH CAUTION.
// ──────────────────────────────────────────────────────────────
function deleteAllTogglEvents() {
  const calendar  = CalendarApp.getCalendarById(CONFIG.GOOGLE_CALENDAR_ID)
                 || CalendarApp.getDefaultCalendar();
  const now       = new Date();
  const startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); // past year
  const events    = calendar.getEvents(startDate, now);
  let deleted     = 0;

  events.forEach(event => {
    if (event.getTag("toggl_entry_id")) {
      event.deleteEvent();
      deleted++;
    }
  });

  Logger.log(`Deleted ${deleted} Toggl-synced events from calendar.`);
}

// ──────────────────────────────────────────────────────────────
//  OPTIONAL: SET UP AUTOMATIC DAILY TRIGGER
//  Run this function once to schedule automatic daily syncing
// ──────────────────────────────────────────────────────────────
function createDailyTrigger() {
  // Remove existing triggers for this function to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === "syncTogglToCalendar") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new daily trigger at 6:00 AM
  ScriptApp.newTrigger("syncTogglToCalendar")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log("Daily trigger set for 6:00 AM ✓");
}

// ──────────────────────────────────────────────────────────────
//  GOOGLE CALENDAR COLOR ID REFERENCE
// ──────────────────────────────────────────────────────────────
//  "1"  → Lavender (Pale Blue)
//  "2"  → Sage (Pale Green)
//  "3"  → Grape (Mauve)
//  "4"  → Flamingo (Pale Red)
//  "5"  → Banana (Yellow)
//  "6"  → Tangerine (Orange)
//  "7"  → Peacock (Cyan)
//  "8"  → Graphite (Gray)
//  "9"  → Blueberry (Blue)
//  "10" → Basil (Green)
//  "11" → Tomato (Red)
// ──────────────────────────────────────────────────────────────


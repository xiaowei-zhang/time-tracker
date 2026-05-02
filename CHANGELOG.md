# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-02

### Added

- Initial release
- Sync Toggl Track time entries to Google Calendar via API v9
- Full history export (configurable `DAYS_TO_SYNC`, no two-week limit)
- Deduplication using Google Calendar event tags
- Project color-coding via `PROJECT_COLORS` config map
- Billable status and tags included in event description
- Configurable event title prefix
- `createDailyTrigger()` for automatic daily scheduling
- `deleteAllTogglEvents()` for clean slate reset
- Script Properties support for safe credential storage
- Timezone-aware date formatting (`localIsoString`) for correct dates in all timezones

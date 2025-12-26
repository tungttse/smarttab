# SmartTab - Chrome Extension

A productivity Chrome extension that replaces your new tab page with a dashboard featuring website statistics, todo lists, bookmarks, focus mode, and more.

## Features

- **Website Statistics** - Track visits, time spent, and top domains
- **Todo List** - Manage tasks with drag-and-drop
- **Bookmarks** - Quick access to your bookmarks
- **Focus Mode** - Pomodoro-style focus sessions with site blocking
- **Domain Limits** - Set daily time limits for distracting sites
- **Tab Management** - Sort tabs by domain

---

## Statistics Calculation

### Data Storage Structure

```javascript
// Chrome storage structure
{
  visits: [],           // Recent visits (capped at 1000)
  domains: {},          // Accumulated domain stats
  dailyActiveTime: {},  // Daily browsing time
  dailyDomainTime: {}   // Per-domain daily time (for limits)
}
```

### How Visits are Tracked

1. **On tab activation/update**: A new visit is recorded
2. **Visit object structure**:
   ```javascript
   {
     url: "https://github.com/...",
     domain: "github.com",
     title: "Page Title",
     timestamp: 1703548800000,  // Date.now()
     timeSpent: 0               // Updated later
   }
   ```

### How Time is Tracked

1. **When you switch TO a tab**:
   - `activeTabStartTime = Date.now()`

2. **When you switch AWAY from a tab** (or every 30 seconds):
   - `timeSpent = Date.now() - activeTabStartTime`
   - Updates `domains[domain].totalTime += timeSpent`
   - Updates `visits[].timeSpent` for the recent visit

3. **Periodic saves** (every 30 seconds):
   - Prevents data loss if browser crashes
   - Located in `background.js` → `startPeriodicTimeSave()`

### Domain Stats Structure

```javascript
domains: {
  "github.com": {
    count: 50,              // Total visit count (all time)
    totalTime: 3600000,     // Total time in milliseconds
    lastVisit: 1703548800000
  },
  "google.com": {
    count: 120,
    totalTime: 1800000,
    lastVisit: 1703548900000
  }
}
```

### Period-Based Statistics

| Period | How it's calculated |
|--------|---------------------|
| **Today** | Filters `visits[]` where `timestamp >= startOfToday` |
| **Week** | Filters `visits[]` where `timestamp >= startOfWeek` (Sunday) |
| **Month** | Filters `visits[]` where `timestamp >= startOfMonth` |
| **Year** | Filters `visits[]` where `timestamp >= startOfYear` |
| **All Time** | Uses accumulated `domains{}` stats (not filtered) |

### Limitations

- **Visits array capped at 1000**: Only recent visits are stored
- **Period filtering depends on visits array**: For Today/Week/Month/Year, only visits within the last 1000 entries are counted
- **All Time uses domain totals**: This is accurate as it uses accumulated `domains[].count` and `domains[].totalTime`

### Statistics Displayed

| Stat | Source |
|------|--------|
| **Visits** | `visits.length` (filtered) or `sum(domains[].count)` for All Time |
| **Time Spent** | `sum(periodDomainStats[].totalTime)` or `sum(domains[].totalTime)` for All Time |
| **Sites Visited** | `Object.keys(periodDomainStats).length` (unique domains) |

### Pie Chart

- Shows **Top 5 domains** + "Other" (remaining domains combined)
- Toggle between **Visits** (count) and **Time** (totalTime)
- Time displayed using `formatTime(ms)` → e.g., "2h 30m"

---

## File Structure

```
extention/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (data tracking)
├── newtab.html/css        # New tab page UI
├── blocked.html/css/js    # Blocked site page
└── js/
    ├── utils.js           # Utility functions
    ├── SmartTabApp.js     # Main app orchestrator
    └── managers/
        ├── StatisticsManager.js
        ├── TodoManager.js
        ├── BookmarkManager.js
        ├── FocusModeManager.js
        ├── TabManager.js
        ├── ChartManager.js
        ├── DataManager.js
        ├── DomainLimitsManager.js
        ├── BlockedDomainManager.js
        ├── ReminderManager.js
        └── BackgroundImageManager.js
```

---

## Installation

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extention` folder

---

## Development Notes

- Statistics refresh every 30 seconds
- Time tracking pauses when browser is idle
- Data persists in `chrome.storage.local`
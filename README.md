# Team Calendar + Analytics

A small multi-user calendar with a business analytics dashboard. It's a learning
project that runs locally with minimal setup.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · SQLite via Prisma · Recharts · Vitest

## Setup

Requires Node.js 20+.

```bash
npm install          # install dependencies (also generates the Prisma client)
npm run setup        # create the SQLite database (prisma/dev.db) and seed sample data
npm run dev          # start the app on http://localhost:3000
```

Other useful commands:

| Command | What it does |
|---|---|
| `npm test` | Run the unit tests (busy/free calculations etc.) |
| `npm run db:seed` | Wipe all users/events and re-seed sample data |
| `npm run db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` |
| `npm run db:reset` | Drop the database, re-apply migrations and re-seed |
| `npm run lint` | Type-check the project |
| `npx prisma studio` | Browse the database in a GUI |

The seed data is generated **relative to today**: the current week plus the three
weeks before it, so "This week", "Last week" and "This month" always have data.

## Features

- **Calendar** (`/`): week view (default) and day view. Shows the current user's
  events (owned or attending); tick **Show all users** to overlay everyone's
  calendar (a coloured dot shows each event's owner). Events are colour-coded by
  category. Click an empty slot to create an event, click an event to edit or
  delete it. Click a day header to jump to that day.
- **Current user**: no real authentication. Pick a user from the dropdown in the
  header; it's stored in a cookie.
- **Analytics** (`/analytics`): filter by user (or all users) and date range
  (this week, last week, this month). Shows summary cards, busy vs free working
  hours, hours by category, busy hours by weekday (busiest day highlighted) and
  product vs sales meeting count and hours.

## How the numbers are calculated

All the logic is in [`lib/analytics.ts`](lib/analytics.ts). The definitions are at the top of that file:

- **Working time** is 9am to 5pm, Monday to Friday (`WORKDAY`), in the server's local time zone.
- **Busy time** is the part of someone's working time covered by at least one
  event they own or attend. Overlapping events are merged first, so double-booked
  time counts once. Time outside working hours is ignored.
- **Free time** = working time − busy time.
- **All users**: busy and free hours are summed per person (5 people × 40h = 200h
  a week). Event-based stats (hours by category, meeting counts) count each
  event once, however many people attend.
- **Meetings** are the Product Meeting, Sales Meeting and Internal categories
  (`MEETING_CATEGORIES` in `lib/constants.ts`). Focus Time and Other are excluded
  from meeting count and average length.
- "This week" and "This month" include days that haven't happened yet, so they
  count future free time as well.

## Project structure

```
app/
  layout.tsx              Root layout + header (loads users, reads current-user cookie)
  page.tsx                Calendar page
  analytics/page.tsx      Dashboard (server component: queries DB, runs analytics)
  api/users/route.ts      GET users
  api/events/route.ts     GET events in a range, POST create
  api/events/[id]/route.ts  PUT update, DELETE
components/
  Header.tsx              Nav + current-user dropdown
  CalendarView.tsx        Week/day grid, overlap layout, overlay toggle
  EventModal.tsx          Create/edit/delete form
  AnalyticsFilters.tsx    User + date range filters (stored in the URL)
  AnalyticsCharts.tsx     Recharts bar charts
lib/
  analytics.ts            Pure analytics functions (busy/free, categories, …)
  constants.ts            Categories, colours, teams
  events.ts               Event DTO + request validation
  current-user.ts         Cookie-based "current user"
  prisma.ts               Prisma client singleton
prisma/
  schema.prisma           Data model
  seed.ts                 Seed script (5 users, ~4 weeks of events)
tests/
  analytics.test.ts       Unit tests, including overlapping events
```

## Data model

```
User   id, name, email (unique), team ("Product" | "Sales"), color
Event  id, title, start, end, category, ownerId → User, attendees ↔ User (many-to-many)
```

Category values: Product Meeting, Sales Meeting, Internal, Focus Time, Other.
SQLite has no enum type, so `team` and `category` are strings, and the API checks
them against the lists in `lib/constants.ts`.

## Notes

- Times are stored in UTC and shown in local time. The dashboard works out working
  hours using the server's time zone, which is your time zone when you run it locally.
- `next.config.ts` stops the dev server from watching `*.db` files. Without this,
  every database write would trigger a rebuild and reload the page.
- `.env` is committed because it only holds the local SQLite path.

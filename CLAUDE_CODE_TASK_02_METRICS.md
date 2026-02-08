# CLAUDE CODE TASK — Add Ranking Metrics + Operational Forward-Looking Data

> Read this entire document before making changes.
> This adds new metrics to the Ranker page and new operational sections to Location Detail.

---

## CONTEXT

The database has these relevant tables (already deployed and seeded):

- `students` — has `lessons_remaining` (= outstanding BTW drive hours), `status`, `location_id`, `total_lessons_purchased`, `lessons_completed`, `balance_due`, `classroom_hours_remaining`
- `instructors` — has `status`, `location_id`
- `drive_appointments` — has `scheduled_date`, `scheduled_time`, `instructor_id`, `vehicle_id`, `location_id`, `status` (completed/scheduled/cancelled/no_show)
- `classes` — has `class_type`, `capacity`, `enrolled_count`, `status` (scheduled/in_progress/completed/cancelled), `start_date`, `end_date`, `location_id`
- `class_enrollments` — has `class_id`, `student_id`, `hours_attended`, `hours_remaining`, `status`
- `kpi_daily` — has `active_students`, `revenue_collected`, `active_instructors`
- `vehicles` — has `status` ('active', 'maintenance', 'retired'), `location_id`

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`

---

## PART 1: NEW RANKING METRICS

### Add these columns to the Ranker page table

| New Column | Calculation | Format |
|------------|-------------|--------|
| Rev / Student | Sum of `revenue_collected` (7d from kpi_daily) / latest `active_students` | Currency ($X,XXX) |
| Instructor Util. | Completed drives (last 7d) / (active_instructors × 6 slots/day × 5 weekdays) × 100 | Percentage (XX%) |
| Drive Backlog | Sum of `lessons_remaining` from all active students at location | Number (XX hrs) |

### API changes — `src/app/api/ranker/route.ts`

Add these queries after the existing ones:

```typescript
// --- NEW: Drive backlog per location ---
const { data: studentBacklog } = await supabase
  .from('students')
  .select('location_id, lessons_remaining')
  .eq('status', 'active')
  .in('location_id', locationIds)

// --- NEW: Instructor utilization (completed drives last 7 days) ---
const { data: recentDrives } = await supabase
  .from('drive_appointments')
  .select('location_id, instructor_id, status')
  .eq('status', 'completed')
  .gte('scheduled_date', sevenDaysAgoStr)
  .in('location_id', locationIds)
```

Then in the `rows` mapping, add:

```typescript
// Drive backlog: sum of remaining lessons for active students
const locBacklog = studentBacklog?.filter(s => s.location_id === loc.id) || []
const drive_backlog = locBacklog.reduce((sum, s) => sum + (s.lessons_remaining || 0), 0)

// Instructor utilization: completed drives / (instructors × 6 slots × 5 days)
const locDrives = recentDrives?.filter(d => d.location_id === loc.id) || []
const activeInstructors = today_kpi?.active_instructors || 1
const maxCapacity = activeInstructors * 6 * 5 // 6 one-hour drive slots per day, 5 weekdays
const instructor_utilization = maxCapacity > 0
  ? Math.round((locDrives.length / maxCapacity) * 100)
  : 0

// Revenue per student
const rev_per_student = (today_kpi?.active_students || 0) > 0
  ? sum(week, 'revenue_collected') / today_kpi.active_students
  : 0
```

Add to return object for each row:
```typescript
{
  ...existingFields,
  rev_per_student,
  instructor_utilization,
  drive_backlog,
}
```

### Types — `src/lib/types.ts`

Add to `RankerRow`:
```typescript
rev_per_student: number
instructor_utilization: number
drive_backlog: number
```

### Frontend — Ranker page table columns

Add these columns to the sortable table (insert after existing columns):

| Header | Field | Format | Color logic |
|--------|-------|--------|-------------|
| Rev / Student | `rev_per_student` | `formatCurrency()` | Green: ≥ $500, Yellow: ≥ $300, Red: < $300 |
| Instructor Util. | `instructor_utilization` | `XX%` | Green: ≥ 70%, Yellow: ≥ 50%, Red: < 50% |
| Drive Backlog | `drive_backlog` | `XX hrs` | Green: ≤ 30, Yellow: ≤ 60, Red: > 60 (lower is better for being caught up, but also means fewer paid hours remaining — so neutral coloring may be better. Use: Red: > 80, Yellow: > 40, default: neutral) |

Best/worst highlighting: apply green bg to best value per column, red bg to worst.

---

## PART 2: LOCATION DETAIL — OPERATIONAL FORWARD-LOOKING SECTION

### Add a new "Operations Forecast" section to the Location Detail page

This goes between the KPI cards and the existing tabbed tables. It should be a row of cards/panels.

### 2A: Class Capacity Fill Rate

**Query** — add to `src/app/api/locations/[id]/route.ts`:

```typescript
// Active/upcoming classes with capacity
const { data: classes } = await supabase
  .from('classes')
  .select('id, name, class_type, capacity, enrolled_count, status, start_date, end_date, instructor_id')
  .eq('location_id', locationId)
  .in('status', ['in_progress', 'scheduled'])
  .order('start_date')
```

Add `classes` to the response JSON.

**Type** — add to `src/lib/types.ts`:

```typescript
export interface ClassSummary {
  id: string
  name: string
  class_type: string
  capacity: number
  enrolled_count: number
  status: string
  start_date: string
  end_date: string
  fill_rate: number // calculated client-side: enrolled_count / capacity * 100
}
```

Add to `LocationDetail`:
```typescript
classes: ClassSummary[]
```

**UI — "Class Capacity" card/panel:**

Show a mini-table or card list:

| Class Name | Type | Status | Enrolled | Capacity | Fill Rate |
|------------|------|--------|----------|----------|-----------|

Each row shows a progress bar or colored percentage:
- ≥ 90% fill: green (great, almost full)
- 60-89%: yellow (room to grow)
- < 60%: red (needs marketing or schedule adjustment)

Also show a summary line at top: "3 active/upcoming classes — avg fill rate: 72%"

### 2B: Outstanding Drive Hours — Student Backlog View

**Query** — add to `src/app/api/locations/[id]/route.ts`:

```typescript
// Drive backlog: active students with remaining lessons
const { data: driveBacklog } = await supabase
  .from('students')
  .select('id, first_name, last_name, total_lessons_purchased, lessons_completed, lessons_remaining, classroom_hours_remaining')
  .eq('location_id', locationId)
  .eq('status', 'active')
  .gt('lessons_remaining', 0)
  .order('lessons_remaining', { ascending: false })
```

Also get upcoming scheduled drives:
```typescript
// Scheduled (future) drives for this location
const { data: scheduledDrives } = await supabase
  .from('drive_appointments')
  .select('id, student_id, instructor_id, scheduled_date, scheduled_time, status')
  .eq('location_id', locationId)
  .eq('status', 'scheduled')
  .gte('scheduled_date', new Date().toISOString().split('T')[0])
  .order('scheduled_date')
```

Add both to response JSON as `drive_backlog` and `scheduled_drives`.

**Types:**

```typescript
export interface DriveBacklogStudent {
  id: string
  first_name: string
  last_name: string
  total_lessons_purchased: number
  lessons_completed: number
  lessons_remaining: number
  classroom_hours_remaining: number
  scheduled_count?: number // enriched client-side: how many future drives already scheduled
}

export interface ScheduledDrive {
  id: string
  student_id: string
  instructor_id: string
  scheduled_date: string
  scheduled_time: string
}
```

Add to `LocationDetail`:
```typescript
drive_backlog: DriveBacklogStudent[]
scheduled_drives: ScheduledDrive[]
```

**UI — "Drive Hours Backlog" card/panel:**

**Summary stats at top (3 numbers in a row):**
- Total outstanding hours: sum of all `lessons_remaining`
- Students with remaining drives: count of students
- Already scheduled: count of `scheduled_drives`

Then a table:

| Student | Drives Done | Drives Left | Classroom Left | Scheduled | Gap |
|---------|-------------|-------------|----------------|-----------|-----|

Where:
- "Scheduled" = count of future drive_appointments for that student (match on student_id)
- "Gap" = `lessons_remaining` - scheduled count. This is the KEY number — drives that still need to be booked.
  - Gap > 0: red badge — "X unscheduled"
  - Gap = 0: green badge — "Fully booked"

Sort by Gap descending (biggest gaps first) so the franchisee sees who needs appointments booked.

**Staffing insight line at bottom:**
Calculate and display: "At current pace (X drives/week), backlog clears in ~Y weeks. You need Z instructor-hours/week to stay on track."

Formula:
- drives_per_week = count of completed drives in last 7 days
- weeks_to_clear = total_outstanding / drives_per_week
- hours_per_week_needed = total_outstanding / 8 (target: clear in 8 weeks)

---

## PART 3: DASHBOARD API — ALSO ADD BACKLOG

Add `drive_backlog` to the Corporate Dashboard location summaries so the COO can see it at a glance.

In `src/app/api/dashboard/route.ts`, add:

```typescript
// Drive backlog across all locations
const { data: allBacklog } = await supabase
  .from('students')
  .select('location_id, lessons_remaining')
  .eq('status', 'active')
  .in('location_id', locations.map(l => l.id))
```

Then in `locationSummaries` mapping:
```typescript
const locBacklog = allBacklog?.filter(s => s.location_id === loc.id) || []
const drive_backlog = locBacklog.reduce((sum, s) => sum + (s.lessons_remaining || 0), 0)
```

Add `drive_backlog: number` to `LocationSummary` type and include in the corporate dashboard location table.

---

## BUILD ORDER

1. Update types in `src/lib/types.ts`
2. Update API route: `/api/ranker/route.ts` (add 3 new metrics)
3. Update Ranker page UI (add 3 columns)
4. Update API route: `/api/locations/[id]/route.ts` (add classes, drive_backlog, scheduled_drives)
5. Build "Operations Forecast" section in Location Detail page
6. Update API route: `/api/dashboard/route.ts` (add drive_backlog)
7. Update Corporate Dashboard location table (add backlog column)
8. Test all pages load correctly

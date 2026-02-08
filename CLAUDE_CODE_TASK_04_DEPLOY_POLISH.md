# CLAUDE CODE TASK — Deploy to Vercel + UI Polish

> Read this entire document before making changes.
> Two parts: (1) Get the app deployed to a live URL, (2) Polish the UI for an internal team demo.

---

## PART 1: DEPLOY TO VERCEL

### Step 1: Git setup

```bash
cd ~/Desktop/Projects/jungle-dashboard   # or wherever the project is

# Initialize git
git init
git add .
git commit -m "Initial build: dashboard, ranker, actions, marketing, compliance"
```

### Step 2: Create GitHub repo

Ask the user:
- "Do you have a GitHub account? If so, what's your username?"
- "Do you have the GitHub CLI installed? Run `gh --version` to check."

**If gh CLI is available:**
```bash
gh repo create jungle-dashboard --private --source=. --push
```

**If not:**
Tell the user to:
1. Go to github.com/new
2. Create a private repo called "jungle-dashboard"
3. Then run:
```bash
git remote add origin https://github.com/USERNAME/jungle-dashboard.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

**If Vercel CLI is available (`vercel --version`):**
```bash
npx vercel --yes
```

**If not:**
Tell the user to:
1. Go to vercel.com and sign in (or create account with GitHub)
2. Click "Add New Project"
3. Import the jungle-dashboard repo from GitHub
4. Vercel auto-detects Next.js — just click Deploy

### Step 4: Environment variables

After connecting the repo, the user needs to add env vars in Vercel:
1. Go to Project Settings → Environment Variables
2. Add these three:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | (same as .env.local) | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (same as .env.local) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | (same as .env.local) | All |
| `CRON_SECRET` | (generate a random string) | All |

3. Click Redeploy after adding vars

### Step 5: Vercel Cron (optional — set up now)

Create or verify `vercel.json` in the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/kpi-rollup",
      "schedule": "30 12 * * *"
    }
  ]
}
```

This runs the KPI rollup at 12:30 PM UTC (6:30 AM Central) daily.

**Note:** Vercel Cron is only on Pro plan. If user is on Hobby, skip this — they can trigger manually for now.

### Step 6: Verify

After deploy, visit the Vercel URL (e.g. `jungle-dashboard-xxx.vercel.app`) and verify:
- Dashboard loads with data
- All pages work
- No console errors

If the deployed version shows errors but localhost works, it's almost always missing environment variables.

---

## PART 2: UI POLISH

These changes make the app feel polished and demo-ready. Apply them across all pages.

### 2A: Loading States

Every page that fetches data should show a proper loading skeleton instead of a blank screen or "Loading...".

Create `src/components/ui/LoadingSkeleton.tsx`:

```typescript
// Reusable skeleton components
// Use Tailwind's animate-pulse on gray placeholder blocks

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-3"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex gap-4 p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-48 bg-gray-100 rounded"></div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      {/* Table */}
      <SkeletonTable rows={3} />
    </div>
  )
}
```

Replace all `if (loading) return <div>Loading...</div>` (or similar) across every page with the appropriate skeleton component.

### 2B: Error States

Create `src/components/ui/ErrorState.tsx`:

```typescript
import { AlertTriangle, RefreshCw } from 'lucide-react'

export function ErrorState({ message, onRetry }: { message?: string, onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
      <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load data</h3>
      <p className="text-sm text-gray-500 mb-4">{message || 'Something went wrong. Please try again.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  )
}
```

Use this wherever data fails to load instead of showing a blank page.

### 2C: Page Headers

Every page should have a consistent header. Create `src/components/layout/PageHeader.tsx`:

```typescript
export function PageHeader({ 
  title, 
  subtitle,
  action 
}: { 
  title: string
  subtitle?: string
  action?: React.ReactNode 
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
```

Apply to all pages:
- Dashboard: `title="Network Overview"` `subtitle="All 3 locations"`
- Ranker: `title="Franchise Rankings"` `subtitle="Sorted by performance"`
- Actions: `title="Action Items"` `subtitle="22 items across 3 locations"` (dynamic count)
- Marketing: `title="Marketing Performance"` `subtitle="Last 30 days"`
- Compliance: `title="Compliance Tracker"` `subtitle="Across all locations"`
- Location Detail: `title="{location name}"` `subtitle="Location detail"`

### 2D: Responsive / Mobile Improvements

The demo audience will likely pull it up on laptops, but mobile-friendly impresses people. Apply these fixes:

1. **Sidebar**: On screens < 1024px, collapse sidebar to a hamburger menu icon at the top. Use state to toggle.

```typescript
// In layout.tsx, add mobile toggle:
// - Below lg: hide sidebar, show a top bar with hamburger icon
// - Hamburger click: slide sidebar in from left as overlay
// - Click outside or navigate: close sidebar
```

2. **KPI cards grid**: Already using `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` — verify this is consistent on ALL pages.

3. **Tables**: Wrap wide tables in `<div className="overflow-x-auto">` so they scroll horizontally on small screens instead of breaking layout.

4. **Charts**: Recharts should already be responsive if using `<ResponsiveContainer>`. Verify all charts use it:
```tsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    ...
  </LineChart>
</ResponsiveContainer>
```

5. **Font sizes on mobile**: Check that titles don't overflow. Use `text-xl sm:text-2xl` pattern for page headers.

### 2E: Empty States

For pages/sections that might have no data, add friendly empty states:

- No action items: "✅ All clear! No action items right now."
- No compliance issues: "✅ All items are current."
- No students at location: "No students enrolled yet."
- No reviews: "No reviews to display."

### 2F: Favicon + Title

1. **Page titles**: Each page should set a `<title>` using Next.js metadata:

```typescript
// In each page.tsx:
export const metadata = {
  title: 'Dashboard | Jungle Driving School',
}
// For client components, use useEffect:
useEffect(() => { document.title = 'Dashboard | Jungle Driving School' }, [])
```

Titles per page:
- Dashboard: "Dashboard | Jungle Driving School"
- Ranker: "Rankings | Jungle Driving School"
- Actions: "Action Items | Jungle Driving School"
- Marketing: "Marketing | Jungle Driving School"
- Compliance: "Compliance | Jungle Driving School"
- Location: "{Name} | Jungle Driving School"

2. **Branding in sidebar**: The top of the sidebar should show:
```
🌴 Jungle Driving School
     Franchise OS
```
Use a palm tree emoji or a simple SVG icon. Text should be `text-white font-bold text-lg` for the name, `text-gray-400 text-xs` for "Franchise OS".

### 2G: Hover & Interaction Polish

1. **Table rows**: Add `hover:bg-gray-50 cursor-pointer transition-colors` to clickable rows (location summary, ranker).

2. **Cards**: Add `hover:shadow-md transition-shadow` to clickable KPI cards or location cards.

3. **Buttons**: Ensure all buttons have hover states, focus rings, and disabled states during loading.

4. **Active sidebar link**: The current page's sidebar link should have a distinct `bg-gray-800` or `bg-gray-700` background. Use `usePathname()` from `next/navigation` to detect.

### 2H: Last Updated Timestamp

Add a subtle "Last updated: X minutes ago" line somewhere on the dashboard (bottom of KPI cards section or in the page header subtitle). This shows the data is live and builds trust during a demo.

```typescript
// In the dashboard API response, include:
// updated_at: new Date().toISOString()

// In the UI:
const timeAgo = formatDistanceToNow(new Date(data.updated_at), { addSuffix: true })
// Shows: "Last updated: 3 minutes ago"
```

Use `date-fns` (already installed) for `formatDistanceToNow`.

---

## BUILD ORDER

1. Create skeleton and error components (`LoadingSkeleton.tsx`, `ErrorState.tsx`, `PageHeader.tsx`)
2. Apply loading skeletons to ALL pages (dashboard, ranker, actions, locations, marketing, compliance)
3. Apply error states with retry buttons to all pages
4. Apply consistent PageHeader to all pages
5. Add branding to sidebar top (🌴 Jungle Driving School / Franchise OS)
6. Add active link highlighting to sidebar
7. Add mobile responsive sidebar (hamburger toggle < 1024px)
8. Wrap all tables in `overflow-x-auto`
9. Verify all charts use `ResponsiveContainer`
10. Add hover/transition effects to tables and cards
11. Add page titles
12. Add empty states
13. Add "Last updated" timestamp to dashboard
14. Test all pages at desktop and mobile widths
15. **Then:** Initialize git, push to GitHub, deploy to Vercel (Part 1)

# CLAUDE CODE TASK 14 — AI Sales Assistant Phase 1: Foundation

> Read this ENTIRE document before making changes.
> Also read PROJECT_BRIEF.md for schema context.
> This is Phase 1 of 5. We're laying the database foundation, adding lead follow-up scheduling, and redesigning the action items page.

---

## CRITICAL SCHEMA NOTES

### Existing `action_items` table columns:
id, organization_id, location_id, rule_id, category, priority, status, title, description, recommended_action, data_context (JSONB), generated_by, expires_at, created_at, updated_at

### Existing `leads` table gotchas:
- NO `status` column. Active = `is_archived = FALSE AND converted_at IS NULL`
- `source` is Postgres enum — cast with `::TEXT`
- Has: id, organization_id, location_id, first_name, last_name, email, phone, source, stage_id, notes, is_archived, converted_at, created_at, updated_at

### Existing `call_tracking_records` gotchas:
- Uses `call_start` (timestamp) not `call_date`
- Uses `call_type` (answered/missed/voicemail) not `status`
- Has `activity_type` (call/text/chat) and `direction` (inbound/outbound)
- Has `external_id`, `caller_number`, `tracking_number`, `duration_seconds`, `recording_url`, `caller_city`, `caller_state`, `talk_time_seconds`

**Organization ID:** `9a0d8a37-e9cf-4592-8b7d-e3762c243b0d`

---

## OVERVIEW

**What we're building in Phase 1:**

1. **SQL Migration 011** — New tables (email_templates, email_queue, sync_state) + new columns on leads and action_items
2. **Lead follow-up scheduling** — Add follow-up date/type/notes to lead detail page
3. **Enhanced action items page** — Grouped by type (Call Back, Send Email, Follow Up), overdue escalation, lead context on each item, persistent items that never auto-dismiss

---

## PART 1: SQL MIGRATION — `migrations/011_sales_assistant.sql`

Run this in Supabase SQL Editor:

```sql
-- ============================================================
-- MIGRATION 011: AI Sales Assistant Foundation
-- ============================================================

-- 1. Lead follow-up fields
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS follow_up_date date,
ADD COLUMN IF NOT EXISTS follow_up_type text,
ADD COLUMN IF NOT EXISTS follow_up_notes text,
ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
ADD COLUMN IF NOT EXISTS last_contact_type text;

COMMENT ON COLUMN leads.follow_up_type IS 'call, email, meeting, text';
COMMENT ON COLUMN leads.last_contact_type IS 'call_inbound, call_outbound, email_sent, email_received, sms, in_person';

-- 2. Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  slug text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  category text NOT NULL DEFAULT 'general',
  trigger_rules jsonb,
  merge_tags text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN email_templates.category IS 'new_lead, follow_up, reengagement, post_call, general';
COMMENT ON COLUMN email_templates.slug IS 'URL-safe identifier: new-lead-teen, follow-up-3-day, etc.';

-- 3. Email send queue
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  lead_id uuid NOT NULL REFERENCES leads(id),
  template_id uuid REFERENCES email_templates(id),
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  to_email text NOT NULL,
  to_name text,
  from_email text NOT NULL DEFAULT 'hello@jungledriving.com',
  from_name text DEFAULT 'Jungle Driving School',
  status text NOT NULL DEFAULT 'queued',
  generated_by text NOT NULL DEFAULT 'template',
  ai_context jsonb,
  reason text,
  priority integer DEFAULT 5,
  queued_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  sent_at timestamptz,
  sendgrid_message_id text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN email_queue.status IS 'queued, approved, sent, failed, skipped';
COMMENT ON COLUMN email_queue.generated_by IS 'template, ai, manual';

-- 4. Sync state tracking (for hourly call matcher)
CREATE TABLE IF NOT EXISTS sync_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES locations(id),
  sync_type text NOT NULL,
  last_sync_at timestamptz NOT NULL DEFAULT '2020-01-01',
  last_record_id text,
  metadata jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, sync_type)
);

COMMENT ON COLUMN sync_state.sync_type IS 'ctm_call_matcher, ctm_daily_sync, meta_ads, etc.';

-- 5. Enhance action_items for sales assistant
ALTER TABLE action_items
ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id),
ADD COLUMN IF NOT EXISTS call_record_id uuid,
ADD COLUMN IF NOT EXISTS email_queue_id uuid,
ADD COLUMN IF NOT EXISTS ai_suggestion text,
ADD COLUMN IF NOT EXISTS suggested_template_id uuid REFERENCES email_templates(id),
ADD COLUMN IF NOT EXISTS overdue_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS source_engine text;

COMMENT ON COLUMN action_items.action_type IS 'general, call_back, send_email, follow_up, create_lead, review_voicemail';
COMMENT ON COLUMN action_items.source_engine IS 'rule_engine, call_matcher, lead_scanner, manual';

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_email_queue_location_status ON email_queue(location_id, status);
CREATE INDEX IF NOT EXISTS idx_email_queue_lead ON email_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(location_id, follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_last_contact ON leads(location_id, last_contact_at);
CREATE INDEX IF NOT EXISTS idx_action_items_lead ON action_items(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_type ON action_items(location_id, action_type, status);
CREATE INDEX IF NOT EXISTS idx_action_items_overdue ON action_items(location_id, status, overdue_days) WHERE status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_sync_state_lookup ON sync_state(location_id, sync_type);

-- 7. Seed 10 email templates
INSERT INTO email_templates (organization_id, name, slug, subject, body_html, body_text, category, trigger_rules, merge_tags) VALUES
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'New Lead - Teen Program', 'new-lead-teen', 'Welcome to Jungle Driving School – Teen Driver Info', '<p>Hi {{lead_name}},</p><p>Thank you for your interest in our teen driving program! We know choosing the right driving school for your teen is a big decision, and we''re here to help.</p><p>Our teen program includes:</p><ul><li>State-approved classroom instruction</li><li>Behind-the-wheel training with patient, certified instructors</li><li>Flexible scheduling that works around school</li></ul><p>I''d love to answer any questions you have. The best way to get started is to give us a call at {{location_phone}} or reply to this email.</p><p>Looking forward to helping your teen become a confident driver!</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Thank you for your interest in our teen driving program! I''d love to answer any questions. Call us at {{location_phone}} or reply to this email.', 'new_lead', '{"source": ["meta", "google_ads"], "program_type": "teen"}', ARRAY['lead_name', 'location_name', 'location_phone']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'New Lead - Adult Lessons', 'new-lead-adult', 'Welcome to Jungle Driving School – Adult Lessons', '<p>Hi {{lead_name}},</p><p>Thanks for reaching out about adult driving lessons! Whether you''re learning for the first time or brushing up on your skills, we''ve got you covered.</p><p>Our adult program features:</p><ul><li>One-on-one instruction at your pace</li><li>Flexible scheduling including evenings and weekends</li><li>No judgment — just patient, professional instruction</li></ul><p>Give us a call at {{location_phone}} to get started, or reply to this email with any questions.</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Thanks for reaching out about adult driving lessons! Call us at {{location_phone}} to get started.', 'new_lead', '{"program_type": "adult"}', ARRAY['lead_name', 'location_name', 'location_phone']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'New Lead - Generic', 'new-lead-generic', 'Thanks for Your Interest – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Thank you for your interest in Jungle Driving School! We''d love to help you or your family member become a confident, safe driver.</p><p>Give us a call at {{location_phone}} and we''ll walk you through our programs and pricing. Or just reply to this email — we''re happy to help.</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Thank you for your interest! Call us at {{location_phone}} or reply to this email.', 'new_lead', NULL, ARRAY['lead_name', 'location_name', 'location_phone']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Follow Up - After Quote', 'follow-up-after-quote', 'Following Up on Your Quote – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>I wanted to follow up on the pricing information we shared with you. Do you have any questions about our programs or the enrollment process?</p><p>We''d love to get you scheduled — spots fill up fast, especially for {{season}} sessions.</p><p>Feel free to call us at {{location_phone}} or reply here. We''re happy to help!</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Following up on the pricing info we shared. Any questions? Call {{location_phone}} or reply here.', 'follow_up', '{"stage": "quoted", "days_since_quote": [1, 3]}', ARRAY['lead_name', 'location_name', 'location_phone', 'season']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Follow Up - No Response 3 Day', 'follow-up-3-day', 'Just Checking In – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Just checking in! I wanted to make sure you received our information and see if you have any questions.</p><p>We know choosing a driving school is important, and we want to make sure we can help. If now isn''t the right time, no worries — just let us know and we''ll follow up later.</p><p>Call us at {{location_phone}} anytime!</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Just checking in — do you have any questions? Call {{location_phone}} anytime.', 'follow_up', '{"days_since_contact": [3, 4]}', ARRAY['lead_name', 'location_name', 'location_phone']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Follow Up - No Response 7 Day', 'follow-up-7-day', 'Still Interested? – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>We reached out a few days ago and wanted to make sure you haven''t fallen through the cracks!</p><p>If you''re still thinking about driving lessons, we''re here whenever you''re ready. Our schedule fills up, so booking early helps lock in the times that work best for you.</p><p>Any questions at all — call {{location_phone}} or just reply.</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Just wanted to follow up one more time. Still interested? Call {{location_phone}} when you''re ready.', 'follow_up', '{"days_since_contact": [7, 8]}', ARRAY['lead_name', 'location_name', 'location_phone']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Re-engagement - Gone Cold', 'reengagement-cold', 'We Miss You – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>It''s been a little while since we last connected, and I wanted to reach out to see if you''re still interested in driving lessons.</p><p>If circumstances have changed or the timing wasn''t right before, we totally understand. But if you''re still thinking about it, we''d love to pick up where we left off.</p><p>Our current availability is open — give us a call at {{location_phone}} and we can get you on the schedule quickly.</p><p>Hope to hear from you!</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, It''s been a while! Still interested in driving lessons? Call {{location_phone}} — we''d love to help.', 'reengagement', '{"days_since_contact": [14, 30]}', ARRAY['lead_name', 'location_name', 'location_phone']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Post-Call - Recap & Next Steps', 'post-call-recap', 'Great Chatting With You! – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>It was great talking with you today! Just wanted to recap what we discussed and outline next steps.</p><p>{{call_notes}}</p><p>If you have any other questions, don''t hesitate to reach out at {{location_phone}}. We''re excited to work with you!</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Great talking with you! Recapping our conversation. Questions? Call {{location_phone}}.', 'post_call', '{"last_activity": "call_answered"}', ARRAY['lead_name', 'location_name', 'location_phone', 'call_notes']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Post-Call - Missed Call', 'post-call-missed', 'Sorry We Missed You! – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>It looks like we missed your call — sorry about that! We''d love to chat with you about driving lessons.</p><p>Here are a few ways to reach us:</p><ul><li>Call us back at {{location_phone}} (we''re available M-F 8am-5pm)</li><li>Reply to this email with your questions</li><li>Let us know a good time to call you back</li></ul><p>Looking forward to connecting!</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Sorry we missed your call! Call us back at {{location_phone}} or reply with a good time to reach you.', 'post_call', '{"last_activity": "call_missed"}', ARRAY['lead_name', 'location_name', 'location_phone']),

('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Welcome Back - Returning Interest', 'welcome-back', 'Welcome Back! – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>We noticed you''ve reached out again — welcome back! We''re glad you''re still thinking about driving lessons.</p><p>A lot may have changed since we last spoke, so let''s start fresh. Give us a call at {{location_phone}} and we''ll get you up to speed on our current programs, pricing, and availability.</p><p>Best,<br>{{location_name}} Team</p>', 'Hi {{lead_name}}, Welcome back! Call {{location_phone}} to get up to speed on current programs and availability.', 'reengagement', '{"returning_lead": true}', ARRAY['lead_name', 'location_name', 'location_phone'])

ON CONFLICT DO NOTHING;
```

---

## PART 2: LEAD FOLLOW-UP UI

Update the **Lead Detail page** (`src/app/leads/[id]/page.tsx` or the lead detail component) to add a follow-up section.

### Follow-up Section Design

Place this in the lead detail sidebar or below the lead info:

```
┌─────────────────────────────────────┐
│  📅 Follow-up                        │
│                                     │
│  Date: [March 15, 2026  📅]        │
│  Type: [Call ▼]                     │
│  Notes: [Check if she got pricing]  │
│                                     │
│  [Save Follow-up]  [Clear]          │
│                                     │
│  Last Contact: Mar 10 (call inbound)│
└─────────────────────────────────────┘
```

**Type dropdown options:** Call, Email, Meeting, Text
**Date picker:** Standard HTML date input, defaults to tomorrow
**Notes:** Optional text field

**API:** PATCH `/api/leads/[id]` to update follow_up_date, follow_up_type, follow_up_notes

**When a follow-up is saved:**
- Show it on the lead card in the lead list view (small badge: "📅 Follow-up Mar 15")
- Lead scanner (Phase 3) will use this date to generate action items

**Last Contact display:**
- Show `last_contact_at` and `last_contact_type` if set
- Format: "3 days ago (call inbound)" or "Never contacted" if null

---

## PART 3: ENHANCED ACTION ITEMS PAGE

This is a significant redesign. The action items page becomes the GM's **daily command center**.

### URL: `/actions` (existing page — redesign it)

### API Enhancement: `/api/actions/route.ts`

**Update the GET handler** to include:
- Lead info for action items that have a `lead_id` (join or separate query)
- Overdue calculation: `overdue_days = days between created_at and now, minus any grace period`
- Sort: overdue items first, then by priority, then by created_at

```typescript
// Enhanced GET response shape
{
  items: [
    {
      ...actionItem,
      location_name: "Omaha",
      lead: {  // null if no lead_id
        id, first_name, last_name, phone, email, source, stage_name,
        follow_up_date, last_contact_at
      },
      overdue_days: 3,  // 0 if not overdue
      overdue_level: "critical"  // "none", "warning" (1 day), "critical" (2+ days)
    }
  ],
  summary: {
    total, critical, high, medium, low,
    overdue_count,
    by_action_type: { call_back: 3, send_email: 2, follow_up: 4, general: 1 }
  }
}
```

**Add PATCH handler** for status updates + completing actions:

```typescript
// PATCH /api/actions
// body: { id, action: "complete" | "snooze" | "skip" | "in_progress" }
// 
// "complete" → status = 'resolved', log activity on lead if lead_id exists
// "snooze" → update follow_up_date to tomorrow, keep status open
// "skip" → status = 'dismissed'
// "in_progress" → status = 'in_progress'
```

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Action Items — Omaha                     [All Locations ▼] │
│  March 12, 2026                                                 │
│                                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               │
│  │ 🔴 3   │  │ 🟡 5   │  │ 🟠 2   │  │ 🟢 1   │               │
│  │Overdue │  │Call Back│  │ Email  │  │Follow  │               │
│  └────────┘  └────────┘  └────────┘  └────────┘               │
│                                                                 │
│  ━━ OVERDUE (3) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                 │
│  🔴 OVERDUE 3 DAYS                                              │
│  Follow up with James Park                                      │
│  Walk-in inquiry, stage: Quoted. No contact since Mar 9.        │
│  📱 402-555-1234  •  james.park@email.com                       │
│  💡 "He got pricing 5 days ago — likely comparing options"      │
│  [📞 Call] [📧 Send Email] [⏰ Snooze] [✓ Done] [✕ Skip]      │
│                                                                 │
│  🟡 OVERDUE 1 DAY                                               │
│  Call back Sarah Mitchell — missed call yesterday                │
│  Meta ad lead, teen program inquiry                              │
│  📱 402-555-5678                                                │
│  [📞 Call] [📧 Send Email] [✓ Done] [✕ Skip]                   │
│                                                                 │
│  ━━ CALL BACK (2) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                 │
│  [action items with action_type = 'call_back']                  │
│                                                                 │
│  ━━ EMAILS TO SEND (2) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                 │
│  [action items with action_type = 'send_email']                 │
│  Each shows: template name, [Preview] [Send] [Edit] [Skip]     │
│                                                                 │
│  ━━ FOLLOW UPS (4) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                 │
│  [action items with action_type = 'follow_up']                  │
│  Grouped: Today (2), Upcoming (2)                               │
│                                                                 │
│  ━━ OTHER (3) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                 │
│  [existing rule-engine items: compliance, marketing, etc.]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Action Item Card Component

Build a reusable `ActionItemCard` component:

```typescript
interface ActionItemCardProps {
  item: {
    id: string
    action_type: string
    priority: string
    title: string
    description: string
    recommended_action: string
    ai_suggestion?: string
    overdue_days: number
    overdue_level: string
    created_at: string
    lead?: {
      id: string
      first_name: string
      last_name: string
      phone: string
      email: string
      source: string
      stage_name: string
      follow_up_date?: string
      last_contact_at?: string
    } | null
    location_name: string
    category: string
    data_context: any
  }
  onAction: (id: string, action: string) => void
}
```

### Card Styling

**Overdue escalation (takes priority over regular priority colors):**
- 2+ days overdue: `bg-red-50 border-l-4 border-red-600` + red "OVERDUE X DAYS" badge pulsing
- 1 day overdue: `bg-amber-50 border-l-4 border-amber-500` + amber "OVERDUE 1 DAY" badge
- Due today: `bg-blue-50 border-l-4 border-blue-500` + blue "DUE TODAY" badge
- Not overdue: use regular priority colors (same as existing)

**Regular priority colors (when not overdue):**
- Critical: `bg-red-50 border-l-4 border-red-500`
- High: `bg-orange-50 border-l-4 border-orange-500`
- Medium: `bg-yellow-50 border-l-4 border-yellow-500`
- Low: `bg-emerald-50 border-l-4 border-emerald-500`

### Lead Context on Cards

When an action item has a `lead` attached, show:
- Lead name (bold, clickable → links to lead detail)
- Phone number with tel: link (📞 icon, clicking triggers native phone dialer)
- Email with mailto: link
- Source badge (e.g., "Meta Ad" in purple)
- Stage badge (e.g., "Quoted" in blue)
- Last contact: "3 days ago" or "Never contacted" in red
- AI suggestion in a subtle box if present

### Quick Action Buttons

Each card has contextual buttons based on `action_type`:

**call_back:**
- [📞 Call] — `tel:` link to lead phone number
- [📧 Send Email] — queues a missed-call email (Phase 4, for now just a placeholder)
- [✓ Done] — marks resolved, logs "call_outbound" activity on lead
- [⏰ Snooze] — pushes to tomorrow
- [✕ Skip] — dismisses

**send_email:**
- [Preview] — shows email content (placeholder for Phase 4)
- [Send] — placeholder for Phase 4
- [Edit] — placeholder for Phase 4
- [✕ Skip] — dismisses

**follow_up:**
- [📞 Call] — tel: link
- [📧 Email] — mailto: link
- [✓ Done] — marks resolved, clears follow_up_date on lead
- [⏰ Snooze] — pushes follow_up_date to tomorrow
- [✕ Skip] — dismisses

**general (existing rule engine items):**
- [Mark In Progress] — status change
- [✓ Done] — marks resolved
- [✕ Dismiss] — dismisses

### "Done" Action Side Effects

When a user clicks "Done" on an action with a `lead_id`:
1. PATCH action item status to 'resolved'
2. Update `leads.last_contact_at` to now
3. Update `leads.last_contact_type` based on action_type ('call_back' → 'call_outbound', etc.)
4. Clear `leads.follow_up_date` if this was a follow_up action
5. Log an activity in `activity_logs` for the lead

---

## PART 4: OVERDUE CALCULATION

**The rules for overdue:**

Action items NEVER auto-dismiss. They persist until the GM acts.

**Overdue logic in the API:**
```typescript
function calculateOverdue(item: any) {
  const now = new Date()
  const created = new Date(item.created_at)
  const daysSinceCreated = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

  // For follow_up type: overdue = days past follow_up_date
  if (item.action_type === 'follow_up' && item.lead?.follow_up_date) {
    const followUp = new Date(item.lead.follow_up_date)
    const daysPast = Math.floor((now.getTime() - followUp.getTime()) / (1000 * 60 * 60 * 24))
    return {
      overdue_days: Math.max(0, daysPast),
      overdue_level: daysPast >= 2 ? 'critical' : daysPast >= 1 ? 'warning' : daysPast === 0 ? 'due_today' : 'none'
    }
  }

  // For call_back type: overdue after 1 day
  if (item.action_type === 'call_back') {
    return {
      overdue_days: Math.max(0, daysSinceCreated - 0), // overdue same day if not actioned
      overdue_level: daysSinceCreated >= 2 ? 'critical' : daysSinceCreated >= 1 ? 'warning' : 'due_today'
    }
  }

  // For general items: overdue after 3 days
  return {
    overdue_days: Math.max(0, daysSinceCreated - 3),
    overdue_level: daysSinceCreated >= 5 ? 'critical' : daysSinceCreated >= 3 ? 'warning' : 'none'
  }
}
```

---

## PART 5: SIDEBAR BADGE UPDATE

Update the sidebar "Action Items" link to show:
- Count of open items
- Red badge if any items are overdue 2+ days
- Amber badge if any items are overdue 1 day
- Regular badge otherwise

```
⚡ Action Items  [🔴 3]    ← red because 3 items are overdue
```

---

## PART 6: FILE STRUCTURE

```
src/
├── app/
│   ├── api/
│   │   └── actions/
│   │       └── route.ts          # UPDATE — enhanced GET + PATCH
│   └── actions/
│       └── page.tsx              # REDESIGN — grouped layout with overdue
├── components/
│   ├── actions/
│   │   ├── ActionItemCard.tsx    # NEW — reusable card with lead context
│   │   ├── ActionSection.tsx     # NEW — section grouping (Call Back, Email, etc.)
│   │   └── OverdueBadge.tsx      # NEW — pulsing overdue indicator
│   └── leads/
│       └── FollowUpSection.tsx   # NEW — follow-up date/type/notes picker
├── app/
│   └── leads/
│       └── [id]/
│           └── page.tsx          # UPDATE — add FollowUpSection
```

---

## BUILD ORDER

1. Run migration 011 in Supabase SQL Editor
2. Update `/api/leads/[id]` PATCH to support follow_up fields
3. Create `FollowUpSection.tsx` component
4. Add FollowUpSection to lead detail page
5. Create `OverdueBadge.tsx` component
6. Create `ActionItemCard.tsx` component
7. Create `ActionSection.tsx` component
8. Update `/api/actions` GET with lead joins + overdue calculation
9. Update `/api/actions` PATCH with "complete" side effects (update lead last_contact)
10. Redesign `/actions/page.tsx` with grouped layout
11. Update Sidebar badge to show overdue status
12. Test: create a lead with a follow-up date in the past → verify overdue badge appears
13. Test: complete an action item → verify lead.last_contact_at updates
14. Push to GitHub

---

## TESTING CHECKLIST

- [ ] Migration runs without errors
- [ ] 10 email templates seeded
- [ ] Lead detail shows follow-up section
- [ ] Can set follow-up date, type, and notes
- [ ] Follow-up appears as badge on lead list
- [ ] Action items page loads with grouped sections
- [ ] Overdue items appear at top with red badge
- [ ] 1-day overdue shows amber warning
- [ ] 2+ day overdue shows red critical with pulsing badge
- [ ] Call button triggers tel: link
- [ ] "Done" button resolves item + updates lead.last_contact_at
- [ ] "Snooze" pushes date to tomorrow
- [ ] "Skip" dismisses the item
- [ ] Items persist across days (never auto-dismiss)
- [ ] Sidebar badge shows count + overdue color
- [ ] Location filter works
- [ ] Action type sections group correctly
- [ ] Lead context shows on cards (name, phone, source, stage)
- [ ] Empty state shows when no items exist

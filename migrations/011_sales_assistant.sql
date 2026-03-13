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
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'New Lead - Teen Program', 'new-lead-teen', 'Welcome to Jungle Driving School – Teen Driver Info', '<p>Hi {{lead_name}},</p><p>Thank you for your interest in our teen driving program!</p>', 'Hi {{lead_name}}, Thank you for your interest in our teen driving program!', 'new_lead', '{"source": ["meta", "google_ads"], "program_type": "teen"}', ARRAY['lead_name', 'location_name', 'location_phone']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'New Lead - Adult Lessons', 'new-lead-adult', 'Welcome to Jungle Driving School – Adult Lessons', '<p>Hi {{lead_name}},</p><p>Thanks for reaching out about adult driving lessons!</p>', 'Hi {{lead_name}}, Thanks for reaching out about adult driving lessons!', 'new_lead', '{"program_type": "adult"}', ARRAY['lead_name', 'location_name', 'location_phone']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'New Lead - Generic', 'new-lead-generic', 'Thanks for Your Interest – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Thank you for your interest in Jungle Driving School!</p>', 'Hi {{lead_name}}, Thank you for your interest!', 'new_lead', NULL, ARRAY['lead_name', 'location_name', 'location_phone']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Follow Up - After Quote', 'follow-up-after-quote', 'Following Up on Your Quote – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Following up on the pricing information we shared.</p>', 'Hi {{lead_name}}, Following up on the pricing info we shared.', 'follow_up', '{"stage": "quoted", "days_since_quote": [1, 3]}', ARRAY['lead_name', 'location_name', 'location_phone', 'season']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Follow Up - No Response 3 Day', 'follow-up-3-day', 'Just Checking In – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Just checking in!</p>', 'Hi {{lead_name}}, Just checking in.', 'follow_up', '{"days_since_contact": [3, 4]}', ARRAY['lead_name', 'location_name', 'location_phone']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Follow Up - No Response 7 Day', 'follow-up-7-day', 'Still Interested? – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Still thinking about driving lessons?</p>', 'Hi {{lead_name}}, Still interested?', 'follow_up', '{"days_since_contact": [7, 8]}', ARRAY['lead_name', 'location_name', 'location_phone']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Re-engagement - Gone Cold', 'reengagement-cold', 'We Miss You – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>It''s been a while!</p>', 'Hi {{lead_name}}, It''s been a while!', 'reengagement', '{"days_since_contact": [14, 30]}', ARRAY['lead_name', 'location_name', 'location_phone']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Post-Call - Recap & Next Steps', 'post-call-recap', 'Great Chatting With You! – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Great talking with you!</p>', 'Hi {{lead_name}}, Great talking with you!', 'post_call', '{"last_activity": "call_answered"}', ARRAY['lead_name', 'location_name', 'location_phone', 'call_notes']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Post-Call - Missed Call', 'post-call-missed', 'Sorry We Missed You! – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Sorry we missed your call!</p>', 'Hi {{lead_name}}, Sorry we missed your call!', 'post_call', '{"last_activity": "call_missed"}', ARRAY['lead_name', 'location_name', 'location_phone']),
('9a0d8a37-e9cf-4592-8b7d-e3762c243b0d', 'Welcome Back - Returning Interest', 'welcome-back', 'Welcome Back! – Jungle Driving School', '<p>Hi {{lead_name}},</p><p>Welcome back!</p>', 'Hi {{lead_name}}, Welcome back!', 'reengagement', '{"returning_lead": true}', ARRAY['lead_name', 'location_name', 'location_phone'])
ON CONFLICT DO NOTHING;

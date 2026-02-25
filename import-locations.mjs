#!/usr/bin/env node
/**
 * import-locations.mjs
 * 
 * Run from your jungle-dashboard project root:
 *   node import-locations.mjs
 * 
 * Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * Upserts 21 locations into the locations table, then populates dynamic field values.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ORG_ID = '9a0d8a37-e9cf-4592-8b7d-e3762c243b0d';

// ─── All 21 locations parsed from CSV ───
const LOCATIONS = [
  {
    location_number: "JUNGLE-120", name: "Coming soon", franchise_status: "basecamp",
    address: null, phone: null, email: "jungle120@jungledriving.com",
    franchise_owners: [{"name":"Jerome Reuben","phone":"","email":"jreuben@jungledriving.com"},{"name":"Lois Reuben","phone":"","email":"lreuben@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2026-02-24", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [], social_links: [], zip_codes: [], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: false }
  },
  {
    location_number: "JUNGLE-119", name: "West Des Moines", franchise_status: "basecamp",
    address: null, phone: null, email: "jungle119@jungledriving.com",
    franchise_owners: [{"name":"Michael Coleman","phone":"","email":"mcoleman@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2026-02-11", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [], social_links: [], zip_codes: ["50111, 50263, 50265, 50266, 50322, 50323, 50325"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: false }
  },
  {
    location_number: "JUNGLE-118", name: "East Cleveland", franchise_status: "basecamp",
    address: null, phone: null, email: "jungle118@jungledriving.com",
    franchise_owners: [{"name":"Jane Cronin","phone":"","email":"jcronin@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2026-01-16", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(330) 293-5196","lead_source":"Main Line"}], social_links: [], zip_codes: ["44056 44067 44087 44139 44202 44236 44241 44255","44221 44224 44240 44243 44262 44266 44278 44305 44310","44203 44223 44230 44281 44301 44302 44303 44304 44307 44308 44311 44313 44314 44320 44321 44333"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: false }
  },
  {
    location_number: "JUNGLE-117", name: "Plymouth, MI", franchise_status: "basecamp",
    address: null, phone: null, email: "jungle117@jungledriving.com",
    franchise_owners: [{"name":"Chris McCarel","phone":"","email":"cmccarel@jungledriving.com"},{"name":"Kathy McCarel","phone":"","email":"kmccarel@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2026-01-16", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [], social_links: [], zip_codes: [], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: false }
  },
  {
    location_number: "JUNGLE-116", name: "North Dallas (McKinney/Allen)", franchise_status: "deep_jungle",
    address: null, phone: null, email: "jungle116@jungledriving.com",
    franchise_owners: [{"name":"Vimalan Sukumar","phone":"","email":"vsukumar@jungledriving.com"},{"name":"Sreedharan Ramachandran","phone":"","email":"sramachandran@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-12-30", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [], social_links: [], zip_codes: ["75069","75071","75072","75454","75002","75013"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-115", name: "Cedar Rapids", franchise_status: "deep_jungle",
    address: "1850 Boyson Road Unit B, Hiawatha, IA 52233", phone: "(319) 900-5390", email: "jungle115@jungledriving.com",
    franchise_owners: [{"name":"Eric Conlon","phone":"","email":"econlon@jungledriving.com"},{"name":"Amy Conlon","phone":"","email":"aconlon@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-12-17", go_live_date: null, expedition_date: null, location_url: "https://jungledriving.com/ia/cedar-rapids/",
    _dynamic: { phone_numbers: [{"phone":"(319) 900-5390","lead_source":"Main Line"}], social_links: [], zip_codes: ["52227","52233","52302","52328","52401","52402","52403","52404","52405","52411","52499"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-114", name: "Columbus", franchise_status: "deep_jungle",
    address: "3582 Fishinger Rd, Hilliard, OH 43026", phone: "614-502-3521", email: "jungle114@jungledriving.com",
    franchise_owners: [{"name":"Matt Keves","phone":"","email":"mkeves@jungledriving.com"},{"name":"Laura Keves","phone":"","email":"lkeves@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-12-17", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"614-502-3521","lead_source":"Main Line"}], social_links: [], zip_codes: ["43004, 43015, 43016, 43017, 43021, 43026, 43035, 43040, 43054, 43061, 43064, 43065, 43074, 43077, 43081, 43082, 43085, 43201, 43202, 43203, 43210, 43211, 43212, 43214, 43215, 43219, 43220, 43221, 43224, 43229, 43230, 43231, 43235, 43240"], funding_source: "Self-funded", funding_type: null, preferred_area_code: "614", onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-113", name: "Tampa, FL", franchise_status: "deep_jungle",
    address: null, phone: null, email: "jungle113@jungledriving.com",
    franchise_owners: [{"name":"Dilip Singh","phone":"","email":"dsingh@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-12-12", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [], social_links: [], zip_codes: ["33510, 33511, 33527, 33567, 33584, 33594, 33596"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-112", name: "Denver", franchise_status: "deep_jungle",
    address: null, phone: "(303) 963-4366", email: "jungle112@jungledriving.com",
    franchise_owners: [{"name":"David Pollard","phone":"","email":"dpollard@jungledriving.com"},{"name":"Loleeta Pollard","phone":"","email":"lpollard@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-11-14", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(303) 963-4366","lead_source":"Main Line"}], social_links: [], zip_codes: ["80033, 80120, 80121, 80122, 80123, 80124, 80125, 80126, 80127, 80128, 80129, 80130, 80214, 80215, 80225, 80226, 80227, 80228, 80232, 80235, 80401, 80419, 80453, 80454, 80465"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-111", name: "Charlotte (Stutts)", franchise_status: "deep_jungle",
    address: null, phone: "(704) 368-3135", email: "jungle111@jungledriving.com",
    franchise_owners: [{"name":"Michael Stutts","phone":"","email":"mstutts@jungledriving.com"}],
    franchise_operator_name: "Jen Schroeder", franchise_operator_email: "jschroeder@jungledriving.com", franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-10-27", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(704) 368-3135","lead_source":"Main Line"}], social_links: [], zip_codes: ["28031","28036","28115","28117","28023","28081","28083","28088","28025","28027","28075","28078","28216","28269","28202","28203","28204","28206","28207","28208","28209","28214","28217","28273","28278"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-110", name: "Charlotte (Pelych)", franchise_status: "deep_jungle",
    address: null, phone: null, email: "jungle110@jungledriving.com",
    franchise_owners: [{"name":"Joe Pelych","phone":"","email":"jpelych@jungledriving.com"},{"name":"Nicki Toro","phone":"","email":"ntoro@jungledriving.com"}],
    franchise_operator_name: "Joe Pelych", franchise_operator_email: "jpelych@jungledriving.com", franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-10-27", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [], social_links: [], zip_codes: ["28134","28210","28211","28226","28270","28277","28104","28173","28079","28110"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-109", name: "Broken Arrow", franchise_status: "deep_jungle",
    address: null, phone: null, email: "jungle109@jungledriving.com",
    franchise_owners: [{"name":"Ron Burckhartzmeyer","phone":"","email":"rburckhartzmeyer@jungledriving.com"},{"name":"Paula Burckhartzmeyer","phone":"","email":"pburckhartzmeyer@jungledriving.com"}],
    franchise_operator_name: "Nate Burckhartzmeyer", franchise_operator_email: "nburckhartzmeyer@jungledriving.com", franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-10-17", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(918) 818-8551","lead_source":"Main Line"}], social_links: [], zip_codes: ["74011","74012","74014"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-108", name: "St. Louis", franchise_status: "deep_jungle",
    address: null, phone: "(314) 350-6237", email: "jungle108@jungledriving.com",
    franchise_owners: [{"name":"Shannon Terrill","phone":"","email":"sterrill@jungledriving.com"},{"name":"Ben Terrill","phone":"","email":"bterrill@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-10-17", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(314) 350-6237","lead_source":"Main Line"}], social_links: [], zip_codes: ["63005","63011","63017","63021","63038","63040","63105","63117","63119","63122","63124","63131","63141","63143","63144"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-107", name: "Charlotte", franchise_status: "deep_jungle",
    address: null, phone: "(704) 970-9702", email: "jungle107@jungledriving.com",
    franchise_owners: [{"name":"Jonathan Oliver","phone":"","email":"joliver@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-10-17", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(704) 318-4484","lead_source":"Main Line"}], social_links: [], zip_codes: ["28213","28215","28223","28262"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-106", name: "Southeast Las Vegas", franchise_status: "deep_jungle",
    address: null, phone: "(702) 723-9656", email: "jungle106@jungledriving.com",
    franchise_owners: [{"name":"Austin Stout","phone":"","email":"astout@jungledriving.com"}],
    franchise_operator_name: "Tara Stout", franchise_operator_email: "tstout@jungledriving.com", franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-09-24", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(702) 723-9656","lead_source":"Main Line"}], social_links: [], zip_codes: ["89044","89052","89123","89183"], funding_source: "Benetrends", funding_type: "SBA", preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-105", name: "West Cleveland", franchise_status: "deep_jungle",
    address: null, phone: "(216) 616-4174", email: "jungle105@jungledriving.com",
    franchise_owners: [{"name":"Jessica Leonard","phone":"(330) 465-0621","email":"jleonard@jungledriving.com"},{"name":"Joe Leonard","phone":"(330) 465-0621","email":""}],
    franchise_operator_name: "Jessica Leonard", franchise_operator_email: null, franchise_operator_phone: "(330) 465-0621",
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-08-22", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(216) 616-2533","lead_source":"GBP"},{"phone":"(216) 616-4174","lead_source":"Direct"},{"phone":"(216) 279-8011","lead_source":"Print"},{"phone":"(216) 616-2293","lead_source":"Vehicle Wrap"},{"phone":"(216) 859-4782","lead_source":"Yard Sign"}], social_links: [], zip_codes: ["44212","44233","44256","44280","44129","44130","44131","44133","44134","44136","44141","44147","44149","44262","44286","44102","44107","44109","44111","44113","44116","44126","44135","44142","44144","44011","44012","44017","44028","44039","44070","44138","44140","44145","44001","44035","44052","44053","44054","44055","44089"], funding_source: "Other", funding_type: "Cash", preferred_area_code: null, onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-104", name: "West El Paso", franchise_status: "open",
    address: "750 Sunland Park Dr. Suite HO6A  El Paso, TX 79912", phone: "(915) 900-4943", email: "jungle104@jungledriving.com",
    franchise_owners: [{"name":"Richie Hatch","phone":"(915) 307-0688","email":"rhatch@jungledriving.com"}],
    franchise_operator_name: "Richie Hatch", franchise_operator_email: "rhatch@jungledriving.com", franchise_operator_phone: "(915) 307-0688",
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-08-22", go_live_date: null, expedition_date: "2026-01-06", location_url: "https://jungledriving.com/tx/el-paso-west",
    _dynamic: { phone_numbers: [{"phone":"(915) 286-6211","lead_source":"GBP"},{"phone":"(915) 465-9355","lead_source":"Yard Sign"},{"phone":"(915) 221-9332","lead_source":"Vehicle Wrap"},{"phone":"(915) 900-4722","lead_source":"Print"},{"phone":"(915) 900-4943","lead_source":"Website"}], social_links: [{"platform":"Facebook","url":"https://www.facebook.com/JungleDrivingSchoolElPasoWest"},{"platform":"Instagram","url":"https://www.instagram.com/jungledriving.elpasowest/"}], zip_codes: ["79821","79835","79901","79902","79911","79912","79922","79932","79968"], funding_source: "Other", funding_type: "Cash", preferred_area_code: "915", onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-103", name: "Southeast Phoenix", franchise_status: "deep_jungle",
    address: null, phone: "(480) 520-3411", email: "jungle103@jungledriving.com",
    franchise_owners: [{"name":"Stephanie Bishop","phone":null,"email":"sbishop@jungledriving.com"},{"name":"Nick Bishop","phone":null,"email":"nbishop@jungledriving.com"},{"name":"Erica Bishop","phone":null,"email":"ebishop@jungledriving.com"}],
    franchise_operator_name: "Erica Bishop", franchise_operator_email: "ebishop@jungledriving.com", franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-07-25", go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [{"phone":"(480) 526-9720","lead_source":"GBP"},{"phone":"(480) 263-9302","lead_source":"Vehicle Wrap"},{"phone":"(480) 264-9028","lead_source":"Yard Sign"},{"phone":"(480) 520-3411","lead_source":"Website"},{"phone":"(480) 264-9120","lead_source":"Print"}], social_links: [], zip_codes: ["85224","85248","85249","85286","85295","85296","85212","85225","85236","85297","85298","85142"], funding_source: "FranFund", funding_type: "SBA", preferred_area_code: "480", onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-102", name: "Frisco", franchise_status: "deep_jungle",
    address: "9229 Lebanon Road, Frisco, TX 75035", phone: "(469) 640-3873", email: "jungle102@jungledriving.com",
    franchise_owners: [{"name":"Lauren Renaud","phone":null,"email":"lrenaud@jungledriving.com"},{"name":"Traviss Alexander","phone":null,"email":"talexander@jungledriving.com"}],
    franchise_operator_name: null, franchise_operator_email: null, franchise_operator_phone: null,
    assigned_support_partner: "Stacey Goodnight",
    sign_date: "2025-07-24", go_live_date: null, expedition_date: null, location_url: "https://jungledriving.com/tx/frisco/",
    _dynamic: { phone_numbers: [{"phone":"(469) 640-3873","lead_source":"Direct"},{"phone":"(469) 813-8769","lead_source":"Print"},{"phone":"(469) 575-9969","lead_source":"Vehicle Wrap"},{"phone":"(469) 632-8075","lead_source":"Yard Sign"},{"phone":"(469) 517-3423","lead_source":"GBP"}], social_links: [{"platform":"Facebook","url":"https://www.facebook.com/JungleDrivingSchoolFrisco"},{"platform":"Instagram","url":"https://www.instagram.com/jungledriving.frisco/"}], zip_codes: ["75033","75034","75036","75068","75035","75070","75009","75078","75227"], funding_source: null, funding_type: "SBA", preferred_area_code: "469", onboarding_started: true, deep_jungle_started: true }
  },
  {
    location_number: "JUNGLE-101", name: "Omaha", franchise_status: "open",
    address: "4020 S 147th St, Omaha, NE 68137", phone: "402-227-3777", email: "jungle101@jungledriving.com",
    franchise_owners: [{"name":"Zach Beutler","phone":"(402) 613-4686","email":"zbeutler@jungledriving.com"}],
    franchise_operator_name: "Darin Engelbart", franchise_operator_email: "dengelbart@jungledriving.com", franchise_operator_phone: null,
    assigned_support_partner: "Cheryl Price",
    sign_date: "2025-02-03", go_live_date: "2025-05-31", expedition_date: "2025-05-05", location_url: "https://jungledriving.com/ne/omaha",
    _dynamic: { phone_numbers: [{"phone":"402-581-9820","lead_source":"Yard Sign"},{"phone":"402-347-4513","lead_source":"Print"},{"phone":"402-227-3777","lead_source":"Website"},{"phone":"844-586-4535","lead_source":"Toll Free"},{"phone":"402-893-8283","lead_source":"Vehicle Wraps"},{"phone":"402-448-6037","lead_source":"Google Ads"},{"phone":"402-736-6932","lead_source":"Facebook Paid"}], social_links: [{"platform":"Facebook","url":"https://www.facebook.com/JungleDriving101"},{"platform":"Instagram","url":"https://www.instagram.com/jungledriving.omaha/"},{"platform":"TikTok","url":"https://www.tiktok.com/@jungledriving"}], zip_codes: ["68137","68130","68131","68135","68022","68116","68124","68114","68154","68164","68134","68106","68117"], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: true, deep_jungle_started: false }
  },
  {
    location_number: "JUNGLE-100", name: "Grand Rapids", franchise_status: "open",
    address: "6090 East Fulton #C, Ada, MI 49301", phone: "616-676-4600", email: "jungle100@jungledriving.com",
    franchise_owners: [{"name":"Fred Westdale","phone":"(616) 334-6688","email":"fwestdale@jungledriving.com"}],
    franchise_operator_name: "Fred Westdale", franchise_operator_email: "fwestdale@jungledriving.com", franchise_operator_phone: "(616) 334-6688",
    assigned_support_partner: "Cheryl Price",
    sign_date: null, go_live_date: null, expedition_date: null, location_url: null,
    _dynamic: { phone_numbers: [], social_links: [], zip_codes: [], funding_source: null, funding_type: null, preferred_area_code: null, onboarding_started: false, deep_jungle_started: false }
  },
];

// Dynamic field name → definition field_name mapping
const DYNAMIC_FIELD_MAP = {
  phone_numbers: 'phone_numbers',
  social_links: 'social_links',
  zip_codes: 'zip_codes',
  funding_source: 'funding_source',
  funding_type: 'funding_type',
  preferred_area_code: 'preferred_area_code',
  onboarding_started: 'onboarding_started',
  deep_jungle_started: 'deep_jungle_started',
};

async function run() {
  console.log(`\n🌿 JungleOS Location Import`);
  console.log(`   Importing ${LOCATIONS.length} locations...\n`);

  // Step 1: Check existing locations
  const { data: existing, error: fetchErr } = await supabase
    .from('locations')
    .select('id, location_number')
    .eq('organization_id', ORG_ID);

  if (fetchErr) {
    console.error('Failed to fetch existing locations:', fetchErr.message);
    process.exit(1);
  }

  const existingMap = {};
  (existing || []).forEach(l => { existingMap[l.location_number] = l.id; });
  console.log(`   Found ${existing?.length || 0} existing locations in database`);

  let inserted = 0, updated = 0, errors = 0;

  for (const loc of LOCATIONS) {
    const { _dynamic, ...coreFields } = loc;

    const slug = loc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); const record = { slug,
      organization_id: ORG_ID,
      ...coreFields,
    };

    let locationId;

    if (existingMap[loc.location_number]) {
      // UPDATE existing
      locationId = existingMap[loc.location_number];
      const { error } = await supabase
        .from('locations')
        .update(record)
        .eq('id', locationId);

      if (error) {
        console.error(`   ❌ ${loc.location_number} update failed:`, error.message);
        errors++;
        continue;
      }
      updated++;
      console.log(`   ✏️  ${loc.location_number} (${loc.name}) — updated`);
    } else {
      // INSERT new
      const { data, error } = await supabase
        .from('locations')
        .insert(record)
        .select('id')
        .single();

      if (error) {
        console.error(`   ❌ ${loc.location_number} insert failed:`, error.message);
        errors++;
        continue;
      }
      locationId = data.id;
      inserted++;
      console.log(`   ✅ ${loc.location_number} (${loc.name}) — inserted`);
    }

    // Step 2: Upsert dynamic field values
    if (_dynamic && locationId) {
      // Get field definitions
      const { data: fieldDefs } = await supabase
        .from('location_field_definitions')
        .select('id, field_name')
        .eq('organization_id', ORG_ID);

      const defMap = {};
      (fieldDefs || []).forEach(d => { defMap[d.field_name] = d.id; });

      for (const [key, value] of Object.entries(_dynamic)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (value === false) continue; // skip false booleans

        const defId = defMap[key];
        if (!defId) continue; // field definition doesn't exist yet

        const stringValue = typeof value === 'string' ? value
          : typeof value === 'boolean' ? String(value)
          : JSON.stringify(value);

        // Upsert: delete old value then insert new
        await supabase
          .from('location_field_values')
          .delete()
          .eq('location_id', locationId)
          .eq('field_definition_id', defId);

        const { error: valErr } = await supabase
          .from('location_field_values')
          .insert({
            location_id: locationId,
            field_definition_id: defId,
            value: stringValue,
          });

        if (valErr) {
          console.error(`      ⚠️  ${loc.location_number} field ${key} failed:`, valErr.message);
        }
      }
    }
  }

  console.log(`\n   ─────────────────────────────`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ✏️  Updated:  ${updated}`);
  if (errors) console.log(`   ❌ Errors:   ${errors}`);
  console.log(`   Total:      ${inserted + updated + errors} / ${LOCATIONS.length}`);
  console.log(`\n   Done! Check your dashboard at /manage\n`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

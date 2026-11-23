-- ============================================================================
-- Daak v2 — Bangladesh Synthetic Demo Dataset Seed
-- Migration: 20261123000200_seed_bangladesh_demo_data
-- ============================================================================

-- 1. Seed 8 Bangladesh Thanas (Police Stations)
INSERT INTO public.police_stations (id, name_en, name_bn, aliases, district, division, phone, location)
VALUES
  (
    '22222222-2222-4222-8222-222222222201',
    'Dhanmondi Model Police Station',
    'ধানমন্ডি মডেল থানা',
    ARRAY['dhanmondi', 'kalabagan', 'science lab', 'jigatola', 'ধানমন্ডি'],
    'Dhaka', 'Dhaka', '+8801320039660',
    ST_GeogFromText('SRID=4326;POINT(90.3742 23.7461)')
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    'Shahbagh Police Station',
    'শাহবাগ থানা',
    ARRAY['shahbagh', 'tsc', 'dhaka university', 'ramna', 'শাহবাগ'],
    'Dhaka', 'Dhaka', '+8801320039520',
    ST_GeogFromText('SRID=4326;POINT(90.3954 23.7385)')
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    'Mohammadpur Police Station',
    'মোহাম্মদপুর থানা',
    ARRAY['mohammadpur', 'bosila', 'adabor', 'lalmatia', 'মোহাম্মদপুর'],
    'Dhaka', 'Dhaka', '+8801320040800',
    ST_GeogFromText('SRID=4326;POINT(90.3587 23.7654)')
  ),
  (
    '22222222-2222-4222-8222-222222222204',
    'Mirpur Model Police Station',
    'মিরপুর মডেল থানা',
    ARRAY['mirpur', 'mirpur-10', 'mirpur 10', 'kazipara', 'shewrapara', 'মিরপুর'],
    'Dhaka', 'Dhaka', '+8801320041200',
    ST_GeogFromText('SRID=4326;POINT(90.3688 23.8069)')
  ),
  (
    '22222222-2222-4222-8222-222222222205',
    'Gulshan Police Station',
    'গুলশান থানা',
    ARRAY['gulshan', 'gulshan-2', 'banani', 'baridhara', 'গুলশান'],
    'Dhaka', 'Dhaka', '+8801320041000',
    ST_GeogFromText('SRID=4326;POINT(90.4152 23.7925)')
  ),
  (
    '22222222-2222-4222-8222-222222222206',
    'Uttara East Police Station',
    'উত্তরা পূর্ব থানা',
    ARRAY['uttara', 'uttara-7', 'azampur', 'airport', 'উত্তরা'],
    'Dhaka', 'Dhaka', '+8801320041900',
    ST_GeogFromText('SRID=4326;POINT(90.4005 23.8759)')
  ),
  (
    '22222222-2222-4222-8222-222222222207',
    'Motijheel Police Station',
    'মতিঝিল থানা',
    ARRAY['motijheel', 'dilkusha', 'kamalapur', 'paltan', 'মতিঝিল'],
    'Dhaka', 'Dhaka', '+8801320039740',
    ST_GeogFromText('SRID=4326;POINT(90.4173 23.7330)')
  ),
  (
    '22222222-2222-4222-8222-222222222208',
    'Kotwali Police Station, Chattogram',
    'কোতোয়ালী থানা, চট্টগ্রাম',
    ARRAY['chattogram', 'chittagong', 'kotwali', 'agrabad', 'চট্টগ্রাম'],
    'Chattogram', 'Chattogram', '+8801320053100',
    ST_GeogFromText('SRID=4326;POINT(91.8339 22.3384)')
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Seed 3 Demo Accounts in auth.users & public.profiles
-- Demo password across demo accounts: DaakDemo#2026 (only for synthetic demo roles)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111101',
    'authenticated', 'authenticated',
    'demo.citizen@daak.bd',
    extensions.crypt('DaakDemo#2026', extensions.gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Nadia Rahman"}'::jsonb,
    now() - interval '45 days', now(), false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111102',
    'authenticated', 'authenticated',
    'demo.police@daak.bd',
    extensions.crypt('DaakDemo#2026', extensions.gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"SI Tariqul Islam"}'::jsonb,
    now() - interval '90 days', now(), false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111103',
    'authenticated', 'authenticated',
    'demo.admin@daak.bd',
    extensions.crypt('DaakDemo#2026', extensions.gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Farhana Karim (Admin)"}'::jsonb,
    now() - interval '120 days', now(), false, false
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  (
    '11111111-1111-4111-8111-111111111101',
    '11111111-1111-4111-8111-111111111101',
    '{"sub":"11111111-1111-4111-8111-111111111101","email":"demo.citizen@daak.bd"}'::jsonb,
    'email', 'demo.citizen@daak.bd', now(), now(), now()
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    '11111111-1111-4111-8111-111111111102',
    '{"sub":"11111111-1111-4111-8111-111111111102","email":"demo.police@daak.bd"}'::jsonb,
    'email', 'demo.police@daak.bd', now(), now(), now()
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    '11111111-1111-4111-8111-111111111103',
    '{"sub":"11111111-1111-4111-8111-111111111103","email":"demo.admin@daak.bd"}'::jsonb,
    'email', 'demo.admin@daak.bd', now(), now(), now()
  )
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET
  full_name = 'Nadia Rahman',
  phone = '+8801711000101',
  role = 'citizen',
  credibility_score = 88,
  is_verified = true,
  is_demo_account = true,
  emergency_contacts = '[{"name":"Ahsan Rahman","phone":"+8801711000991","relation":"Brother"}]'::jsonb
WHERE id = '11111111-1111-4111-8111-111111111101';

UPDATE public.profiles
SET
  full_name = 'SI Tariqul Islam',
  phone = '+8801711000102',
  role = 'police',
  station_id = '22222222-2222-4222-8222-222222222201',
  credibility_score = 98,
  is_verified = true,
  is_demo_account = true
WHERE id = '11111111-1111-4111-8111-111111111102';

UPDATE public.profiles
SET
  full_name = 'Farhana Karim (Admin)',
  phone = '+8801711000103',
  role = 'admin',
  credibility_score = 100,
  is_verified = true,
  is_demo_account = true
WHERE id = '11111111-1111-4111-8111-111111111103';

-- 3. Seed 8 Synthetic Dhaka Reports
INSERT INTO public.reports (
  id, reporter_id, is_anonymous_public, category, severity, title, description,
  area_name, address_text, location, occurred_at, status, corroboration_count,
  suspicion_score, flag_status, suspicion_reasons
)
VALUES
  (
    '33333333-3333-4333-8333-333333333301',
    '11111111-1111-4111-8111-111111111101',
    true, 'snatching', 'high',
    'Phone snatching near Kalabagan footover bridge',
    'Two riders on a dark motorcycle snatched a commuter phone near the east stair exit and sped toward Science Lab.',
    'Dhanmondi', 'Kalabagan Bus Stand, Mirpur Road',
    ST_GeogFromText('SRID=4326;POINT(90.3806 23.7495)'),
    now() - interval '35 minutes', 'verified', 2, 8, 'none', '[]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333302',
    '11111111-1111-4111-8111-111111111101',
    false, 'traffic_hazard', 'medium',
    'Streetlights out along Dhanmondi Road 27 north lane',
    'Three consecutive lamp posts are dark near the lake turnoff creating blind spots for pedestrians at night.',
    'Dhanmondi', 'Road 27, Dhanmondi',
    ST_GeogFromText('SRID=4326;POINT(90.3735 23.7512)'),
    now() - interval '3 hours', 'resolved', 1, 5, 'none', '[]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333303',
    '11111111-1111-4111-8111-111111111101',
    true, 'harassment', 'high',
    'Repeated evening harassment outside Mirpur-10 metro exit',
    'Group blocking the footpath near Gate B harassing students returning from coaching after 20:00.',
    'Mirpur-10', 'Metro Rail Station Gate B, Mirpur-10',
    ST_GeogFromText('SRID=4326;POINT(90.3690 23.8072)'),
    now() - interval '2 hours', 'investigating', 3, 10, 'none', '[]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333304',
    '11111111-1111-4111-8111-111111111101',
    false, 'theft', 'medium',
    'Locked bicycle stolen outside TSC library rack',
    'Cable lock cut between 18:30 and 19:15 near the Dhaka University TSC south gate.',
    'Shahbagh', 'TSC South Gate, Dhaka University',
    ST_GeogFromText('SRID=4326;POINT(90.3958 23.7329)'),
    now() - interval '1 day', 'resolved', 0, 12, 'none', '[]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333305',
    '11111111-1111-4111-8111-111111111101',
    false, 'fraud', 'medium',
    'Fake bKash agent kiosk targeting commuters at Uttara Azampur',
    'Unlicensed mobile-money booth attempting PIN social engineering near Azampur footover.',
    'Uttara', 'Azampur Bus Stop, Uttara Sector 7',
    ST_GeogFromText('SRID=4326;POINT(90.4008 23.8686)'),
    now() - interval '6 hours', 'verified', 1, 14, 'none', '[]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333306',
    '11111111-1111-4111-8111-111111111101',
    false, 'suspicious_activity', 'low',
    'Unattended bag reported near Gulshan-2 circle',
    'Security patrol inspected and confirmed lost luggage returned to owner.',
    'Gulshan', 'Gulshan-2 Circle South',
    ST_GeogFromText('SRID=4326;POINT(90.4148 23.7945)'),
    now() - interval '2 days', 'resolved', 0, 6, 'none', '[]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333307',
    '11111111-1111-4111-8111-111111111101',
    false, 'vandalism', 'low',
    'Test spam report click link http://bit.ly/fake-promo',
    'test test urgent free reward click link now',
    'Mohammadpur', 'Town Hall Market',
    ST_GeogFromText('SRID=4326;POINT(90.3636 23.7638)'),
    now() - interval '50 minutes', 'pending', 0, 84, 'flagged',
    '["Suspicious promotional link or test keyword detected","Short generic description"]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333308',
    '11111111-1111-4111-8111-111111111101',
    false, 'snatching', 'high',
    'Duplicate unverified snatching claim near Town Hall',
    'Same incident copy pasted multiple times without clear landmark details.',
    'Mohammadpur', 'Town Hall Corner',
    ST_GeogFromText('SRID=4326;POINT(90.3638 23.7640)'),
    now() - interval '42 minutes', 'pending', 0, 72, 'flagged',
    '["Near-duplicate spatial and category report within 60 minutes","Rapid submission pattern"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Corroborations & Tips
INSERT INTO public.report_corroborations (id, report_id, user_id, user_location, distance_meters, note)
VALUES
  (
    '44444444-4444-4444-8444-444444444401',
    '33333333-3333-4333-8333-333333333301',
    '11111111-1111-4111-8111-111111111102',
    ST_GeogFromText('SRID=4326;POINT(90.3812 23.7488)'),
    98.5, 'Patrol unit confirmed eyewitness accounts at Kalabagan.'
  )
ON CONFLICT (report_id, user_id) DO NOTHING;

INSERT INTO public.report_tips (id, report_id, author_id, is_anonymous_public, body)
VALUES
  (
    '55555555-5555-4555-8555-555555555501',
    '33333333-3333-4333-8333-333333333301',
    '11111111-1111-4111-8111-111111111101',
    true, 'Bike had no rear license plate and headed toward Green Road.'
  ),
  (
    '55555555-5555-4555-8555-555555555502',
    '33333333-3333-4333-8333-333333333303',
    '11111111-1111-4111-8111-111111111102',
    false, 'Mirpur patrol team stationed at Gate B from 19:30 to 23:00.'
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Seed 3 Distress Signals & 1 Active Safe Walk
INSERT INTO public.distress_signals (
  id, user_id, trigger_source, location, area_name, battery_level, note,
  status, claimed_by, assigned_unit, triggered_at, claimed_at, sla_target_seconds, dispatch_timeline
)
VALUES
  (
    '66666666-6666-4666-8666-666666666601',
    '11111111-1111-4111-8111-111111111101',
    'panic_button',
    ST_GeogFromText('SRID=4326;POINT(90.3692 23.8065)'),
    'Mirpur-10', 34, 'Followed near metro pillar 254, need assistance.',
    'active', NULL, NULL,
    now() - interval '2 minutes 20 seconds', NULL, 300,
    '[{"status":"active","note":"Panic SOS triggered by citizen (Demo Simulated 999 Relay)"}]'::jsonb
  ),
  (
    '66666666-6666-4666-8666-666666666602',
    '11111111-1111-4111-8111-111111111101',
    'panic_button',
    ST_GeogFromText('SRID=4326;POINT(90.3755 23.7448)'),
    'Dhanmondi', 61, 'Altercation outside shopping complex gate.',
    'claimed', '11111111-1111-4111-8111-111111111102', 'Dhanmondi Patrol-04',
    now() - interval '6 minutes 15 seconds', now() - interval '4 minutes', 300,
    '[{"status":"active","note":"Panic SOS triggered"},{"status":"claimed","note":"Claimed by SI Tariqul Islam — Dhanmondi Patrol-04 assigned"}]'::jsonb
  ),
  (
    '66666666-6666-4666-8666-666666666603',
    '11111111-1111-4111-8111-111111111101',
    'safe_walk_timeout',
    ST_GeogFromText('SRID=4326;POINT(90.4012 23.8721)'),
    'Uttara Sector 7', 19, 'Safe Walk check-in missed past ETA.',
    'responding', '11111111-1111-4111-8111-111111111102', 'Uttara Mobile-02',
    now() - interval '11 minutes 10 seconds', now() - interval '8 minutes', 300,
    '[{"status":"active","note":"Auto-escalated from Safe Walk timer"},{"status":"responding","note":"Uttara Mobile-02 en route"}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.safe_walks (
  id, user_id, destination_name, destination_location, last_known_location,
  expected_arrival_at, status
)
VALUES
  (
    '77777777-7777-4777-8777-777777777701',
    '11111111-1111-4111-8111-111111111101',
    'TSC, Dhaka University',
    ST_GeogFromText('SRID=4326;POINT(90.3954 23.7324)'),
    ST_GeogFromText('SRID=4326;POINT(90.3821 23.7420)'),
    now() + interval '18 minutes',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Shift Handovers, Criminals & Activity Logs
INSERT INTO public.shift_handovers (id, outgoing_officer_id, station_id, shift_label, summary, open_sos_ids, priority_areas)
VALUES
  (
    '88888888-8888-4888-8888-888888888801',
    '11111111-1111-4111-8111-111111111102',
    '22222222-2222-4222-8222-222222222201',
    'Day -> Evening Shift (14:00–22:00)',
    'Increased motorcycle snatching reports around Kalabagan footover and Mirpur-10 Gate B. Keep Patrol-04 near Road 27.',
    ARRAY['66666666-6666-4666-8666-666666666601'::uuid, '66666666-6666-4666-8666-666666666602'::uuid],
    ARRAY['Dhanmondi', 'Mirpur-10', 'Uttara']
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.criminals (id, full_name, aliases, crime_categories, risk_level, last_known_area, last_known_location, status, details, created_by)
VALUES
  (
    '99999999-9999-4999-8999-999999999901',
    'Kamrul Hasan (Synthetic Demo)',
    ARRAY['Kala Kamrul'],
    ARRAY['snatching', 'theft'],
    'high', 'Kalabagan / Dhanmondi',
    ST_GeogFromText('SRID=4326;POINT(90.3802 23.7491)'),
    'wanted',
    'Synthetic demo watchlist entry linked to motorcycle snatching cluster near Mirpur Road.',
    '11111111-1111-4111-8111-111111111103'
  ),
  (
    '99999999-9999-4999-8999-999999999902',
    'Sajib Mia (Synthetic Demo)',
    ARRAY['Sajib'],
    ARRAY['fraud'],
    'medium', 'Uttara Azampur',
    ST_GeogFromText('SRID=4326;POINT(90.4009 23.8688)'),
    'wanted',
    'Synthetic demo entry for mobile financial service impersonation.',
    '11111111-1111-4111-8111-111111111103'
  ),
  (
    '99999999-9999-4999-8999-999999999903',
    'Rashedul Alam (Synthetic Demo)',
    ARRAY['Rashed'],
    ARRAY['assault', 'harassment'],
    'critical', 'Mirpur-10',
    ST_GeogFromText('SRID=4326;POINT(90.3691 23.8070)'),
    'in_custody',
    'Synthetic demo entry — apprehended during Mirpur-10 patrol sweep.',
    '11111111-1111-4111-8111-111111111103'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_logs (id, actor_id, actor_role, action, target_type, target_id, metadata)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    '11111111-1111-4111-8111-111111111102', 'police', 'sos.claimed', 'distress_signals',
    '66666666-6666-4666-8666-666666666602', '{"assigned_unit":"Dhanmondi Patrol-04"}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
    '11111111-1111-4111-8111-111111111103', 'admin', 'report.flagged', 'reports',
    '33333333-3333-4333-8333-333333333307', '{"suspicion_score":84}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

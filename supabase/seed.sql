-- Jur'ah demo seed — sample data only. Kuwaiti names, real medicine names,
-- invented civil IDs. Runs through the normal tables so the audit trail shows
-- history from day one (actor 'system'). Idempotent: skips if already seeded.
--
-- Accounts come from scripts/seed-auth.ts (the only script with the service
-- role key); this file finds them by email in auth.users.
--
-- Apply:  Supabase SQL editor / MCP execute_sql, as postgres.

do $$
declare
  dr_noura uuid;  -- doctor, linked to Fahad and Mariam
  fahad    uuid;  -- the demo patient: a week of history, the cross-clinic clash
  mariam   uuid;  -- warfarin: the time-critical refusal
  yousef   uuid;  -- not linked to any doctor
  today    date := (now() at time zone 'Asia/Kuwait')::date;
begin
  select id into dr_noura from auth.users where email = 'dr.noura.alsabah@example.com';
  select id into fahad    from auth.users where email = 'fahad.alkandari@example.com';
  select id into mariam   from auth.users where email = 'mariam.alrashidi@example.com';
  select id into yousef   from auth.users where email = 'yousef.alenezi@example.com';
  if dr_noura is null or fahad is null or mariam is null or yousef is null then
    raise exception 'demo accounts missing — run scripts/seed-auth.ts first';
  end if;
  if exists (select 1 from prescriptions where patient_id = fahad) then
    raise notice 'prescriptions already seeded — skipping';
    return;
  end if;

  -- ---------------------------------------------------------------- Fahad --
  -- 1 · imported from a PUBLIC hospital, no doctor in this system (D21)
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (fahad, null, 'levothyroxine', 'Euthyrox', 100, 'mcg', 1, 1, 90, 'daily', today - 30,
    'قبل الفطور بنصف ساعة · 30 min before breakfast', 'oral', 'Hypothyroidism',
    100, 100, today - 30, 'Euthyrox 100', 'imported', 'Mubarak Al-Kabeer Hospital', 'public');

  -- 2 · entered by the patient from a PRIVATE hospital — clashes with #1 (4 h apart, G4)
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (fahad, null, 'ferrous sulfate', 'Ferro-Gradumet', 325, 'mg', 1, 1, 30, 'daily', today - 10,
    'مع الطعام · with food', 'oral', 'Iron-deficiency anaemia',
    30, 30, today - 10, 'Ferro-Gradumet', 'patient_entered', 'Dar Al Shifa Hospital', 'private');

  -- 3 · written in Jur'ah by Dr Noura (jurah_doctor) — the D15 rescheduling example
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (fahad, dr_noura, 'metformin', 'Glucophage', 500, 'mg', 1, 2, 90, 'daily', today - 14,
    'مع الوجبات · with meals', 'oral', 'Type 2 diabetes',
    60, 180, today - 14, 'Glucophage 500', 'jurah_doctor', 'Al-Sabah Hospital', 'public');

  -- 4 · imported, public
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (fahad, null, 'atorvastatin', 'Lipitor', 20, 'mg', 1, 1, 90, 'daily', today - 30,
    'في المساء · in the evening', 'oral', 'High cholesterol',
    30, 90, today - 30, 'Lipitor 20', 'imported', 'Al-Sabah Hospital', 'public');

  -- --------------------------------------------------------------- Mariam --
  -- 5 · warfarin — time-critical (G5): the agent always refuses and alerts the doctor
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (mariam, null, 'warfarin', 'Marevan', 5, 'mg', 1, 1, 30, 'daily', today - 20,
    'في نفس الوقت كل يوم · same time every day', 'oral', 'Atrial fibrillation',
    28, 30, today - 20, 'Marevan 5', 'imported', 'Al-Adan Hospital', 'public');

  -- 6 · patient-entered, private, three times a day, short course
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (mariam, null, 'amoxicillin', 'Amoxil', 500, 'mg', 1, 3, 7, 'daily', today - 3,
    null, 'oral', 'Chest infection',
    21, 21, today - 3, 'Amoxil 500', 'patient_entered', 'Royale Hayat Hospital', 'private');

  -- 7 · written in Jur'ah by Dr Noura
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (mariam, dr_noura, 'omeprazole', 'Losec', 20, 'mg', 1, 1, 28, 'daily', today - 7,
    'قبل الفطور · before breakfast', 'oral', 'Gastric protection',
    28, 28, today - 7, 'Losec 20', 'jurah_doctor', 'Al-Sabah Hospital', 'public');

  -- --------------------------------------------------------------- Yousef --
  -- 8 · imported, public; Yousef has no doctor linked in Jur'ah
  insert into prescriptions (patient_id, doctor_id, drug_name_generic, drug_name_brand, strength_value, strength_unit,
    dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication,
    units_per_package, total_quantity_dispensed, dispense_date, brand_dispensed, source, source_facility, source_sector)
  values (yousef, null, 'amlodipine', 'Norvasc', 5, 'mg', 1, 1, 90, 'daily', today - 30,
    null, 'oral', 'High blood pressure',
    30, 90, today - 30, 'Norvasc 5', 'imported', 'Mubarak Al-Kabeer Hospital', 'public');
end $$;

-- ----------------------------------------------------- dose history --------
-- Every dose more than two hours in the past gets an answer: mostly taken, a
-- few skipped, a few missed. Deterministic, so the demo is the same every time.
with past as (
  select d.id, d.scheduled_at, row_number() over (order by d.scheduled_at, d.id) as rn
  from doses d
  where d.status = 'due' and d.scheduled_at < now() - interval '2 hours'
)
update doses set
  status = case when past.rn % 11 = 0 then 'missed'
                when past.rn % 11 = 4 then 'skipped'
                else 'taken' end::dose_status,
  answered_at = case when past.rn % 11 = 0 then null
                     else past.scheduled_at + ((past.rn % 41) || ' minutes')::interval end
from past
where doses.id = past.id;

-- Fahad's 08:00 metformin today is the dose the agent will be asked about.
update doses d set status = 'missed', answered_at = null
from prescriptions p
join auth.users u on u.id = p.patient_id
where d.prescription_id = p.id
  and u.email = 'fahad.alkandari@example.com'
  and p.drug_name_generic = 'metformin'
  and (d.scheduled_at at time zone 'Asia/Kuwait')::date = (now() at time zone 'Asia/Kuwait')::date
  and (d.scheduled_at at time zone 'Asia/Kuwait')::time = '08:00'
  and d.scheduled_at < now();

-- ----------------------------------------------- reference: medications ----
-- 25 medicines, all verified (hand-seeded rows count as verified, D12), every
-- value with its source in `justification`. Sample data — see the safety line.
insert into medications (ingredient, is_time_critical, catch_up_window_h, min_gap_h, verification, verified_at, justification) values
('levothyroxine',      false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS, Defining time critical medicines — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS missed doses — default 2 h (G2)"},"min_gap_h":{"value":20,"source":"once daily; NHS SPS never double dose (G1)"}}'),
('ferrous sulfate',    false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS, Defining time critical medicines — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h (G2)"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('metformin',          false, null, 8,  'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h; twice daily so G3 applies past 2 h"},"min_gap_h":{"value":8,"source":"twice daily; G1"}}'),
('atorvastatin',       false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('warfarin',           true,  null, 20, 'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS, Defining time critical medicines — anticoagulants; RCEM MISSED"},"catch_up_window_h":{"value":null,"source":"G5: never rescheduled automatically; G6: same day before midnight is a referral, not an auto-move"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('amoxicillin',        false, null, 4,  'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h; three times daily so G3 refuses past 2 h"},"min_gap_h":{"value":4,"source":"three times daily; G1"}}'),
('omeprazole',         false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('amlodipine',         false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('insulin glargine',   true,  null, 20, 'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS, Defining time critical medicines — insulin; RCEM MISSED"},"catch_up_window_h":{"value":null,"source":"G5/G6: refer to the specialist, never auto-reschedule"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('levodopa',           true,  null, 3,  'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS, Defining time critical medicines — Parkinson''s; RCEM MISSED"},"catch_up_window_h":{"value":null,"source":"G6: take immediately on remembering — refer, do not reschedule"},"min_gap_h":{"value":3,"source":"typically 3–4 times daily; G1"}}'),
('digoxin',            true,  null, 20, 'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS — narrow therapeutic index"},"catch_up_window_h":{"value":null,"source":"G5"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('lithium',            true,  null, 8,  'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS — narrow therapeutic index"},"catch_up_window_h":{"value":null,"source":"G5"},"min_gap_h":{"value":8,"source":"twice daily; G1"}}'),
('apixaban',           true,  null, 8,  'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS, Defining time critical medicines — DOACs"},"catch_up_window_h":{"value":null,"source":"G5"},"min_gap_h":{"value":8,"source":"twice daily; G1"}}'),
('sodium valproate',   true,  6,    8,  'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS — anti-seizure medicines; RCEM MISSED"},"catch_up_window_h":{"value":6,"source":"NHS SPS missed doses — anti-seizure twice daily: within 6 h (G6); still G5 so the agent refers"},"min_gap_h":{"value":8,"source":"twice daily; G1"}}'),
('lamotrigine',        true,  6,    8,  'verified', now(), '{"is_time_critical":{"value":true,"source":"NHS SPS — anti-seizure medicines"},"catch_up_window_h":{"value":6,"source":"NHS SPS — anti-seizure twice daily: within 6 h (G6)"},"min_gap_h":{"value":8,"source":"twice daily; G1"}}'),
('methotrexate',       false, 48,   144,'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not time critical but weekly"},"catch_up_window_h":{"value":48,"source":"NHS SPS missed doses — weekly methotrexate within 2–3 days, otherwise skip (G6)"},"min_gap_h":{"value":144,"source":"weekly; G1"}}'),
('calcium carbonate',  false, null, 8,  'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":8,"source":"twice daily; G1"}}'),
('doxycycline',        false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('ciprofloxacin',      false, null, 8,  'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":8,"source":"twice daily; G1"}}'),
('aspirin',            false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('clopidogrel',        false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('lisinopril',         false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily; G1"}}'),
('salbutamol',         false, null, 4,  'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed; as needed"},"catch_up_window_h":{"value":null,"source":"as-needed inhaler — no scheduled catch-up"},"min_gap_h":{"value":4,"source":"BNF: up to four times daily; G1"}}'),
('prednisolone',       false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily in the morning; G1"}}'),
('simvastatin',        false, null, 20, 'verified', now(), '{"is_time_critical":{"value":false,"source":"NHS SPS — not listed"},"catch_up_window_h":{"value":null,"source":"NHS SPS default 2 h"},"min_gap_h":{"value":20,"source":"once daily at night; G1"}}')
on conflict (ingredient) do nothing;

-- ---------------------------------------------- reference: interactions ----
-- 25 pairs that must be kept hours apart, each with its named source (G4, D27).
insert into interactions (ingredient_a, ingredient_b, min_hours_apart, source) values
('levothyroxine',   'ferrous sulfate',     4,   'Patient.info — Iron and levothyroxine interaction'),
('levothyroxine',   'calcium carbonate',   4,   'Drugs.com interaction monograph — levothyroxine and calcium carbonate'),
('levothyroxine',   'aluminium hydroxide', 4,   'Drugs.com interaction monograph — levothyroxine and antacids'),
('levothyroxine',   'colestyramine',       4,   'Drugs.com interaction monograph — levothyroxine and cholestyramine'),
('levothyroxine',   'sucralfate',          4,   'Drugs.com interaction monograph — levothyroxine and sucralfate'),
('doxycycline',     'calcium carbonate',   3,   'Drugs.com interaction monograph — tetracyclines and calcium'),
('doxycycline',     'ferrous sulfate',     3,   'Drugs.com interaction monograph — tetracyclines and iron'),
('doxycycline',     'aluminium hydroxide', 3,   'Drugs.com interaction monograph — tetracyclines and antacids'),
('doxycycline',     'zinc sulfate',        3,   'Drugs.com interaction monograph — tetracyclines and zinc'),
('ciprofloxacin',   'calcium carbonate',   2,   'Drugs.com interaction monograph — fluoroquinolones and calcium'),
('ciprofloxacin',   'ferrous sulfate',     2,   'Drugs.com interaction monograph — fluoroquinolones and iron'),
('ciprofloxacin',   'aluminium hydroxide', 2,   'Drugs.com interaction monograph — fluoroquinolones and antacids'),
('ciprofloxacin',   'zinc sulfate',        2,   'Drugs.com interaction monograph — fluoroquinolones and zinc'),
('ciprofloxacin',   'sucralfate',          2,   'Drugs.com interaction monograph — ciprofloxacin and sucralfate'),
('ferrous sulfate', 'calcium carbonate',   2,   'Drugs.com interaction monograph — iron and calcium'),
('ferrous sulfate', 'zinc sulfate',        2,   'Drugs.com interaction monograph — iron and zinc'),
('alendronic acid', 'calcium carbonate',   0.5, 'Drugs.com interaction monograph — alendronate: 30 minutes before other medicines'),
('alendronic acid', 'ferrous sulfate',     0.5, 'Drugs.com interaction monograph — alendronate and iron'),
('mycophenolate',   'aluminium hydroxide', 2,   'Drugs.com interaction monograph — mycophenolate and antacids'),
('mycophenolate',   'ferrous sulfate',     2,   'Drugs.com interaction monograph — mycophenolate and iron'),
('colestyramine',   'digoxin',             4,   'Drugs.com interaction monograph — cholestyramine and digoxin'),
('colestyramine',   'warfarin',            4,   'Drugs.com interaction monograph — cholestyramine and warfarin'),
('sucralfate',      'digoxin',             2,   'Drugs.com interaction monograph — sucralfate and digoxin'),
('sucralfate',      'warfarin',            2,   'Drugs.com interaction monograph — sucralfate and warfarin'),
('omeprazole',      'levothyroxine',       4,   'Drugs.com interaction monograph — proton pump inhibitors and levothyroxine absorption')
on conflict (ingredient_a, ingredient_b) do nothing;

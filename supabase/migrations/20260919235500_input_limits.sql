-- Jur'ah — SE-5: every input checked before it is used.
-- Lane A. Mirrors src/lib/validation/limits.ts constant for constant.
--
-- Why this exists. Zod guards the forms, and that is the half the person sees.
-- It is not the half that holds. `signUp` carries `full_name` and `civil_id`
-- through `raw_user_meta_data`, and the anon key ships inside the browser, so
-- this reaches the database without rendering a single form:
--
--   supabase.auth.signUp({ email, password, options: { data: {
--     full_name: 'x'.repeat(5000), civil_id: 'x'.repeat(5000) } } })
--
-- `handle_new_user()` copied both straight into `profiles`, and every text
-- column in 20260919120000_init.sql is unbounded. SE-5 says the check happens
-- before the value is used; the database is where it is used.
--
-- Numbers are generous on purpose — a real Kuwaiti name, a real clinic name and
-- a real note all fit. These refuse abuse, not use.

-- ==================================================== 1. text length ========

alter table profiles
  add constraint profiles_full_name_len check (char_length(full_name) between 2 and 80),
  add constraint profiles_civil_id_format check (civil_id is null or civil_id ~ '^\d{12}$');

alter table prescriptions
  add constraint rx_generic_len    check (char_length(drug_name_generic) between 1 and 120),
  add constraint rx_brand_len      check (drug_name_brand  is null or char_length(drug_name_brand)  <= 120),
  add constraint rx_food_len       check (food_timing      is null or char_length(food_timing)      <= 80),
  add constraint rx_indication_len check (indication       is null or char_length(indication)       <= 200),
  add constraint rx_notes_len      check (notes            is null or char_length(notes)            <= 1000),
  add constraint rx_facility_len   check (source_facility  is null or char_length(source_facility)  <= 120),
  add constraint rx_brand_disp_len check (brand_dispensed  is null or char_length(brand_dispensed)  <= 120);

alter table prescription_drafts
  add constraint draft_source_image_len check (source_image is null or char_length(source_image) <= 500);

alter table medications
  add constraint med_ingredient_len check (char_length(ingredient) between 1 and 120);

alter table interactions
  add constraint ix_ingredient_a_len check (char_length(ingredient_a) between 1 and 120),
  add constraint ix_ingredient_b_len check (char_length(ingredient_b) between 1 and 120),
  add constraint ix_source_len       check (char_length(source)       between 1 and 200);

alter table alerts
  add constraint alert_guardrail_len check (char_length(guardrail) between 1 and 80),
  add constraint alert_reason_len    check (char_length(reason)     between 1 and 500);

-- Written by the audit trigger, not by a person, but an unbounded text column
-- reachable from a jsonb payload is still an unbounded text column.
alter table audit_log
  add constraint audit_table_name_len check (char_length(table_name) between 1 and 63);

-- ================================================ 2. numeric ceilings =======
-- init.sql already refuses zero and negatives. These refuse the fat finger:
-- a dose of 500000 is a typo, and it is the kind of typo that matters here.

alter table prescriptions
  add constraint rx_strength_max  check (strength_value          <= 100000),
  add constraint rx_dose_max      check (dose_per_administration <= 1000),
  add constraint rx_units_max     check (units_per_package        is null or units_per_package        <= 10000),
  add constraint rx_dispensed_max check (total_quantity_dispensed is null or total_quantity_dispensed <= 100000);

-- ============================================= 3. the metadata path =========
-- The constraints above already refuse the oversized row. This makes the
-- refusal deliberate and legible instead of a constraint name, and keeps the
-- trigger from being the one place attacker-controlled text is trusted.
--
-- The role stays hard-coded to 'patient'. raw_user_meta_data is filled by
-- whoever calls signUp, so reading a role out of it would let anyone sign up as
-- a doctor.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name  text := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  v_civil text := nullif(trim(new.raw_user_meta_data->>'civil_id'), '');
begin
  if v_name is null then
    -- Derived, not supplied: make it safe rather than refuse a valid signup.
    -- A one-character local part ('a@example.com') is legal and must not 500.
    v_name := left(split_part(new.email, '@', 1), 80);
    if char_length(v_name) < 2 then
      v_name := 'Patient';
    end if;
  elsif char_length(v_name) not between 2 and 80 then
    raise exception
      'full_name must be between 2 and 80 characters, got %', char_length(v_name)
      using errcode = 'check_violation';
  end if;

  if v_civil is not null and v_civil !~ '^\d{12}$' then
    raise exception 'civil_id must be exactly 12 digits'
      using errcode = 'check_violation';
  end if;

  -- `profiles.civil_id` is UNIQUE. A second signup reusing a civil ID raises
  -- 23505 out of this trigger, and Supabase Auth reports every trigger failure
  -- to the browser as the same opaque "Database error saving new user" — which
  -- says nothing about which field is wrong and sends people hunting through
  -- the email settings.
  --
  -- We cannot hand the browser a better sentence from in here; Auth swallows
  -- it. What we CAN do is stop guessing when it happens: this message lands in
  -- the Postgres logs naming the field, so the next person reads one log line
  -- instead of bisecting a signup form.
  --
  -- Deliberately NOT solved with a "is this civil ID free?" RPC. That endpoint
  -- would answer for anyone holding the anon key, which is an enumeration
  -- oracle over who is registered — exactly what technical-plan §9 forbids for
  -- the doctor's patient lookup, for the same reason.
  begin
    insert into profiles (id, role, full_name, civil_id)
    values (new.id, 'patient', v_name, v_civil);
  exception when unique_violation then
    raise exception
      'civil_id % is already registered to another account', v_civil
      using errcode = 'unique_violation';
  end;

  return new;
end $$;

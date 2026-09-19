-- Security advisor: security definer functions were executable via /rest/v1/rpc
-- by anon and authenticated. Nobody calls a trigger function that way. Triggers
-- still fire — Postgres does not check EXECUTE on the trigger function for the
-- firing user. is_doctor, is_linked_doctor and generate_doses stay executable
-- by authenticated because policies and the schedule trigger call them as the user.
revoke execute on all functions in schema public from anon, public;
revoke execute on function audit_row()                from authenticated;
revoke execute on function audit_reference_row()      from authenticated;
revoke execute on function handle_new_user()          from authenticated;
revoke execute on function generate_doses_on_insert() from authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Performance advisor: unindexed foreign key
create index on alerts (acknowledged_by);

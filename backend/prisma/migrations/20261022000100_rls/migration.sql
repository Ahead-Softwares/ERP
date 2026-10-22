-- Row-level security for tenant tables (LLD §3.2).
-- The API connects as the database owner (BYPASSRLS) and, inside every tenant
-- transaction, runs `SET LOCAL ROLE app_user` + `set_config('app.tenant_id', ..., true)`.
-- app_user has no BYPASSRLS, so the policies below always apply to tenant work.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

GRANT app_user TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO app_user;

-- NULL when no tenant is set, so queries return nothing (fail closed)
CREATE OR REPLACE FUNCTION app_tenant() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

-- Shared reference data readable from tenant context
GRANT SELECT ON users, modules, plans, plan_modules, prices, permissions, industry_templates TO app_user;

-- tenants: a tenant sees only itself
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenants USING (id = app_tenant()) WITH CHECK (id = app_tenant());
GRANT SELECT, UPDATE ON tenants TO app_user;

-- Standard tenant tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches', 'tenant_members', 'invitations', 'tenant_role_settings',
    'tenant_terms', 'field_definitions', 'form_layouts',
    'tenant_entitlements', 'usage_counters', 'credit_balances',
    'subscriptions', 'notifications', 'audit_log', 'outbox_events', 'notification_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', t);
  END LOOP;
END $$;

-- Subscriptions are changed only by the subscription service (platform context)
REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM app_user;
-- Audit log is append-only for tenants (NFR-20)
REVOKE UPDATE, DELETE ON audit_log FROM app_user;

-- Roles: predefined rows (tenant_id IS NULL) are readable by all tenants but never writable
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles', 'role_permissions', 'role_field_access'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY role_read ON %I FOR SELECT USING (tenant_id IS NULL OR tenant_id = app_tenant())', t);
    EXECUTE format('CREATE POLICY role_write ON %I FOR ALL USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', t);
  END LOOP;
END $$;

-- One key per tenant, predefined keys unique globally
CREATE UNIQUE INDEX roles_tenant_key_uq ON roles (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

-- Custom-field filtering (LLD §5.3) will use GIN indexes on each entity's custom column.

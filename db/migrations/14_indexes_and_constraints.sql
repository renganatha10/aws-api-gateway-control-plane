-- Up Migration

-- ============================================================
-- HIGH PRIORITY: Bug-level unique constraints
-- ============================================================

-- Prevents duplicate consumer names within the same org.
-- Without this, two consumers named "my-app" in the same org each
-- provision separate Cognito App Clients and AWS API keys with no
-- way to distinguish them in the UI.
ALTER TABLE consumers
  ADD CONSTRAINT uq_consumers_org_name UNIQUE (organisation_id, name);

-- Prevents duplicate base paths on the same custom domain.
-- AWS API Gateway rejects duplicate base path mappings at provisioning
-- time; this ensures the DB blocks them before we even try.
ALTER TABLE domain_route_mappings
  ADD CONSTRAINT uq_domain_route_base_path UNIQUE (domain_id, base_path);

-- ============================================================
-- HIGH PRIORITY: Missing indexes causing seq scans on hot paths
-- ============================================================

-- listOrganisations / countOrganisations run on every authenticated
-- page load and filter organisations by created_by with no index.
CREATE INDEX idx_organisations_created_by ON organisations (created_by);

-- listConsumersByProduct filters consumers by product_id with no
-- index on this FK column at all.
CREATE INDEX idx_consumers_product_id ON consumers (product_id);

-- ============================================================
-- MEDIUM PRIORITY: Integrity gaps and reverse-lookup indexes
-- ============================================================

-- listProductsByApi uses WHERE api_id = ? on api_associations.
-- The UNIQUE(product_id, api_id) index cannot serve this because
-- api_id is the trailing column.
CREATE INDEX idx_api_associations_api_id ON api_associations (api_id);

-- listProductsByPlan uses WHERE plan_id = ? on plan_associations.
-- Same trailing-column problem as above.
CREATE INDEX idx_plan_associations_plan_id ON plan_associations (plan_id);

-- Enforces base_path uniqueness per org at the DB level.
-- findApiByOrganisationAndBasePath currently relies on an app-level
-- check only; a race condition can insert duplicates without this.
-- Partial because base_path is nullable and NULLs must not conflict.
CREATE UNIQUE INDEX idx_apis_org_basepath
  ON apis (organisation_id, base_path)
  WHERE base_path IS NOT NULL;

-- Prevents two environments with the same name in the same org.
-- Duplicate names cause stage name collisions in AWS API Gateway.
ALTER TABLE environments
  ADD CONSTRAINT uq_environments_org_name UNIQUE (organisation_id, name);

-- Prevents two plans with the same name in the same org.
ALTER TABLE plans
  ADD CONSTRAINT uq_plans_org_name UNIQUE (organisation_id, name);

-- ============================================================
-- LOW PRIORITY: Covering indexes to eliminate ORDER BY sort steps
-- ============================================================

-- apis: replace single-column index with compound (org, created_at)
-- so listApisByOrganisation can return rows in order without sorting.
DROP INDEX idx_apis_organisation_id;
CREATE INDEX idx_apis_org_createdat ON apis (organisation_id, created_at);

-- plans: same pattern for listPlansByOrganisation.
DROP INDEX idx_plans_organisation_id;
CREATE INDEX idx_plans_org_createdat ON plans (organisation_id, created_at);

-- consumers: same pattern for listConsumersByOrganisation.
-- Note: idx_consumers_product_id (added above) is a separate index
-- serving a different query (listConsumersByProduct).
DROP INDEX idx_consumers_organisation_id;
CREATE INDEX idx_consumers_org_createdat ON consumers (organisation_id, created_at);

-- domains: same pattern for listDomainsByOrganisation.
DROP INDEX idx_domains_organisation_id;
CREATE INDEX idx_domains_org_createdat ON domains (organisation_id, created_at);


-- Down Migration

-- Covering index rollback
DROP INDEX idx_domains_org_createdat;
CREATE INDEX idx_domains_organisation_id ON domains (organisation_id);

DROP INDEX idx_consumers_org_createdat;
CREATE INDEX idx_consumers_organisation_id ON consumers (organisation_id);

DROP INDEX idx_plans_org_createdat;
CREATE INDEX idx_plans_organisation_id ON plans (organisation_id);

DROP INDEX idx_apis_org_createdat;
CREATE INDEX idx_apis_organisation_id ON apis (organisation_id);

-- Medium priority rollback
ALTER TABLE plans DROP CONSTRAINT uq_plans_org_name;
ALTER TABLE environments DROP CONSTRAINT uq_environments_org_name;
DROP INDEX idx_apis_org_basepath;
DROP INDEX idx_plan_associations_plan_id;
DROP INDEX idx_api_associations_api_id;

-- High priority rollback
DROP INDEX idx_consumers_product_id;
DROP INDEX idx_organisations_created_by;
ALTER TABLE domain_route_mappings DROP CONSTRAINT uq_domain_route_base_path;
ALTER TABLE consumers DROP CONSTRAINT uq_consumers_org_name;

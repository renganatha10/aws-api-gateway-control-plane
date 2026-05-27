import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export type OrgRole = "admin" | "editor" | "viewer" | "portal-user";

export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const environments = pgTable("environments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  organisationId: integer("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apis = pgTable("apis", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  scope: varchar("scope", { length: 255 }),
  specType: varchar("spec_type", { length: 50 }).notNull(),
  spec: jsonb("spec").notNull(),
  basePath: varchar("base_path", { length: 255 }),
  organisationId: integer("organisation_id").references(() => organisations.id, {
    onDelete: "set null",
  }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  awsApiId: varchar("aws_api_id", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organisation = typeof organisations.$inferSelect;
export type NewOrganisation = typeof organisations.$inferInsert;

export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  organisationId: integer("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  throttle: integer("throttle"),
  burst: integer("burst"),
  quotaLimit: integer("quota_limit"),
  quotaPeriod: varchar("quota_period", { length: 10 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  awsUsagePlanId: varchar("aws_usage_plan_id", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

export type Api = typeof apis.$inferSelect;
export type NewApi = typeof apis.$inferInsert;

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: text("description"),
    visibility: varchar("visibility", { length: 50 }).notNull().default("authenticated"),
    organisationId: integer("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.organisationId, t.name)]
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const apiAssociations = pgTable(
  "api_associations",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    apiId: integer("api_id")
      .notNull()
      .references(() => apis.id, { onDelete: "cascade" }),
    organisationId: integer("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.productId, t.apiId)]
);

export type ApiAssociation = typeof apiAssociations.$inferSelect;
export type NewApiAssociation = typeof apiAssociations.$inferInsert;

export const planAssociations = pgTable(
  "plan_associations",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    organisationId: integer("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.productId, t.planId)]
);

export type PlanAssociation = typeof planAssociations.$inferSelect;
export type NewPlanAssociation = typeof planAssociations.$inferInsert;

export const productDeployments = pgTable(
  "product_deployments",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    environmentId: integer("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    organisationId: integer("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull().default("deployed"),
    invokeUrl: varchar("invoke_url", { length: 512 }),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.productId, t.environmentId)]
);

export type ProductDeployment = typeof productDeployments.$inferSelect;
export type NewProductDeployment = typeof productDeployments.$inferInsert;

export const consumers = pgTable("consumers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  environmentId: integer("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  planId: integer("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  organisationId: integer("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  clientId: varchar("client_id", { length: 255 }),
  awsApiKeyId: varchar("aws_api_key_id", { length: 255 }),
  tokenUrl: varchar("token_url", { length: 512 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Consumer = typeof consumers.$inferSelect;
export type NewConsumer = typeof consumers.$inferInsert;

export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  domainName: varchar("domain_name", { length: 255 }).notNull().unique(),
  certificateArn: varchar("certificate_arn", { length: 500 }).notNull(),
  awsDomainName: varchar("aws_domain_name", { length: 255 }),
  endpointType: varchar("endpoint_type", { length: 20 }).notNull().default("REGIONAL"),
  godaddyDomain: varchar("godaddy_domain", { length: 255 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const domainRouteMappings = pgTable("domain_route_mappings", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id")
    .notNull()
    .references(() => domains.id, { onDelete: "cascade" }),
  apiId: integer("api_id")
    .notNull()
    .references(() => apis.id, { onDelete: "cascade" }),
  stage: varchar("stage", { length: 255 }).notNull(),
  basePath: varchar("base_path", { length: 255 }).notNull().default("(none)"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type DomainRouteMapping = typeof domainRouteMappings.$inferSelect;
export type NewDomainRouteMapping = typeof domainRouteMappings.$inferInsert;

export const organisationMembers = pgTable("organisation_members", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).$type<OrgRole>().notNull(),
  invitedBy: varchar("invited_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganisationMember = typeof organisationMembers.$inferSelect;
export type NewOrganisationMember = typeof organisationMembers.$inferInsert;

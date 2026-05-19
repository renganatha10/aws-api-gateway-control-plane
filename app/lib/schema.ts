import { integer, jsonb, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core"

export const gateways = pgTable("gateways", {
  id:        serial("id").primaryKey(),
  name:      varchar("name", { length: 255 }).notNull().unique(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const environments = pgTable("environments", {
  id:        serial("id").primaryKey(),
  name:      varchar("name", { length: 100 }).notNull(),
  gatewayId: integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const apis = pgTable("apis", {
  id:          serial("id").primaryKey(),
  name:        varchar("name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  scope:       varchar("scope", { length: 255 }),
  specType:  varchar("spec_type", { length: 50 }).notNull(),
  spec:      jsonb("spec").notNull(),
  basePath:  varchar("base_path", { length: 255 }),
  gatewayId: integer("gateway_id").references(() => gateways.id, { onDelete: "set null" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  awsApiId:  varchar("aws_api_id", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Gateway    = typeof gateways.$inferSelect
export type NewGateway = typeof gateways.$inferInsert

export type Environment    = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert

export const plans = pgTable("plans", {
  id:          serial("id").primaryKey(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  name:        varchar("name", { length: 255 }).notNull(),
  gatewayId:   integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  throttle:    integer("throttle"),
  burst:       integer("burst"),
  quotaLimit:  integer("quota_limit"),
  quotaPeriod: varchar("quota_period", { length: 10 }),
  createdBy:      varchar("created_by", { length: 255 }).notNull(),
  updatedBy:      varchar("updated_by", { length: 255 }),
  awsUsagePlanId: varchar("aws_usage_plan_id", { length: 100 }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Plan    = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert

export type Api    = typeof apis.$inferSelect
export type NewApi = typeof apis.$inferInsert

export const products = pgTable("products", {
  id:          serial("id").primaryKey(),
  name:        varchar("name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  visibility:  varchar("visibility", { length: 50 }).notNull().default("authenticated"),
  gatewayId:   integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  createdBy:   varchar("created_by", { length: 255 }).notNull(),
  updatedBy:   varchar("updated_by", { length: 255 }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.gatewayId, t.name)])

export type Product    = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert

export const apiAssociations = pgTable("api_associations", {
  id:        serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  apiId:     integer("api_id").notNull().references(() => apis.id, { onDelete: "cascade" }),
  gatewayId: integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.productId, t.apiId)])

export type ApiAssociation    = typeof apiAssociations.$inferSelect
export type NewApiAssociation = typeof apiAssociations.$inferInsert

export const planAssociations = pgTable("plan_associations", {
  id:        serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  planId:    integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  gatewayId: integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.productId, t.planId)])

export type PlanAssociation    = typeof planAssociations.$inferSelect
export type NewPlanAssociation = typeof planAssociations.$inferInsert

export const productDeployments = pgTable("product_deployments", {
  id:            serial("id").primaryKey(),
  productId:     integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  environmentId: integer("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  gatewayId:     integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  status:        varchar("status", { length: 50 }).notNull().default("deployed"),
  createdBy:     varchar("created_by", { length: 255 }).notNull(),
  updatedBy:     varchar("updated_by", { length: 255 }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.productId, t.environmentId)])

export type ProductDeployment    = typeof productDeployments.$inferSelect
export type NewProductDeployment = typeof productDeployments.$inferInsert

export const consumers = pgTable("consumers", {
  id:            serial("id").primaryKey(),
  name:          varchar("name", { length: 255 }).notNull(),
  productId:     integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  environmentId: integer("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  planId:        integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  gatewayId:     integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  createdBy:     varchar("created_by", { length: 255 }).notNull(),
  updatedBy:     varchar("updated_by", { length: 255 }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Consumer    = typeof consumers.$inferSelect
export type NewConsumer = typeof consumers.$inferInsert

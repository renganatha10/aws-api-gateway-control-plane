import { integer, jsonb, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core"

export const gateways = pgTable("gateways", {
  id:           serial("id").primaryKey(),
  name:         varchar("name", { length: 255 }).notNull().unique(),
  createdBy:    varchar("created_by", { length: 255 }).notNull(),
  awsRestApiId: varchar("aws_rest_api_id", { length: 100 }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const environments = pgTable("environments", {
  id:        serial("id").primaryKey(),
  name:      varchar("name", { length: 100 }).notNull(),
  gatewayId: integer("gateway_id").notNull().references(() => gateways.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const apis = pgTable("apis", {
  id:        serial("id").primaryKey(),
  name:      varchar("name", { length: 255 }).notNull(),
  scope:     varchar("scope", { length: 255 }),
  specType:  varchar("spec_type", { length: 50 }).notNull(),
  spec:      jsonb("spec").notNull(),
  gatewayId: integer("gateway_id").references(() => gateways.id, { onDelete: "set null" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Gateway    = typeof gateways.$inferSelect
export type NewGateway = typeof gateways.$inferInsert

export type Environment    = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert

export type Api    = typeof apis.$inferSelect
export type NewApi = typeof apis.$inferInsert

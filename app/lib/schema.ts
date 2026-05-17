import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core"

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

export type Gateway    = typeof gateways.$inferSelect
export type NewGateway = typeof gateways.$inferInsert

export type Environment    = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert

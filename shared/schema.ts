import { pgTable, text, serial, varchar, integer, timestamp, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const moodEntries = pgTable("mood_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().default(""),
  value: integer("value").notNull(),
  label: text("label").notNull(),
  date: date("date").notNull().default(sql`CURRENT_DATE`),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().default(""),
  content: text("content").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  date: date("date").notNull().default(sql`CURRENT_DATE`),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  author: text("author").notNull(),
  source: text("source"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMoodSchema = createInsertSchema(moodEntries).pick({
  value: true,
  label: true,
});

export const insertJournalSchema = createInsertSchema(journalEntries).pick({
  content: true,
  tags: true,
});

export const wins = pgTable("wins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().default(""),
  focusArea: text("focus_area").notNull(),
  nameIt: text("name_it").notNull(),
  dysfunctions: text("dysfunctions").array().notNull().default(sql`'{}'::text[]`),
  advocacy: text("advocacy").notNull().default(""),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export const appSubscriptions = pgTable("app_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull(),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export const dailyInsights = pgTable("daily_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  deviceId: text("device_id").notNull().default(""),
  insight: text("insight").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export type DailyInsight = typeof dailyInsights.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const insertQuoteSchema = createInsertSchema(quotes).pick({
  text: true,
  author: true,
  source: true,
});

export const insertWinSchema = createInsertSchema(wins).pick({
  focusArea: true,
  nameIt: true,
  dysfunctions: true,
  advocacy: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type MoodEntry = typeof moodEntries.$inferSelect;
export type InsertMoodEntry = z.infer<typeof insertMoodSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalSchema>;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Win = typeof wins.$inferSelect;
export type InsertWin = z.infer<typeof insertWinSchema>;
export type AppSubscription = typeof appSubscriptions.$inferSelect;

export const deviceTokens = pgTable("device_tokens", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DeviceToken = typeof deviceTokens.$inferSelect;

// Table 1: stores user identity — name, email, and device ID
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().unique(),
  name: text("name"),
  email: text("email"),
  updatedAt: timestamp("updated_at").notNull().default(sql`NOW()`),
});

// Table 2: stores per-device stats and subscription expiry for account restore
export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().unique(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  totalWins: integer("total_wins").notNull().default(0),
  activeDays: integer("active_days").notNull().default(0),
  reflections: integer("reflections").notNull().default(0),
  focusBreakdown: text("focus_breakdown").notNull().default("{}"),
  winsData: text("wins_data").notNull().default("[]"),
  journalData: text("journal_data").notNull().default("[]"),
  updatedAt: timestamp("updated_at").notNull().default(sql`NOW()`),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;

// One-time magic link tokens for account restore (expire after 5 minutes)
export const restoreTokens = pgTable("restore_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export type RestoreToken = typeof restoreTokens.$inferSelect;

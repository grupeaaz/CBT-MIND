import {
  type User, type InsertUser,
  type MoodEntry, type InsertMoodEntry,
  type JournalEntry, type InsertJournalEntry,
  type Quote, type InsertQuote,
  type Win, type InsertWin,
  type AppSubscription,
  type PushSubscription,
  type DailyInsight,
  type DeviceToken,
  type UserProfile,
  type UserStats,
  type RestoreToken,
  users, moodEntries, journalEntries, quotes, wins, appSubscriptions, pushSubscriptions, dailyInsights, deviceTokens, userProfiles, userStats, restoreTokens
} from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createMoodEntry(entry: InsertMoodEntry & { deviceId: string }): Promise<MoodEntry>;
  getMoodEntries(deviceId: string, limit?: number): Promise<MoodEntry[]>;

  createJournalEntry(entry: InsertJournalEntry & { deviceId: string }): Promise<JournalEntry>;
  getJournalEntries(deviceId: string, limit?: number): Promise<JournalEntry[]>;
  getJournalEntry(id: string): Promise<JournalEntry | undefined>;

  getQuotes(): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;

  createWin(win: InsertWin & { deviceId: string }): Promise<Win>;
  getWins(deviceId: string, limit?: number): Promise<Win[]>;
  getWinCount(deviceId: string): Promise<number>;

  createAppSubscription(sub: { deviceId: string; email?: string; stripeCustomerId?: string; stripeSubscriptionId?: string; stripeSubscriptionStatus?: string; status: string }): Promise<AppSubscription>;
  getActiveSubscription(deviceId: string): Promise<AppSubscription | undefined>;
  getActiveSubscriptionByEmail(email: string): Promise<AppSubscription | undefined>;
  linkDeviceToSubscription(email: string, deviceId: string): Promise<AppSubscription | undefined>;

  savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string; deviceId: string }): Promise<PushSubscription>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  getPushSubscriptionsByDeviceId(deviceId: string): Promise<PushSubscription[]>;
  deletePushSubscription(endpoint: string): Promise<void>;

  // Device token auth
  createDeviceToken(deviceId: string, token: string): Promise<DeviceToken>;
  getDeviceIdByToken(token: string): Promise<string | undefined>;

  getDailyInsight(date: string, deviceId: string): Promise<DailyInsight | undefined>;
  saveDailyInsight(date: string, deviceId: string, insight: string): Promise<DailyInsight>;

  // User profile (name + email)
  saveUserProfile(deviceId: string, name?: string, email?: string): Promise<UserProfile>;
  getUserProfile(deviceId: string): Promise<UserProfile | undefined>;
  getUserProfileByEmail(email: string): Promise<UserProfile | undefined>;

  // User stats (insights + subscription expiry)
  saveUserStats(deviceId: string, stats: { totalWins: number; activeDays: number; reflections: number; focusBreakdown: string; subscriptionExpiresAt?: Date | null }): Promise<UserStats>;
  getUserStats(deviceId: string): Promise<UserStats | undefined>;

  // One-time restore tokens (magic links)
  createRestoreToken(email: string, token: string, expiresAt: Date): Promise<RestoreToken>;
  getRestoreToken(token: string): Promise<RestoreToken | undefined>;
  markRestoreTokenUsed(token: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createMoodEntry(entry: InsertMoodEntry & { deviceId: string }): Promise<MoodEntry> {
    const [mood] = await db.insert(moodEntries).values(entry).returning();
    return mood;
  }

  async getMoodEntries(deviceId: string, limit = 30): Promise<MoodEntry[]> {
    return db.select().from(moodEntries).where(eq(moodEntries.deviceId, deviceId)).orderBy(desc(moodEntries.createdAt)).limit(limit);
  }

  async createJournalEntry(entry: InsertJournalEntry & { deviceId: string }): Promise<JournalEntry> {
    const [journal] = await db.insert(journalEntries).values(entry).returning();
    return journal;
  }

  async getJournalEntries(deviceId: string, limit = 20): Promise<JournalEntry[]> {
    return db.select().from(journalEntries).where(eq(journalEntries.deviceId, deviceId)).orderBy(desc(journalEntries.createdAt)).limit(limit);
  }

  async getJournalEntry(id: string): Promise<JournalEntry | undefined> {
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
    return entry;
  }

  async getQuotes(): Promise<Quote[]> {
    return db.select().from(quotes);
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [q] = await db.insert(quotes).values(quote).returning();
    return q;
  }

  async createWin(win: InsertWin & { deviceId: string }): Promise<Win> {
    const [w] = await db.insert(wins).values(win).returning();
    return w;
  }

  async getWins(deviceId: string, limit = 50): Promise<Win[]> {
    return db.select().from(wins).where(eq(wins.deviceId, deviceId)).orderBy(desc(wins.createdAt)).limit(limit);
  }

  async getWinCount(deviceId: string): Promise<number> {
    const result = await db.select().from(wins).where(eq(wins.deviceId, deviceId));
    return result.length;
  }

  async createAppSubscription(sub: { deviceId: string; email?: string; stripeCustomerId?: string; stripeSubscriptionId?: string; stripeSubscriptionStatus?: string; status: string }): Promise<AppSubscription> {
    const [s] = await db.insert(appSubscriptions).values(sub).returning();
    return s;
  }

  async getActiveSubscription(deviceId: string): Promise<AppSubscription | undefined> {
    const { and } = await import("drizzle-orm");
    const [sub] = await db.select().from(appSubscriptions)
      .where(and(eq(appSubscriptions.deviceId, deviceId), eq(appSubscriptions.status, "active")))
      .orderBy(desc(appSubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async getActiveSubscriptionByEmail(email: string): Promise<AppSubscription | undefined> {
    const { and } = await import("drizzle-orm");
    const [sub] = await db.select().from(appSubscriptions)
      .where(and(eq(appSubscriptions.email, email), eq(appSubscriptions.status, "active")))
      .orderBy(desc(appSubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async linkDeviceToSubscription(email: string, deviceId: string): Promise<AppSubscription | undefined> {
    const existing = await this.getActiveSubscriptionByEmail(email);
    if (!existing) return undefined;
    const [newSub] = await db.insert(appSubscriptions).values({
      deviceId,
      email: existing.email,
      stripeCustomerId: existing.stripeCustomerId,
      stripeSubscriptionId: existing.stripeSubscriptionId,
      stripeSubscriptionStatus: existing.stripeSubscriptionStatus,
      status: existing.status,
    }).returning();
    return newSub;
  }

  async savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string; deviceId: string }): Promise<PushSubscription> {
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
    if (existing.length > 0) {
      return existing[0];
    }
    const [s] = await db.insert(pushSubscriptions).values(sub).returning();
    return s;
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions);
  }

  async getPushSubscriptionsByDeviceId(deviceId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.deviceId, deviceId));
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async createDeviceToken(deviceId: string, token: string): Promise<DeviceToken> {
    // Upsert: if deviceId already registered, return existing token
    const existing = await db.select().from(deviceTokens).where(eq(deviceTokens.deviceId, deviceId));
    if (existing.length > 0) return existing[0];
    const [dt] = await db.insert(deviceTokens).values({ deviceId, token }).returning();
    return dt;
  }

  async getDeviceIdByToken(token: string): Promise<string | undefined> {
    const [dt] = await db.select().from(deviceTokens).where(eq(deviceTokens.token, token));
    return dt?.deviceId;
  }

  async getDailyInsight(date: string, deviceId: string): Promise<DailyInsight | undefined> {
    const { and } = await import("drizzle-orm");
    const [insight] = await db.select().from(dailyInsights).where(and(eq(dailyInsights.date, date), eq(dailyInsights.deviceId, deviceId)));
    return insight;
  }

  async saveDailyInsight(date: string, deviceId: string, insightText: string): Promise<DailyInsight> {
    const [insight] = await db.insert(dailyInsights).values({ date, deviceId, insight: insightText }).returning();
    return insight;
  }

  async saveUserProfile(deviceId: string, name?: string, email?: string): Promise<UserProfile> {
    const updateFields: Partial<{ name: string | null; email: string | null; updatedAt: Date }> = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;

    const [profile] = await db.insert(userProfiles)
      .values({ deviceId, name: name ?? null, email: email ?? null })
      .onConflictDoUpdate({ target: userProfiles.deviceId, set: updateFields })
      .returning();
    return profile;
  }

  async getUserProfile(deviceId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.deviceId, deviceId));
    return profile;
  }

  async getUserProfileByEmail(email: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.email, email));
    return profile;
  }

  async saveUserStats(deviceId: string, stats: { totalWins: number; activeDays: number; reflections: number; focusBreakdown: string; subscriptionExpiresAt?: Date | null }): Promise<UserStats> {
    const { totalWins, activeDays, reflections, focusBreakdown, subscriptionExpiresAt } = stats;
    const [savedStats] = await db.insert(userStats)
      .values({ deviceId, totalWins, activeDays, reflections, focusBreakdown, subscriptionExpiresAt: subscriptionExpiresAt ?? null })
      .onConflictDoUpdate({
        target: userStats.deviceId,
        set: { totalWins, activeDays, reflections, focusBreakdown, subscriptionExpiresAt: subscriptionExpiresAt ?? null, updatedAt: new Date() },
      })
      .returning();
    return savedStats;
  }

  async getUserStats(deviceId: string): Promise<UserStats | undefined> {
    const [stats] = await db.select().from(userStats).where(eq(userStats.deviceId, deviceId));
    return stats;
  }

  async createRestoreToken(email: string, token: string, expiresAt: Date): Promise<RestoreToken> {
    const [row] = await db.insert(restoreTokens).values({ email, token, expiresAt }).returning();
    return row;
  }

  async getRestoreToken(token: string): Promise<RestoreToken | undefined> {
    const [row] = await db.select().from(restoreTokens).where(eq(restoreTokens.token, token));
    return row;
  }

  async markRestoreTokenUsed(token: string): Promise<void> {
    await db.update(restoreTokens).set({ usedAt: new Date() }).where(eq(restoreTokens.token, token));
  }
}

export const storage = new DatabaseStorage();

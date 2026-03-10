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
  type AccountStats,
  type RestoreToken,
  users, moodEntries, journalEntries, quotes, wins, appSubscriptions, pushSubscriptions, dailyInsights, deviceTokens, userProfiles, userStats, accountStats, restoreTokens
} from "@shared/schema";
import { desc, eq, ilike, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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
  saveUserStats(deviceId: string, stats: { totalWins: number; activeDays: number; reflections: number; focusBreakdown: string; winsData?: string; journalData?: string; subscriptionExpiresAt?: Date | null }): Promise<UserStats>;
  getUserStats(deviceId: string): Promise<UserStats | undefined>;
  getBestUserStatsByEmail(email: string): Promise<UserStats | undefined>;
  getMergedStatsByEmail(email: string): Promise<UserStats | undefined>;

  // Get all wins from every device linked to the same email
  getWinsByEmail(email: string): Promise<Win[]>;
  // Get all journal entries from every device linked to the same email
  getJournalsByEmail(email: string): Promise<JournalEntry[]>;

  // Account-level stats keyed by email — single source of truth across all devices
  getAccountStats(email: string): Promise<AccountStats | undefined>;
  upsertAccountStats(email: string, stats: {
    totalWins?: number;
    activeDays?: number;
    reflections?: number;
    focusBreakdown?: string;
    subscriptionStatus?: string;
    subscriptionExpiresAt?: Date | null;
    installDate?: number | null;
  }): Promise<void>;

  // One-time restore tokens (magic links)
  createRestoreToken(email: string, token: string, expiresAt: Date): Promise<RestoreToken>;
  getRestoreToken(token: string): Promise<RestoreToken | undefined>;
  markRestoreTokenUsed(token: string): Promise<void>;

  // Delete all data for a device (right to be forgotten)
  deleteAllDeviceData(deviceId: string, email?: string): Promise<void>;
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
    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
    const updateFields: Partial<{ name: string | null; email: string | null; updatedAt: Date }> = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (normalizedEmail !== undefined) updateFields.email = normalizedEmail;

    const [profile] = await db.insert(userProfiles)
      .values({ deviceId, name: name ?? null, email: normalizedEmail ?? null })
      .onConflictDoUpdate({ target: userProfiles.deviceId, set: updateFields })
      .returning();
    return profile;
  }

  async getUserProfile(deviceId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.deviceId, deviceId));
    return profile;
  }

  async getUserProfileByEmail(email: string): Promise<UserProfile | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await db.execute(
      sql`SELECT * FROM user_profiles WHERE lower(email) = ${normalizedEmail} LIMIT 1`
    );
    return result.rows[0] as UserProfile | undefined;
  }

  async saveUserStats(deviceId: string, stats: { totalWins: number; activeDays: number; reflections: number; focusBreakdown: string; winsData?: string; journalData?: string; subscriptionExpiresAt?: Date | null }): Promise<UserStats> {
    const { totalWins, activeDays, reflections, focusBreakdown, winsData, journalData, subscriptionExpiresAt } = stats;
    const [savedStats] = await db.insert(userStats)
      .values({ deviceId, totalWins, activeDays, reflections, focusBreakdown, winsData: winsData ?? "[]", journalData: journalData ?? "[]", subscriptionExpiresAt: subscriptionExpiresAt ?? null })
      .onConflictDoUpdate({
        target: userStats.deviceId,
        set: { totalWins, activeDays, reflections, focusBreakdown, winsData: winsData ?? "[]", journalData: journalData ?? "[]", subscriptionExpiresAt: subscriptionExpiresAt ?? null, updatedAt: new Date() },
      })
      .returning();
    return savedStats;
  }

  async getUserStats(deviceId: string): Promise<UserStats | undefined> {
    const [stats] = await db.select().from(userStats).where(eq(userStats.deviceId, deviceId));
    return stats;
  }

  async getBestUserStatsByEmail(email: string): Promise<UserStats | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const rows = await db.execute(
      sql`SELECT us.* FROM user_stats us
          JOIN user_profiles up ON us.device_id = up.device_id
          WHERE LOWER(up.email) = ${normalizedEmail}
          ORDER BY us.total_wins DESC, us.updated_at DESC
          LIMIT 1`
    );
    const row = rows.rows[0] as any;
    if (!row) return undefined;
    return {
      id: row.id,
      deviceId: row.device_id,
      totalWins: row.total_wins,
      activeDays: row.active_days,
      reflections: row.reflections,
      focusBreakdown: row.focus_breakdown,
      winsData: row.wins_data,
      journalData: row.journal_data,
      subscriptionExpiresAt: row.subscription_expires_at,
      updatedAt: row.updated_at,
    } as UserStats;
  }

  async getMergedStatsByEmail(email: string): Promise<UserStats | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const rows = await db.execute(
      sql`SELECT us.* FROM user_stats us
          JOIN user_profiles up ON us.device_id = up.device_id
          WHERE LOWER(up.email) = ${normalizedEmail}
          ORDER BY us.updated_at DESC`
    );
    if (!rows.rows.length) return undefined;

    // SUM wins and reflections across devices (each device has its own unique entries)
    // SUM focusBreakdown categories across devices
    // MAX activeDays (calendar days can overlap across devices)
    let totalWins = 0;
    let bestActiveDays = 0;
    let totalReflections = 0;
    const mergedFocusBreakdown: Record<string, number> = {};
    let bestWinsData = "[]";
    let latestSubscriptionExpiresAt: Date | null = null;

    for (const row of rows.rows as any[]) {
      const rowTotalWins = Number(row.total_wins) || 0;
      const rowActiveDays = Number(row.active_days) || 0;
      const rowReflections = Number(row.reflections) || 0;

      totalWins += rowTotalWins;
      if (rowActiveDays > bestActiveDays) bestActiveDays = rowActiveDays;
      totalReflections += rowReflections;

      // Keep winsData from the device with most wins (for pattern reference)
      if (rowTotalWins > 0 && bestWinsData === "[]") bestWinsData = row.wins_data || "[]";

      // SUM focusBreakdown categories across all devices
      try {
        const rowBreakdown = typeof row.focus_breakdown === "string"
          ? JSON.parse(row.focus_breakdown)
          : (row.focus_breakdown || {});
        for (const [key, count] of Object.entries(rowBreakdown)) {
          mergedFocusBreakdown[key] = (mergedFocusBreakdown[key] || 0) + (Number(count) || 0);
        }
      } catch {}

      if (row.subscription_expires_at) {
        const expiry = new Date(row.subscription_expires_at);
        if (!latestSubscriptionExpiresAt || expiry > latestSubscriptionExpiresAt) {
          latestSubscriptionExpiresAt = expiry;
        }
      }
    }

    const firstRow = rows.rows[0] as any;
    return {
      id: firstRow.id,
      deviceId: firstRow.device_id,
      totalWins,
      activeDays: bestActiveDays,
      reflections: totalReflections,
      focusBreakdown: JSON.stringify(mergedFocusBreakdown),
      winsData: bestWinsData,
      journalData: firstRow.journal_data,
      subscriptionExpiresAt: latestSubscriptionExpiresAt,
      updatedAt: firstRow.updated_at,
    } as UserStats;
  }

  async getWinsByEmail(email: string): Promise<Win[]> {
    const normalizedEmail = email.toLowerCase().trim();
    const rows = await db.execute(
      sql`SELECT w.id, w.device_id, w.focus_area, w.name_it, w.dysfunctions, w.advocacy, w.created_at
          FROM wins w
          JOIN user_profiles up ON w.device_id = up.device_id
          WHERE LOWER(up.email) = ${normalizedEmail}
          ORDER BY w.created_at DESC
          LIMIT 500`
    );
    return (rows.rows as any[]).map(row => ({
      id: row.id,
      deviceId: row.device_id,
      focusArea: row.focus_area,
      nameIt: row.name_it,
      dysfunctions: Array.isArray(row.dysfunctions) ? row.dysfunctions : [],
      advocacy: row.advocacy || "",
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })) as Win[];
  }

  async getJournalsByEmail(email: string): Promise<JournalEntry[]> {
    const normalizedEmail = email.toLowerCase().trim();
    const rows = await db.execute(
      sql`SELECT j.id, j.device_id, j.content, j.tags, j.date, j.created_at
          FROM journal_entries j
          JOIN user_profiles up ON j.device_id = up.device_id
          WHERE LOWER(up.email) = ${normalizedEmail}
          ORDER BY j.created_at DESC
          LIMIT 500`
    );
    return (rows.rows as any[]).map(row => ({
      id: row.id,
      deviceId: row.device_id,
      content: row.content,
      tags: Array.isArray(row.tags) ? row.tags : [],
      date: row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })) as JournalEntry[];
  }

  async getAccountStats(email: string): Promise<AccountStats | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const [row] = await db.select().from(accountStats).where(eq(accountStats.email, normalizedEmail));
    return row;
  }

  async upsertAccountStats(email: string, stats: {
    totalWins?: number;
    activeDays?: number;
    reflections?: number;
    focusBreakdown?: string;
    subscriptionStatus?: string;
    subscriptionExpiresAt?: Date | null;
    installDate?: number | null;
  }): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.getAccountStats(normalizedEmail);

    const existingInstallDate = existing?.installDate ?? null;
    const incomingInstallDate = stats.installDate ?? null;
    // Keep the earliest (smallest) install date across all devices
    let mergedInstallDate: number | null = existingInstallDate;
    if (incomingInstallDate !== null) {
      mergedInstallDate = existingInstallDate === null
        ? incomingInstallDate
        : Math.min(existingInstallDate, incomingInstallDate);
    }

    const merged = {
      email: normalizedEmail,
      totalWins: stats.totalWins !== undefined
        ? Math.max(stats.totalWins, existing?.totalWins ?? 0)
        : (existing?.totalWins ?? 0),
      activeDays: stats.activeDays !== undefined
        ? Math.max(stats.activeDays, existing?.activeDays ?? 0)
        : (existing?.activeDays ?? 0),
      reflections: stats.reflections !== undefined
        ? Math.max(stats.reflections, existing?.reflections ?? 0)
        : (existing?.reflections ?? 0),
      focusBreakdown: stats.focusBreakdown ?? existing?.focusBreakdown ?? "{}",
      subscriptionStatus: stats.subscriptionStatus ?? existing?.subscriptionStatus ?? "none",
      subscriptionExpiresAt: stats.subscriptionExpiresAt !== undefined
        ? stats.subscriptionExpiresAt
        : (existing?.subscriptionExpiresAt ?? null),
      installDate: mergedInstallDate,
      updatedAt: new Date(),
    };

    await db.execute(
      sql`INSERT INTO account_stats (email, total_wins, active_days, reflections, focus_breakdown, subscription_status, subscription_expires_at, install_date, updated_at)
          VALUES (${merged.email}, ${merged.totalWins}, ${merged.activeDays}, ${merged.reflections}, ${merged.focusBreakdown}, ${merged.subscriptionStatus}, ${merged.subscriptionExpiresAt}, ${merged.installDate}, ${merged.updatedAt})
          ON CONFLICT (email) DO UPDATE SET
            total_wins = EXCLUDED.total_wins,
            active_days = EXCLUDED.active_days,
            reflections = EXCLUDED.reflections,
            focus_breakdown = EXCLUDED.focus_breakdown,
            subscription_status = EXCLUDED.subscription_status,
            subscription_expires_at = CASE
              WHEN EXCLUDED.subscription_expires_at IS NOT NULL AND (account_stats.subscription_expires_at IS NULL OR EXCLUDED.subscription_expires_at > account_stats.subscription_expires_at)
              THEN EXCLUDED.subscription_expires_at
              ELSE account_stats.subscription_expires_at
            END,
            install_date = CASE
              WHEN EXCLUDED.install_date IS NOT NULL AND (account_stats.install_date IS NULL OR EXCLUDED.install_date < account_stats.install_date)
              THEN EXCLUDED.install_date
              ELSE account_stats.install_date
            END,
            updated_at = NOW()`
    );
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

  async deleteAllDeviceData(deviceId: string, emailFromClient?: string): Promise<void> {
    const profile = await this.getUserProfile(deviceId);
    const rawEmail = emailFromClient || profile?.email;
    const email = rawEmail ? rawEmail.toLowerCase().trim() : null;

    if (email) {
      // Find all device IDs linked to this email (case-insensitive)
      const profilesResult = await db.execute(
        sql`SELECT device_id FROM user_profiles WHERE lower(email) = ${email}`
      );
      const linkedDeviceIds = (profilesResult.rows as { device_id: string }[]).map(r => r.device_id);

      for (const linkedDeviceId of linkedDeviceIds) {
        await db.execute(sql`DELETE FROM user_stats WHERE device_id = ${linkedDeviceId}`);
        await db.execute(sql`DELETE FROM app_subscriptions WHERE device_id = ${linkedDeviceId}`);
        await db.execute(sql`DELETE FROM device_tokens WHERE device_id = ${linkedDeviceId}`);
      }

      await db.execute(sql`DELETE FROM user_profiles WHERE lower(email) = ${email}`);
      await db.execute(sql`DELETE FROM app_subscriptions WHERE lower(email) = ${email}`);
      await db.execute(sql`DELETE FROM restore_tokens WHERE lower(email) = ${email}`);
    } else {
      await db.execute(sql`DELETE FROM user_profiles WHERE device_id = ${deviceId}`);
      await db.execute(sql`DELETE FROM user_stats WHERE device_id = ${deviceId}`);
      await db.execute(sql`DELETE FROM app_subscriptions WHERE device_id = ${deviceId}`);
      await db.execute(sql`DELETE FROM device_tokens WHERE device_id = ${deviceId}`);
    }
  }
}

export const storage = new DatabaseStorage();

// Auto-create account_stats table on startup (Railway has no migration runner)
export async function initializeDb(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS account_stats (
        email TEXT PRIMARY KEY,
        subscription_status TEXT NOT NULL DEFAULT 'none',
        subscription_expires_at TIMESTAMP,
        total_wins INTEGER NOT NULL DEFAULT 0,
        active_days INTEGER NOT NULL DEFAULT 0,
        reflections INTEGER NOT NULL DEFAULT 0,
        focus_breakdown TEXT NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Add install_date column if it doesn't exist yet (safe to run on every startup)
    await db.execute(sql`ALTER TABLE account_stats ADD COLUMN IF NOT EXISTS install_date BIGINT`);
  } catch {}
}

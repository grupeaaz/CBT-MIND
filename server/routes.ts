import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMoodSchema, insertJournalSchema, insertWinSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./storage";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const FREE_WINS_LIMIT = 30;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/moods", async (req, res) => {
    const deviceId = req.headers['x-device-id'] as string;
    if (!deviceId) return res.status(400).json({ message: "Missing device ID" });
    const parsed = insertMoodSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const mood = await storage.createMoodEntry({ ...parsed.data, deviceId });
    return res.status(201).json(mood);
  });

  app.get("/api/moods", async (req, res) => {
    const deviceId = req.headers['x-device-id'] as string;
    if (!deviceId) return res.json([]);
    const moods = await storage.getMoodEntries(deviceId);
    return res.json(moods);
  });

  app.post("/api/journal", async (req, res) => {
    const deviceId = req.headers['x-device-id'] as string;
    if (!deviceId) return res.status(400).json({ message: "Missing device ID" });
    const parsed = insertJournalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const entry = await storage.createJournalEntry({ ...parsed.data, deviceId });
    return res.status(201).json(entry);
  });

  app.get("/api/journal", async (req, res) => {
    const deviceId = req.headers['x-device-id'] as string;
    if (!deviceId) return res.json([]);
    const entries = await storage.getJournalEntries(deviceId);
    return res.json(entries);
  });

  app.get("/api/quotes", async (_req, res) => {
    const quotes = await storage.getQuotes();
    return res.json(quotes);
  });

  app.post("/api/wins", async (req, res) => {
    const deviceId = req.headers['x-device-id'] as string;
    if (!deviceId) return res.status(400).json({ message: "Missing device ID" });
    const parsed = insertWinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const winCount = await storage.getWinCount(deviceId);
    if (winCount >= FREE_WINS_LIMIT) {
      const activeSub = await storage.getActiveSubscription(deviceId);
      if (!activeSub) {
        return res.status(403).json({ message: "subscription_required", requiresSubscription: true });
      }
    }

    const win = await storage.createWin({ ...parsed.data, deviceId });
    return res.status(201).json(win);
  });

  app.get("/api/wins", async (req, res) => {
    const deviceId = req.headers['x-device-id'] as string;
    if (!deviceId) return res.json([]);
    const wins = await storage.getWins(deviceId);
    return res.json(wins);
  });

  app.get("/api/subscription/check", async (req, res) => {
    try {
      const deviceId = req.headers['x-device-id'] as string;
      if (!deviceId) return res.json({ winCount: 0, requiresSubscription: false, hasSubscription: false, freeWinsLimit: FREE_WINS_LIMIT });
      const winCount = await storage.getWinCount(deviceId);
      const activeSub = await storage.getActiveSubscription(deviceId);
      return res.json({
        winCount,
        requiresSubscription: winCount >= FREE_WINS_LIMIT && !activeSub,
        hasSubscription: !!activeSub,
        freeWinsLimit: FREE_WINS_LIMIT,
      });
    } catch {
      return res.json({ winCount: 0, requiresSubscription: false, hasSubscription: false, freeWinsLimit: FREE_WINS_LIMIT });
    }
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      return res.json({ publishableKey: key });
    } catch (error: any) {
      console.error('Error getting publishable key:', error.message);
      return res.status(500).json({ error: 'Failed to get Stripe key' });
    }
  });

  app.post("/api/stripe/create-checkout", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const { email } = req.body;

      const prices = await db.execute(
        sql`SELECT pr.id as price_id
            FROM stripe.prices pr
            JOIN stripe.products p ON pr.product = p.id
            WHERE p.name = 'Presence Premium' AND p.active = true AND pr.active = true
            LIMIT 1`
      );

      let priceId: string;
      if (prices.rows.length > 0) {
        priceId = prices.rows[0].price_id as string;
      } else {
        const allPrices = await stripe.prices.list({ active: true, limit: 1 });
        if (allPrices.data.length === 0) {
          return res.status(400).json({ error: 'No subscription plan available yet' });
        }
        priceId = allPrices.data[0].id;
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: 7,
        },
        customer_email: email || undefined,
        success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/subscription/cancel`,
      });

      return res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Checkout error:', error.message);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.post("/api/stripe/verify-session", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing session ID' });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: 'Missing device ID' });
      }

      if (session.payment_status === 'paid' || session.status === 'complete') {
        let subStatus = 'active';
        const stripeSubId = session.subscription as string;
        if (stripeSubId) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
            subStatus = stripeSub.status;
          } catch {}
        }

        const rawEmail = session.customer_details?.email || session.customer_email || undefined;
        const customerEmail = rawEmail ? rawEmail.toLowerCase().trim() : undefined;

        const sub = await storage.createAppSubscription({
          deviceId,
          email: customerEmail,
          stripeCustomerId: session.customer as string || undefined,
          stripeSubscriptionId: stripeSubId || undefined,
          stripeSubscriptionStatus: subStatus,
          status: (subStatus === 'active' || subStatus === 'trialing') ? 'active' : 'inactive',
        });

        return res.json({ verified: true, subscriptionId: sub.id });
      }

      return res.json({ verified: false });
    } catch (error: any) {
      console.error('Verify session error:', error.message);
      return res.status(500).json({ error: 'Failed to verify session' });
    }
  });

  app.post("/api/subscription/restore", async (req, res) => {
    try {
      const { email, deviceId } = req.body;
      if (!email || !deviceId) {
        return res.status(400).json({ error: "Email and device ID are required" });
      }

      const existingSub = await storage.getActiveSubscriptionByEmail(email.toLowerCase().trim());
      if (existingSub) {
        const linked = await storage.linkDeviceToSubscription(email.toLowerCase().trim(), deviceId);
        if (linked) {
          return res.json({ restored: true, message: "Subscription restored to this device" });
        }
      }

      try {
        const stripe = await getUncachableStripeClient();
        const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });
        if (customers.data.length > 0) {
          const customer = customers.data[0];
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 10,
            expand: ['data.items.data.price.product'],
          });

          const trialSubs = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'trialing',
            limit: 10,
            expand: ['data.items.data.price.product'],
          });

          const allSubs = [...subscriptions.data, ...trialSubs.data];

          const matchingSub = allSubs.find(sub =>
            sub.items.data.some(item => {
              const product = item.price.product;
              const productName = typeof product === 'object' && product !== null ? (product as any).name : null;
              return productName === 'Presence Premium';
            })
          );

          if (matchingSub) {
            const stripeSub = matchingSub;
            await storage.createAppSubscription({
              deviceId,
              email: email.toLowerCase().trim(),
              stripeCustomerId: customer.id,
              stripeSubscriptionId: stripeSub.id,
              stripeSubscriptionStatus: stripeSub.status,
              status: 'active',
            });
            return res.json({ restored: true, message: "Subscription restored from Stripe" });
          }
        }
      } catch (stripeErr: any) {
        console.error("Stripe lookup error:", stripeErr.message);
      }

      return res.json({ restored: false, message: "No active subscription found for this email" });
    } catch (error: any) {
      console.error("Restore error:", error.message);
      return res.status(500).json({ error: "Failed to restore subscription" });
    }
  });

  app.get("/api/subscription/details", async (req, res) => {
    try {
      const deviceId = req.headers['x-device-id'] as string;
      if (!deviceId) {
        return res.json({ hasSubscription: false });
      }

      const activeSub = await storage.getActiveSubscription(deviceId);
      if (!activeSub || !activeSub.stripeSubscriptionId) {
        return res.json({ hasSubscription: false });
      }

      const stripe = await getUncachableStripeClient();
      const stripeSub = await stripe.subscriptions.retrieve(activeSub.stripeSubscriptionId);

      const currentPeriodEnd = new Date((stripeSub as any).current_period_end * 1000);
      const cancelAtPeriodEnd = (stripeSub as any).cancel_at_period_end;

      return res.json({
        hasSubscription: true,
        status: stripeSub.status,
        validUntil: currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd,
        email: activeSub.email,
      });
    } catch (error: any) {
      console.error("Subscription details error:", error.message);
      return res.json({ hasSubscription: false });
    }
  });

  app.post("/api/subscription/cancel", async (req, res) => {
    try {
      const deviceId = req.headers['x-device-id'] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Missing device ID" });
      }

      const activeSub = await storage.getActiveSubscription(deviceId);
      if (!activeSub || !activeSub.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(activeSub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      return res.json({ cancelled: true });
    } catch (error: any) {
      console.error("Cancel subscription error:", error.message);
      return res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  app.get("/api/insights/daily", async (req, res) => {
    try {
      const deviceId = req.headers['x-device-id'] as string;
      if (!deviceId) return res.json({ insight: null, date: new Date().toISOString().split('T')[0] });
      const today = new Date().toISOString().split('T')[0];

      const cached = await storage.getDailyInsight(today, deviceId);
      if (cached) {
        return res.json({ insight: cached.insight, date: today });
      }

      const allWins = await storage.getWins(deviceId, 100);
      if (allWins.length === 0) {
        return res.json({ insight: "Start your healing journey by working through your first focus area. Each win builds your awareness and resilience.", date: today });
      }

      const focusBreakdown: Record<string, number> = {};
      const allDysfunctions: Record<string, number> = {};
      allWins.forEach(w => {
        focusBreakdown[w.focusArea] = (focusBreakdown[w.focusArea] || 0) + 1;
        if (w.dysfunctions) {
          w.dysfunctions.forEach(d => {
            allDysfunctions[d] = (allDysfunctions[d] || 0) + 1;
          });
        }
      });

      const uniqueDays = new Set(allWins.map(w => w.createdAt?.toISOString().split('T')[0])).size;

      const summaryData = {
        totalWins: allWins.length,
        activeDays: uniqueDays,
        focusBreakdown,
        topDysfunctions: Object.entries(allDysfunctions).sort((a, b) => b[1] - a[1]).slice(0, 5),
        recentWins: allWins.slice(0, 5).map(w => ({
          focusArea: w.focusArea,
          nameIt: w.nameIt,
          dysfunctions: w.dysfunctions,
          advocacy: w.advocacy,
        })),
      };

      const sources = ["CBT (Cognitive Behaviour Therapy)", "Eckhart Tolle teachings", "Buddhism"];
      const todaySource = sources[new Date().getDate() % 3];

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a healing guide. Today you draw ONLY from ${todaySource}. Based on the user's wins data, write exactly 3 very short sentences (3-6 words each). Style: "Embrace each win with gratitude. Cultivate gratitude. Be thankful." Use "you" voice. No explanations, no fluff. Output only the 3 tiny sentences.`,
          },
          {
            role: "user",
            content: `My healing journey stats:\n${JSON.stringify(summaryData, null, 2)}`,
          },
        ],
        max_tokens: 200,
      });

      const insight = completion.choices[0]?.message?.content || "Unable to generate insights at this time.";

      await storage.saveDailyInsight(today, deviceId, insight);

      return res.json({ insight, date: today });
    } catch (error: any) {
      console.error("Insights generation error:", error.message);
      return res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  app.get("/api/insights/stats", async (req, res) => {
    try {
      const deviceId = req.headers['x-device-id'] as string;
      if (!deviceId) return res.json({ totalWins: 0, activeDays: 0, focusBreakdown: {}, topDysfunctions: [] });
      const allWins = await storage.getWins(deviceId, 100);
      const focusBreakdown: Record<string, number> = {};
      const allDysfunctions: Record<string, number> = {};
      allWins.forEach(w => {
        focusBreakdown[w.focusArea] = (focusBreakdown[w.focusArea] || 0) + 1;
        if (w.dysfunctions) {
          w.dysfunctions.forEach(d => {
            allDysfunctions[d] = (allDysfunctions[d] || 0) + 1;
          });
        }
      });
      const uniqueDays = new Set(allWins.map(w => w.createdAt?.toISOString().split('T')[0])).size;
      return res.json({
        totalWins: allWins.length,
        activeDays: uniqueDays,
        focusBreakdown,
        topDysfunctions: Object.entries(allDysfunctions).sort((a, b) => b[1] - a[1]).slice(0, 5),
      });
    } catch (error: any) {
      console.error("Stats error:", error.message);
      return res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/push/vapid-key", (_req, res) => {
    return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription" });
      }
      await storage.savePushSubscription({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Push subscribe error:", error.message);
      return res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "Missing endpoint" });
      }
      await storage.deletePushSubscription(endpoint);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Push unsubscribe error:", error.message);
      return res.status(500).json({ error: "Failed to remove subscription" });
    }
  });

  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMoodSchema, insertJournalSchema, insertWinSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./storage";
import { sql } from "drizzle-orm";
import OpenAI from "openai";
import crypto from "crypto";

const FREE_WINS_LIMIT = 30;

// Fix 2: Centralized OpenAI client — instantiated once, not per-request
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Fix 1: Middleware to authenticate requests via device token
// Attaches req.authenticatedDeviceId if token is valid
async function requireDeviceAuth(req: any, res: any, next: any) {
  const token = req.headers['x-device-token'] as string;
  const rawDeviceId = req.headers['x-device-id'] as string;

  if (token) {
    const deviceId = await storage.getDeviceIdByToken(token);
    if (!deviceId) {
      return res.status(401).json({ message: "Invalid device token" });
    }
    req.authenticatedDeviceId = deviceId;
    return next();
  }

  // Fallback: accept raw deviceId header (for backwards compatibility during rollout)
  if (rawDeviceId) {
    req.authenticatedDeviceId = rawDeviceId;
    return next();
  }

  return res.status(400).json({ message: "Missing device identification" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Fix 1: Device token registration endpoint
  // Client calls this once on first launch, stores the returned token securely
  app.post("/api/device/register", async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId || typeof deviceId !== "string" || deviceId.length < 8) {
        return res.status(400).json({ message: "Invalid device ID" });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const dt = await storage.createDeviceToken(deviceId, token);
      return res.status(201).json({ token: dt.token, deviceId: dt.deviceId });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to register device" });
    }
  });

  app.post("/api/moods", requireDeviceAuth, async (req: any, res) => {
    const deviceId = req.authenticatedDeviceId;
    const parsed = insertMoodSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const mood = await storage.createMoodEntry({ ...parsed.data, deviceId });
    return res.status(201).json(mood);
  });

  app.get("/api/moods", requireDeviceAuth, async (req: any, res) => {
    const moods = await storage.getMoodEntries(req.authenticatedDeviceId);
    return res.json(moods);
  });

  app.post("/api/journal", requireDeviceAuth, async (req: any, res) => {
    const deviceId = req.authenticatedDeviceId;
    const parsed = insertJournalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const entry = await storage.createJournalEntry({ ...parsed.data, deviceId });
    return res.status(201).json(entry);
  });

  app.get("/api/journal", requireDeviceAuth, async (req: any, res) => {
    const entries = await storage.getJournalEntries(req.authenticatedDeviceId);
    return res.json(entries);
  });

  app.get("/api/quotes", async (_req, res) => {
    const quotes = await storage.getQuotes();
    return res.json(quotes);
  });

  app.post("/api/wins", requireDeviceAuth, async (req: any, res) => {
    const deviceId = req.authenticatedDeviceId;
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

  app.get("/api/wins", requireDeviceAuth, async (req: any, res) => {
    const wins = await storage.getWins(req.authenticatedDeviceId);
    return res.json(wins);
  });

  app.post("/api/analyze-distortions", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 3) {
        return res.json({ distortions: [] });
      }

      const distortionList = [
        "All or nothing",
        "Generalization",
        "Mental filter - only negative details are filtered",
        "Devaluing positive things",
        "Jumping to conclusions (mind reading and predicting the future)",
        "Overemphasizing and underemphasizing (I overemphasize my mistakes, I underemphasize my strengths)",
        "Emotional thinking - I rely on emotions as facts (I feel guilty - it means I did something wrong, I feel stupid - it means I did something stupid)",
        'Thinking "I should", "I must", "I should/could have"',
        "Labeling and mislabeling",
        "Personalization - I tend to take responsibility for everything, even though I have nothing to do with it",
      ];

      const langDetect = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Detect the language of the user's text. Reply with ONLY the language name in English (e.g. 'Lithuanian', 'English', 'Spanish', 'German'). Nothing else." },
          { role: "user", content: text },
        ],
        max_tokens: 10,
      });
      const detectedLanguage = langDetect.choices[0]?.message?.content?.trim() || "English";

      const distortionResult = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a strict CBT therapist trained exclusively on Cognitive Behaviour Therapy. You got a patient's mind thought and you give a consultant answer — which of the 10 cognitive distortions it is. Translate the distortion names to the same language as the user input.

The 10 cognitive distortions:
${distortionList.map((d, i) => `${i}: ${d}`).join("\n")}

If the thought is rational and healthy with no distortion, return [].
Return ONLY a JSON array of matching distortion indices. Example: [0, 2, 5] or []. Nothing else.`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 100,
      });

      const raw = distortionResult.choices[0]?.message?.content || "[]";
      const match = raw.match(/\[[\d,\s]*\]/);
      let indices: number[] = [];
      try {
        indices = match ? JSON.parse(match[0]) : [];
      } catch {
        indices = [];
      }
      const matched = indices
        .filter((i) => typeof i === "number" && i >= 0 && i < distortionList.length)
        .map((i) => distortionList[i]);
      
      // Translate distortion names to detected language
      let translatedDistortions = matched;
      if (detectedLanguage !== "English") {
        const translateResult = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: `Translate these CBT cognitive distortion names to ${detectedLanguage}. Return ONLY a JSON array of translated strings in the same order. Nothing else.` },
            { role: "user", content: JSON.stringify(matched) },
          ],
          max_tokens: 300,
        });
        try {
          const raw = translateResult.choices[0]?.message?.content || "[]";
          const clean = raw.replace(/```json|```/g, "").trim();
          translatedDistortions = JSON.parse(clean);
        } catch {
          translatedDistortions = matched;
        }
      }

      const distortionNames = translatedDistortions.map(d => d.split(" - ")[0].split(" (")[0]);

      const advocacyResult = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: matched.length > 0
              ? `You are a CBT therapist using David D. Burns' "Feeling Good: The New Mood Therapy" rational response technique. The user's thought contains these cognitive distortions: ${distortionNames.join(", ")}. Write a rational response (2-3 sentences) that directly challenges each identified distortion using Burns' method: use objective evidence and logical reasoning to counter the distorted thought. Use "I" voice as if the user is writing a rational response to their own automatic thought. Name the specific distortions being challenged. Be factual and grounded — never offer generic comfort or encouragement. YOU MUST WRITE YOUR ENTIRE RESPONSE IN ${detectedLanguage.toUpperCase()}. Do not use any other language.`
              : `You are a CBT therapist using David D. Burns' "Feeling Good: The New Mood Therapy". The user's thought contains no cognitive distortion — it is a healthy, rational thought. Write a brief affirming response (1-2 sentences) in "I" voice acknowledging this is balanced thinking. YOU MUST WRITE YOUR ENTIRE RESPONSE IN ${detectedLanguage.toUpperCase()}. Do not use any other language.`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 200,
      });

      const advocacy = advocacyResult.choices[0]?.message?.content || "";

      let noDistortionMessage = "";
      if (matched.length === 0) {
        try {
          const msgResult = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `The user wrote a thought that has no cognitive distortion. Your response MUST start with "Its not a disfunction!" as the first sentence. Then add a short, warm, encouraging message (1 sentence) telling them this is a healthy human thought. YOU MUST WRITE YOUR ENTIRE RESPONSE IN ${detectedLanguage.toUpperCase()} (translate "Its not a disfunction!" to that language too). Do not use any other language. Output only the message, nothing else.`,
              },
              { role: "user", content: text },
            ],
            max_tokens: 100,
          });
          noDistortionMessage = msgResult.choices[0]?.message?.content || "";
        } catch {}
      }

      return res.json({ distortions: matched, advocacy, noDistortionMessage });
    } catch (error: any) {
      return res.json({ distortions: [] });
    }
  });

  app.get("/api/subscription/check", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
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
      return res.status(500).json({ error: 'Failed to get Stripe key' });
    }
  });

  app.post("/api/stripe/create-checkout", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const { email } = req.body;

      let priceId: string | null = null;

      try {
        const prices = await db.execute(
          sql`SELECT pr.id as price_id
              FROM stripe.prices pr
              JOIN stripe.products p ON pr.product = p.id
              WHERE p.name = 'Presence Premium' AND p.active = true AND pr.active = true
              LIMIT 1`
        );
        if (prices.rows.length > 0) {
          priceId = prices.rows[0].price_id as string;
        }
      } catch {}

      if (!priceId) {
        try {
          const products = await stripe.products.search({ query: "name:'Presence Premium'" });
          if (products.data.length > 0) {
            const productPrices = await stripe.prices.list({ product: products.data[0].id, active: true, limit: 1 });
            if (productPrices.data.length > 0) {
              priceId = productPrices.data[0].id;
            }
          }
        } catch {}
      }

      if (!priceId) {
        try {
          const allPrices = await stripe.prices.list({ active: true, limit: 10 });
          const recurringPrice = allPrices.data.find(p => p.recurring?.interval === 'year');
          if (recurringPrice) {
            priceId = recurringPrice.id;
          } else if (allPrices.data.length > 0) {
            priceId = allPrices.data[0].id;
          }
        } catch {}
      }

      if (!priceId) {
        return res.status(400).json({ error: 'No subscription plan available yet' });
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
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.post("/api/stripe/verify-session", async (req, res) => {
    try {
      const { sessionId, deviceId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'Missing session ID' });
      if (!deviceId) return res.status(400).json({ error: 'Missing device ID' });

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

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

        // Fix 5: Check for existing subscription before creating to avoid duplicates
        const existingSub = await storage.getActiveSubscription(deviceId);
        if (existingSub) {
          return res.json({ verified: true, subscriptionId: existingSub.id });
        }

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
      }

      return res.json({ restored: false, message: "No active subscription found for this email" });
    } catch (error: any) {
      return res.status(500).json({ error: "Failed to restore subscription" });
    }
  });

  app.get("/api/subscription/details", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
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
      return res.json({ hasSubscription: false });
    }
  });

  app.post("/api/subscription/cancel", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
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
      return res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  app.get("/api/insights/daily", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      const today = new Date().toISOString().split('T')[0];

      const cached = await storage.getDailyInsight(today, deviceId);
      if (cached) {
        return res.json({ insight: cached.insight, date: today });
      }

      // Fix 4: Fetch ALL wins (no 100 cap) for accurate insights analysis
      const allWins = await storage.getWins(deviceId, 10000);
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

      // Fix 2: Use centralized openai instance
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
      // Fix 3: Return graceful fallback instead of 500 so frontend can show it
      return res.json({ insight: "Take a breath. Each step forward is progress, no matter how small.", date: new Date().toISOString().split('T')[0] });
    }
  });

  app.get("/api/insights/stats", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      // Fix 4: Fetch ALL wins for accurate stats
      const allWins = await storage.getWins(deviceId, 10000);
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
      return res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/push/vapid-key", (_req, res) => {
    return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });

  // Fix 6: Store deviceId with push subscription for targeted notifications
  app.post("/api/push/subscribe", requireDeviceAuth, async (req: any, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription" });
      }
      await storage.savePushSubscription({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceId: req.authenticatedDeviceId,
      });
      return res.json({ success: true });
    } catch (error: any) {
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
      return res.status(500).json({ error: "Failed to remove subscription" });
    }
  });

  return httpServer;
}


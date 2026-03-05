import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./storage";
import { appSubscriptions } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import OpenAI from "openai";
import crypto from "crypto";

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


  app.get("/api/quotes", async (_req, res) => {
    const quotes = await storage.getQuotes();
    return res.json(quotes);
  });


  app.post("/api/journal/reflect", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 3) {
        return res.status(400).json({ error: "No text provided" });
      }
      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a wise philosophical teacher deeply grounded in Eckhart Tolle's teachings — presence, the Now, the ego, inner stillness, and consciousness. Comment on the user's thought in 1-3 short, calm sentences. Speak directly to them, gently and without judgment. WRITE IN THE SAME LANGUAGE AS THE USER'S TEXT.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 200,
      });
      const reflection = result.choices[0]?.message?.content?.trim() || "";
      return res.json({ reflection });
    } catch {
      return res.status(500).json({ error: "Failed to generate reflection" });
    }
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

      // Single call: detect language, find distortions, translate names, write advocacy — all at once
      const combinedResult = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a strict CBT therapist. Analyse the user's thought and return a single JSON object with these fields:

- "language": the language name in English of the user's text (e.g. "English", "Lithuanian", "Spanish")
- "distortionIndices": array of indices (0-9) of matching cognitive distortions, or [] if none
- "distortionNames": the matching distortion names TRANSLATED into the user's language (same order as indices), or []
- "advocacy": if distortions found — a rational response (2-3 sentences, "I" voice, Burns method, challenges each distortion by name, factual not comforting); if no distortions — a brief affirming 1-2 sentence "I" voice response. WRITE IN THE USER'S LANGUAGE.
- "noDistortionMessage": ONLY if distortionIndices is [] — a message starting with the translation of "Its not a disfunction!" followed by one warm encouraging sentence. WRITE IN THE USER'S LANGUAGE. Otherwise set to "".

The 10 cognitive distortions (use these exact English names as the basis for translation):
${distortionList.map((d, i) => `${i}: ${d}`).join("\n")}

Return ONLY valid JSON, nothing else.`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 600,
      });

      let parsedResult: any = {};
      try {
        parsedResult = JSON.parse(combinedResult.choices[0]?.message?.content || "{}");
      } catch {
        parsedResult = {};
      }

      const indices: number[] = Array.isArray(parsedResult.distortionIndices)
        ? parsedResult.distortionIndices.filter((i: any) => typeof i === "number" && i >= 0 && i < distortionList.length)
        : [];

      const translatedDistortions: string[] = Array.isArray(parsedResult.distortionNames) && parsedResult.distortionNames.length === indices.length
        ? parsedResult.distortionNames
        : indices.map((i) => distortionList[i]);

      const advocacy: string = parsedResult.advocacy || "";
      const noDistortionMessage: string = parsedResult.noDistortionMessage || "";

      return res.json({ distortions: translatedDistortions, advocacy, noDistortionMessage });
    } catch (error: any) {
      return res.json({ distortions: [] });
    }
  });

  app.get("/api/subscription/check", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      let activeSub = await storage.getActiveSubscription(deviceId);
      if (!activeSub) {
        const profile = await storage.getUserProfile(deviceId);
        if (profile?.email) activeSub = await storage.getActiveSubscriptionByEmail(profile.email) ?? undefined;
      }
      return res.json({ hasSubscription: !!activeSub });
    } catch {
      return res.json({ hasSubscription: false });
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

      // Only offer free trial to first-time subscribers
      const normalizedEmail = email ? email.toLowerCase().trim() : null;
      const priorSubscription = normalizedEmail
        ? await db.select().from(appSubscriptions).where(eq(appSubscriptions.email, normalizedEmail)).limit(1)
        : [];
      const isReturningSubscriber = priorSubscription.length > 0;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        subscription_data: isReturningSubscriber ? {} : { trial_period_days: 7 },
        customer_email: normalizedEmail || undefined,
        success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/subscription/cancel`,
      });

      return res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Checkout error:', error);
      return res.status(500).json({ error: 'Failed to create checkout session', detail: error?.message });
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
          // Also fetch the user's saved profile and stats from their original device
          const oldDeviceId = existingSub.deviceId;
          const savedProfile = await storage.getUserProfile(oldDeviceId).catch(() => null);
          const savedStats = await storage.getUserStats(oldDeviceId).catch(() => null);
          return res.json({
            restored: true,
            message: "Subscription restored to this device",
            profile: savedProfile || null,
            stats: savedStats || null,
          });
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
            // Try to find saved profile/stats by email for this user
            const savedProfile = await storage.getUserProfileByEmail(email.toLowerCase().trim()).catch(() => null);
            const savedStats = savedProfile ? await storage.getUserStats(savedProfile.deviceId).catch(() => null) : null;
            return res.json({
              restored: true,
              message: "Subscription restored from Stripe",
              profile: savedProfile || null,
              stats: savedStats || null,
            });
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
      let activeSub = await storage.getActiveSubscription(deviceId);
      if (!activeSub) {
        const profile = await storage.getUserProfile(deviceId);
        if (profile?.email) activeSub = await storage.getActiveSubscriptionByEmail(profile.email) ?? undefined;
      }
      if (!activeSub || !activeSub.stripeSubscriptionId) {
        return res.json({ hasSubscription: false });
      }

      const stripe = await getUncachableStripeClient();
      const stripeSub = await stripe.subscriptions.retrieve(activeSub.stripeSubscriptionId);

      const periodEndTimestamp = (stripeSub as any).current_period_end || (stripeSub as any).trial_end;
      const validUntil = periodEndTimestamp ? new Date(periodEndTimestamp * 1000).toISOString() : null;
      const cancelAtPeriodEnd = (stripeSub as any).cancel_at_period_end;

      return res.json({
        hasSubscription: true,
        status: stripeSub.status,
        validUntil,
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
      let activeSub = await storage.getActiveSubscription(deviceId);
      if (!activeSub) {
        const profile = await storage.getUserProfile(deviceId);
        if (profile?.email) activeSub = await storage.getActiveSubscriptionByEmail(profile.email) ?? undefined;
      }
      if (!activeSub || !activeSub.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.cancel(activeSub.stripeSubscriptionId);

      // Mark subscription as inactive in DB immediately
      const { and } = await import("drizzle-orm");
      await db.update(appSubscriptions)
        .set({ status: "inactive" })
        .where(and(eq(appSubscriptions.stripeSubscriptionId, activeSub.stripeSubscriptionId)));

      return res.json({ cancelled: true });
    } catch (error: any) {
      return res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  app.post("/api/insights/daily", async (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allWins: any[] = req.body.wins || [];
      if (allWins.length === 0) {
        return res.json({ insight: "Start your healing journey by working through your first focus area. Each win builds your awareness and resilience.", date: today });
      }

      const focusBreakdown: Record<string, number> = {};
      const allDysfunctions: Record<string, number> = {};
      allWins.forEach(w => {
        focusBreakdown[w.focusArea] = (focusBreakdown[w.focusArea] || 0) + 1;
        if (w.dysfunctions) {
          w.dysfunctions.forEach((d: string) => {
            allDysfunctions[d] = (allDysfunctions[d] || 0) + 1;
          });
        }
      });

      const uniqueDays = new Set(allWins.map(w => w.createdAt?.split('T')[0])).size;

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

      return res.json({ insight, date: today });
    } catch (error: any) {
      return res.json({ insight: "Take a breath. Each step forward is progress, no matter how small.", date: new Date().toISOString().split('T')[0] });
    }
  });

  app.get("/api/push/vapid-key", (_req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }
    return res.json({ publicKey });
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

  // Request a one-time restore link sent to the user's email
  app.post("/api/restore/request", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }
      const normalizedEmail = email.toLowerCase().trim();

      // Check that we have a saved profile for this email
      const profile = await storage.getUserProfileByEmail(normalizedEmail);
      if (!profile) {
        // Return same success message to avoid email enumeration
        return res.json({ sent: true });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await storage.createRestoreToken(normalizedEmail, token, expiresAt);

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const restoreUrl = `${baseUrl}/restore?token=${token}`;

      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CBT MIND <onboarding@resend.dev>",
            to: normalizedEmail,
            subject: "Your restore link — valid for 5 minutes",
            html: `
              <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
                <h2 style="font-size: 28px; font-weight: normal; margin-bottom: 12px;">Restore your account</h2>
                <p style="color: #666; margin-bottom: 32px;">Click the button below to restore your name and journey stats. This link works only once and expires in <strong>5 minutes</strong>.</p>
                <a href="${restoreUrl}" style="display: inline-block; background: #17CF20; color: white; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-size: 16px; font-weight: 500;">Restore My Account</a>
                <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn't request this, you can ignore this email.</p>
              </div>
            `,
          }),
        });

        if (!emailRes.ok) {
          const errorBody = await emailRes.text();
          console.error("Resend API error:", emailRes.status, errorBody);
          return res.status(500).json({ error: "Failed to send email. Please try again." });
        }
      } else {
        console.error("RESEND_API_KEY is not set");
        return res.status(500).json({ error: "Email service not configured." });
      }

      return res.json({ sent: true });
    } catch {
      return res.status(500).json({ error: "Failed to send restore link" });
    }
  });

  // Validate a restore token and return the user's profile + stats
  app.get("/api/restore/validate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const row = await storage.getRestoreToken(token);

      if (!row) {
        return res.status(404).json({ valid: false, error: "Invalid restore link" });
      }
      if (row.usedAt) {
        return res.status(410).json({ valid: false, error: "This link has already been used" });
      }
      if (new Date() > row.expiresAt) {
        return res.status(410).json({ valid: false, error: "This link has expired. Please request a new one." });
      }

      await storage.markRestoreTokenUsed(token);

      const profile = await storage.getUserProfileByEmail(row.email);
      const savedStats = profile ? await storage.getUserStats(profile.deviceId).catch(() => null) : null;

      return res.json({
        valid: true,
        email: row.email,
        profile: profile || null,
        stats: savedStats || null,
      });
    } catch {
      return res.status(500).json({ valid: false, error: "Failed to validate restore link" });
    }
  });

  // Emergency cleanup by email — opens in browser, no auth needed, temporary
  app.get("/api/admin/cleanup-email", async (req, res) => {
    try {
      const email = ((req.query.email as string) || "").toLowerCase().trim();
      if (!email) return res.send("Missing ?email= param");
      await storage.deleteAllDeviceData("none", email);
      return res.send(`Done. All data for ${email} has been deleted. You can now register again.`);
    } catch (err: any) {
      return res.status(500).send("Error: " + err.message);
    }
  });

  // Delete all data for a device — right to be forgotten
  app.delete("/api/user/account", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      const emailFromClient = req.body?.email as string | undefined;
      await storage.deleteAllDeviceData(deviceId, emailFromClient);
      return res.json({ deleted: true });
    } catch {
      return res.status(500).json({ error: "Failed to delete account data" });
    }
  });

  // Check if an email is already registered in user_profiles
  app.get("/api/user/email-exists", async (req, res) => {
    try {
      const email = (req.query.email as string || "").toLowerCase().trim();
      if (!email) return res.json({ exists: false });
      const profile = await storage.getUserProfileByEmail(email);
      return res.json({ exists: !!profile });
    } catch {
      return res.json({ exists: false });
    }
  });

  // Save user profile (name + email) to user_profiles table
  app.post("/api/user/profile", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      const { name, email } = req.body;
      const profile = await storage.saveUserProfile(deviceId, name, email);
      return res.json(profile);
    } catch {
      return res.status(500).json({ error: "Failed to save profile" });
    }
  });

  // Get user profile from user_profiles table
  app.get("/api/user/profile", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      const profile = await storage.getUserProfile(deviceId);
      return res.json(profile || { deviceId, name: null, email: null });
    } catch {
      return res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Save insights stats + subscription expiry to user_stats table
  app.post("/api/user/stats", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      const { totalWins, activeDays, reflections, focusBreakdown, subscriptionExpiresAt } = req.body;
      const focusBreakdownString = typeof focusBreakdown === "object"
        ? JSON.stringify(focusBreakdown)
        : (focusBreakdown || "{}");
      const expiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
      const savedStats = await storage.saveUserStats(deviceId, {
        totalWins: totalWins || 0,
        activeDays: activeDays || 0,
        reflections: reflections || 0,
        focusBreakdown: focusBreakdownString,
        subscriptionExpiresAt: expiresAt,
      });
      return res.json(savedStats);
    } catch {
      return res.status(500).json({ error: "Failed to save stats" });
    }
  });

  // Get insights stats from user_stats table
  app.get("/api/user/stats", requireDeviceAuth, async (req: any, res) => {
    try {
      const deviceId = req.authenticatedDeviceId;
      const stats = await storage.getUserStats(deviceId);
      return res.json(stats || null);
    } catch {
      return res.status(500).json({ error: "Failed to get stats" });
    }
  });

  return httpServer;
}


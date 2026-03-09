import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { initPushNotifications } from './pushNotifications';
import { initializeDb } from './storage';

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function ensureStripeProduct() {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.search({ query: "name:'Presence Premium'" });
    if (products.data.length > 0) {
      return;
    }

    const product = await stripe.products.create({
      name: 'Presence Premium',
      description: 'Unlimited access to all CBT healing tools, wisdom, and practices. €2/month billed yearly.',
      metadata: { app: 'presence', type: 'subscription' },
    });

    await stripe.prices.create({
      product: product.id,
      unit_amount: 2400,
      currency: 'eur',
      recurring: { interval: 'year' },
      metadata: { display_price: '€2/month', billing: 'yearly' },
    });

  } catch {
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  try {
    await runMigrations({ databaseUrl });

    const stripeSync = await getStripeSync();

    const replitDomains = process.env.REPLIT_DOMAINS;
    if (replitDomains) {
      const webhookBaseUrl = `https://${replitDomains.split(',')[0]}`;
      try {
        await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
      } catch {}
    }

    await ensureStripeProduct();

    stripeSync.syncBackfill().catch(() => {});
  } catch {
  }
}

initStripe().catch(() => {});
initPushNotifications();
initializeDb().catch(() => {});

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

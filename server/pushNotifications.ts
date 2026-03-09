// @ts-ignore
import webpush from 'web-push';
import cron from 'node-cron';
import { storage } from './storage';

const eveningMessages = [
  "How are your thoughts? All good? 🌙",
  "Evening check-in: How are you feeling right now? 💭",
  "Take a moment to notice your thoughts. Need to let something slide? 🍃",
  "Your evening reminder: You are not your thoughts. 🌿",
  "How was your day? Time to reflect and let go. ✨",
  "Checking in — any thoughts you'd like to process? 🌸",
  "The day is winding down. How are your thoughts? 🌅",
];

export function initPushNotifications() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE;

  if (!publicKey || !privateKey) {
    return;
  }

  webpush.setVapidDetails(
    'mailto:presence@app.com',
    publicKey,
    privateKey
  );

  cron.schedule('0 20 * * *', async () => {
    await sendEveningNotifications();
  });
}

export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  const subscriptions = await storage.getAllPushSubscriptions();

  if (subscriptions.length === 0) {
    return { success: false, error: "No push subscription found. Make sure notifications are enabled." };
  }

  const payload = JSON.stringify({
    title: 'CBT Guide',
    body: 'Test notification — it works! 🎉',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/' },
  });

  let sent = false;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent = true;
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await storage.deletePushSubscription(sub.endpoint);
      }
    }
  }

  return sent ? { success: true } : { success: false, error: "Subscription expired. Toggle notifications off and on again." };
}

export async function sendEveningNotifications() {
  const subscriptions = await storage.getAllPushSubscriptions();

  if (subscriptions.length === 0) {
    return;
  }

  const message = eveningMessages[Math.floor(Math.random() * eveningMessages.length)];

  const payload = JSON.stringify({
    title: 'CBT Guide',
    body: message,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/' },
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await storage.deletePushSubscription(sub.endpoint);
      }
    }
  }
}

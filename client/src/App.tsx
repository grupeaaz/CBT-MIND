import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Insights from "@/pages/Insights";
import Journal from "@/pages/Journal";
import Profile from "@/pages/Profile";
import Onboarding from "@/components/Onboarding";
import FocusSelection from "@/pages/FocusSelection";
import FocusDetail from "@/pages/FocusDetail";
import Wins from "@/pages/Wins";
import Subscribe from "@/pages/Subscribe";
import SubscriptionSuccess from "@/pages/SubscriptionSuccess";
import RestoreLanding from "@/pages/RestoreLanding";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import { useState, useEffect } from "react";
import { getDeviceId } from "./lib/queryClient";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function autoEnableNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (localStorage.getItem("push_auto_done")) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      localStorage.setItem("push_auto_done", "1");
      return;
    }

    const keyRes = await fetch("/api/push/vapid-key", { headers: { "X-Device-Id": getDeviceId() } });
    const { publicKey } = await keyRes.json();
    if (!publicKey) return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
      }),
    });

    localStorage.setItem("push_auto_done", "1");
  } catch {}
}

function Router() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("hasSeenOnboarding") || !localStorage.getItem("cbt_user_email");
  });
  const [location] = useLocation();

  // Restore magic link takes priority over everything
  if (location.startsWith("/restore")) {
    return <RestoreLanding />;
  }

  // Re-check localStorage directly on every render so restore redirect works instantly
  const needsOnboarding = showOnboarding &&
    (!localStorage.getItem("hasSeenOnboarding") || !localStorage.getItem("cbt_user_email"));

  if (needsOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <Switch>
      <Route path="/" component={FocusSelection} />
      <Route path="/focus/:id" component={FocusDetail} />
      <Route path="/wins" component={Wins} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/subscription/success" component={SubscriptionSuccess} />
      <Route path="/subscription/cancel" component={FocusSelection} />
      <Route path="/insights" component={Insights} />
      <Route path="/practices">{() => <Redirect to="/insights" />}</Route>
      <Route path="/journal" component={Journal} />
      <Route path="/profile" component={Profile} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route component={NotFound} />
    </Switch>
  );
}

async function migrateLocalWinsToDb() {
  if (localStorage.getItem("cbt_wins_migrated")) return;
  const localWins: any[] = (() => {
    try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]"); } catch { return []; }
  })();
  if (localWins.length === 0) { localStorage.setItem("cbt_wins_migrated", "1"); return; }

  const focusBreakdown: Record<string, number> = {};
  localWins.forEach((w: any) => {
    if (w.focusArea) focusBreakdown[w.focusArea] = (focusBreakdown[w.focusArea] || 0) + 1;
  });
  const activeDays = new Set(localWins.map((w: any) => w.createdAt?.split("T")[0]).filter(Boolean)).size;
  const journalCount = (() => { try { return JSON.parse(localStorage.getItem("cbt_journal") || "[]").length; } catch { return 0; } })();

  try {
    // Fetch current server stats first so we don't overwrite a higher count from another device
    const statsRes = await fetch("/api/user/stats", { headers: { "X-Device-Id": getDeviceId() } });
    const serverStats = statsRes.ok ? await statsRes.json() : null;
    const serverTotal = serverStats?.totalWins || 0;
    const totalWins = Math.max(localWins.length, serverTotal);

    await fetch("/api/user/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
      body: JSON.stringify({ totalWins, activeDays, reflections: journalCount, focusBreakdown, winsData: localWins }),
    });
    localStorage.setItem("cbt_wins_migrated", "1");
  } catch {}
}

async function autoSyncAcrossDevices() {
  const email = localStorage.getItem("cbt_user_email");
  if (!email) return; // no email linked — nothing to sync
  try {
    const res = await fetch("/api/account/sync-wins", { headers: { "X-Device-Id": getDeviceId() } });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.synced) return;

    // Merge wins
    if (data.wins?.length) {
      const localWins: any[] = (() => { try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]"); } catch { return []; } })();
      const allWins = [...localWins, ...data.wins.map((w: any) => ({
        id: w.id, focusArea: w.focusArea, nameIt: w.nameIt,
        dysfunctions: Array.isArray(w.dysfunctions) ? w.dysfunctions : [],
        advocacy: w.advocacy || "", createdAt: w.createdAt,
      }))];
      const dedupedWins = Object.values(Object.fromEntries(allWins.map((w: any) => [w.id, w]))) as any[];
      dedupedWins.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem("cbt_wins", JSON.stringify(dedupedWins));
    }

    // Merge journals (Reflections)
    if (data.journals?.length) {
      const localJournals: any[] = (() => { try { return JSON.parse(localStorage.getItem("cbt_journal") || "[]"); } catch { return []; } })();
      const allJournals = [...localJournals, ...data.journals.map((j: any) => ({
        id: j.id, content: j.content, tags: Array.isArray(j.tags) ? j.tags : [],
        date: j.date, createdAt: j.createdAt,
      }))];
      const dedupedJournals = Object.values(Object.fromEntries(allJournals.map((j: any) => [j.id, j]))) as any[];
      dedupedJournals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem("cbt_journal", JSON.stringify(dedupedJournals));
    }
  } catch {}
}

function App() {
  useEffect(() => {
    autoEnableNotifications();
    migrateLocalWinsToDb();
    autoSyncAcrossDevices();
    if (localStorage.getItem("hasSeenOnboarding") && !localStorage.getItem("cbt_install_date")) {
      localStorage.setItem("cbt_install_date", Date.now().toString());
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
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
    return !localStorage.getItem("hasSeenOnboarding");
  });
  const [location] = useLocation();

  useEffect(() => {
    if (localStorage.getItem("hasSeenOnboarding")) {
      setShowOnboarding(false);
    }
  }, [location]);

  if (showOnboarding) {
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    autoEnableNotifications();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
import Layout from "@/components/Layout";
import { Award, BookOpen, Bell, BellOff, CreditCard, XCircle, Shield, Mail } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getDeviceId } from "@/lib/queryClient";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Profile() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const moods: any[] = (() => {
    try { return JSON.parse(localStorage.getItem("cbt_moods") || "[]"); } catch { return []; }
  })();

  const journals: any[] = (() => {
    try { return JSON.parse(localStorage.getItem("cbt_journal") || "[]"); } catch { return []; }
  })();

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setNotifSupported(supported);

    if (supported) {
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          setNotificationsEnabled(!!sub);
        }
      });
    }
  }, []);

  const toggleNotifications = async () => {
    if (notifLoading) return;
    setNotifLoading(true);

    try {
      if (notificationsEnabled) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await fetch("/api/push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
          }
        }
        setNotificationsEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setNotifLoading(false);
          return;
        }

        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const keyRes = await fetch("/api/push/vapid-key", { headers: { "X-Device-Id": getDeviceId() } });
        const { publicKey } = await keyRes.json();

        if (!publicKey) {
          setNotifError("Notifications not available yet. Please try later.");
          setNotifLoading(false);
          return;
        }

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
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            },
          }),
        });

        setNotificationsEnabled(true);
      }
    } catch (error: any) {
      console.error('Notification toggle error:', error);
      setNotifError("Could not set up notifications. Please check your browser settings.");
    }

    setNotifLoading(false);
  };

  const { data: subDetails } = useQuery({
    queryKey: ["/api/subscription/details"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/details", {
        headers: { "X-Device-Id": getDeviceId() },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": getDeviceId(),
        },
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/details"] });
        setCancelConfirm(false);
      }
    } catch (e) {
      console.error(e);
    }
    setCancelLoading(false);
  };

  const wins: any[] = (() => {
    try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]"); } catch { return []; }
  })();

  const totalEntries = journals.length;
  const checkInDays = new Set(wins.map((w: any) => new Date(w.createdAt).toDateString())).size;

  return (
    <Layout>
      <header className="mb-8">
        <h1 className="font-serif text-4xl text-foreground font-medium mb-2">Profile</h1>
        <p className="text-muted-foreground">Your journey to presence.</p>
      </header>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-full bg-stone-200 border-4 border-white shadow-sm" />
        <div>
          <h2 className="text-xl font-medium" data-testid="text-user-name">{localStorage.getItem("userName") || "Seeker"}</h2>
          <p className="text-sm text-muted-foreground">Your healing journey</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <BookOpen size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Entries</span>
          </div>
          <p className="text-3xl font-serif" data-testid="text-total-entries">{totalEntries}</p>
          <p className="text-xs text-muted-foreground mt-1">Journal reflections</p>
        </div>
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-amber-500">
            <Award size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Check-ins</span>
          </div>
          <p className="text-3xl font-serif" data-testid="text-mood-days">{checkInDays}</p>
          <p className="text-xs text-muted-foreground mt-1">Days tracked</p>
        </div>
      </div>

      {notifSupported && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {notificationsEnabled ? (
                <div className="w-10 h-10 bg-primary/15 rounded-full flex items-center justify-center">
                  <Bell size={20} className="text-primary" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-muted/30 rounded-full flex items-center justify-center">
                  <BellOff size={20} className="text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Evening Reminders</p>
                <p className="text-xs text-muted-foreground">
                  {notificationsEnabled ? "You'll get a gentle check-in at 8 PM" : "Get a daily evening thought check-in"}
                </p>
              </div>
              {notifError && (
                <p className="text-xs text-red-500 mt-1">{notifError}</p>
              )}
            </div>
            <button
              onClick={() => { setNotifError(""); toggleNotifications(); }}
              disabled={notifLoading}
              data-testid="button-toggle-notifications"
              className={`relative w-12 h-7 rounded-full transition-colors ${
                notificationsEnabled ? 'bg-primary' : 'bg-muted-foreground/20'
              } ${notifLoading ? 'opacity-50' : ''}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-primary" />
          <h3 className="font-medium">Subscription</h3>
        </div>
        {subDetails?.hasSubscription ? (
          <div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize" data-testid="text-sub-status">
                  {subDetails.cancelAtPeriodEnd ? "Cancelling" : subDetails.status}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valid until</span>
                <span className="font-medium" data-testid="text-sub-valid-until">
                  {new Date(subDetails.validUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              {subDetails.email && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-xs" data-testid="text-sub-email">{subDetails.email}</span>
                </div>
              )}
            </div>
            {subDetails.cancelAtPeriodEnd ? (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Your subscription will end on {new Date(subDetails.validUntil).toLocaleDateString()}. You can keep using Premium features until then.
              </p>
            ) : cancelConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 py-2 px-3 rounded-xl transition-colors disabled:opacity-50"
                  data-testid="button-confirm-cancel"
                >
                  <XCircle size={14} />
                  {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="flex-1 text-sm font-medium text-muted-foreground bg-muted/20 hover:bg-muted/30 py-2 px-3 rounded-xl transition-colors"
                  data-testid="button-keep-sub"
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCancelConfirm(true)}
                className="w-full text-sm text-muted-foreground hover:text-red-500 py-2 transition-colors"
                data-testid="button-cancel-subscription"
              >
                Cancel subscription
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Shield size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No active subscription</p>
                <p className="text-xs text-muted-foreground">Get unlimited healing sessions</p>
              </div>
            </div>
            <div className="bg-primary/5 rounded-xl p-3 space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-2xl font-bold text-foreground">€2</span>
                <span className="text-muted-foreground text-xs">/month · billed yearly</span>
              </div>
              <p className="text-xs text-emerald-600 font-medium">30 days money back guarantee</p>
            </div>
            <button
              onClick={() => setLocation("/subscribe")}
              data-testid="button-go-subscribe"
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium text-sm shadow-md hover:shadow-primary/20 transition-all"
            >
              Subscribe
            </button>
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={18} className="text-primary" />
          <h3 className="font-medium">Contact</h3>
        </div>
        <a
          href="mailto:grupeaaz@gmail.com"
          data-testid="link-contact-email"
          className="text-sm text-primary hover:underline"
        >
          grupeaaz@gmail.com
        </a>
      </div>

    </Layout>
  );
}

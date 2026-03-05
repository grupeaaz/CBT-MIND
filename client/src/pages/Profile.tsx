import Layout from "@/components/Layout";
import { Award, BookOpen, Bell, BellOff, CreditCard, XCircle, Shield, Mail, Pencil, Check, X } from "lucide-react";
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(localStorage.getItem("userName") || "");
  const [nameSaving, setNameSaving] = useState(false);

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

  // On mount: load saved profile (name + email) from DB and sync to local state
  useEffect(() => {
    fetch("/api/user/profile", { headers: { "X-Device-Id": getDeviceId() } })
      .then((res) => res.ok ? res.json() : null)
      .then((profile) => {
        if (profile?.name) {
          localStorage.setItem("userName", profile.name);
          setEditedName(profile.name);
        }
      })
      .catch(() => {});
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
        const keyData = await keyRes.json();

        if (!keyRes.ok || !keyData.publicKey) {
          setNotifError("Notifications aren't set up on the server yet.");
          setNotifLoading(false);
          return;
        }

        const { publicKey } = keyData;

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
    onSuccess: (details: any) => {
      // After loading subscription details, sync all stats to the DB in the background
      const winsFromStorage: any[] = (() => {
        try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]"); } catch { return []; }
      })();
      const journalsFromStorage: any[] = (() => {
        try { return JSON.parse(localStorage.getItem("cbt_journal") || "[]"); } catch { return []; }
      })();
      const focusBreakdown: Record<string, number> = {};
      winsFromStorage.forEach((w: any) => {
        focusBreakdown[w.focusArea] = (focusBreakdown[w.focusArea] || 0) + 1;
      });
      const uniqueActiveDays = new Set(winsFromStorage.map((w: any) => w.createdAt?.split("T")[0])).size;
      const subscriptionExpiresAt = details?.validUntil || null;
      fetch("/api/user/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
        body: JSON.stringify({
          totalWins: winsFromStorage.length + journalsFromStorage.length,
          activeDays: uniqueActiveDays,
          reflections: journalsFromStorage.length,
          focusBreakdown,
          subscriptionExpiresAt,
        }),
      }).catch(() => {});
    },
  } as any);

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

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "X-Device-Id": getDeviceId() },
      });
    } catch {}
    // Clear all local data
    localStorage.clear();
    window.location.href = "/";
  };

  // Save edited name to DB and localStorage
  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    setNameSaving(true);
    localStorage.setItem("userName", editedName.trim());
    try {
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
        body: JSON.stringify({ name: editedName.trim() }),
      });
    } catch {}
    setNameSaving(false);
    setIsEditingName(false);
  };

  return (
    <Layout>
      <header className="mb-8">
        <h1 className="font-serif text-4xl text-foreground font-medium mb-2">Profile</h1>
        <p className="text-muted-foreground">Your journey to presence.</p>
      </header>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-full bg-stone-200 border-4 border-white shadow-sm" />
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setIsEditingName(false); }}
                autoFocus
                className="text-xl font-medium bg-white/60 border border-border/50 rounded-lg px-2 py-0.5 w-36 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={handleSaveName} disabled={nameSaving} className="text-primary hover:text-primary/70">
                <Check size={18} />
              </button>
              <button onClick={() => setIsEditingName(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-medium" data-testid="text-user-name">{editedName || "Seeker"}</h2>
              <button onClick={() => setIsEditingName(true)} className="text-muted-foreground/50 hover:text-primary transition-colors">
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Your healing journey</p>
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
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center">
                <Award size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground" data-testid="text-sub-status">Subscribed</p>
                <p className="text-xs text-muted-foreground" data-testid="text-sub-valid-until">
                  {subDetails.cancelAtPeriodEnd
                    ? `Cancels on ${new Date(subDetails.validUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
                    : `Active till ${new Date(subDetails.validUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`}
                </p>
              </div>
            </div>
            {subDetails.cancelAtPeriodEnd ? (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                You can keep using Premium features until then.
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
                className="text-xs text-muted-foreground/40 hover:text-red-400 transition-colors mt-2 float-right"
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

      <div className="glass-card rounded-2xl p-5 mb-6">
        {deleteConfirm ? (
          <div>
            <p className="text-sm text-foreground font-medium mb-1">Are you sure you want to delete your wins and email address?</p>
            <p className="text-xs text-muted-foreground mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                data-testid="button-confirm-delete"
                className="flex-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 py-2 px-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                data-testid="button-cancel-delete"
                className="flex-1 text-sm font-medium text-muted-foreground bg-muted/20 hover:bg-muted/30 py-2 px-3 rounded-xl transition-colors"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            data-testid="button-delete-account"
            className="w-full text-sm text-red-500 hover:text-red-600 py-1 transition-colors"
          >
            Delete my account
          </button>
        )}
      </div>

    </Layout>
  );
}

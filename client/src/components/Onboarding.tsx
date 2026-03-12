import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Download, Share } from "lucide-react";
import { getDeviceId } from "@/lib/queryClient";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [restoreError, setRestoreError] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyError, setShowPrivacyError] = useState(false);
  const [showEmailError, setShowEmailError] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [beginLoading, setBeginLoading] = useState(false);
  const [, setLocation] = useLocation();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) {
      setInstalled(true);
    }

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    if ((window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt as BeforeInstallPromptEvent);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      (window as any).__pwaInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    }
  };

  const skipInstall = () => {
    goTo(4);
  };

  const handleRestoreRequest = async () => {
    if (!restoreEmail.trim()) return;
    setRestoreStatus("loading");
    setRestoreError("");
    try {
      const res = await fetch("/api/restore/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: restoreEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.sent) {
        setRestoreStatus("sent");
      } else {
        setRestoreStatus("error");
        setRestoreError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setRestoreStatus("error");
      setRestoreError("Connection error. Please try again.");
    }
  };

  const screens = [
    {
      id: 0,
      type: "text-list",
      bg: "bg-[#f5f2ed]",
      content: (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-4xl md:text-5xl font-bold text-primary leading-tight"
          >
            Privacy oriented.
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-serif text-4xl md:text-5xl font-bold text-primary/80 leading-tight"
          >
            No logs.
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="font-serif text-4xl md:text-5xl font-bold text-primary/60 leading-tight"
          >
            All data saved locally in Your device.
          </motion.h1>
        </div>
      )
    },
    {
      id: 1,
      type: "text-list",
      bg: "bg-[#f5f2ed]",
      content: (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-4xl md:text-5xl font-bold text-primary leading-tight"
          >
            Remove anxiety.
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-serif text-4xl md:text-5xl font-bold text-primary/80 leading-tight"
          >
            Let go of bad thoughts.
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="font-serif text-4xl md:text-5xl font-bold text-primary/60 leading-tight"
          >
            Remove stress.
          </motion.h1>
        </div>
      )
    },
    {
      id: 2,
      type: "floating-blocks",
      bg: "bg-[#edf2f5]",
      content: (
        <div className="relative h-full w-full overflow-hidden flex flex-col items-center justify-center">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-4xl md:text-5xl text-primary font-bold leading-tight mb-10"
          >
            BASED ON
          </motion.h1>
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 2, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="glass-card px-8 py-4 rounded-2xl mb-8 shadow-xl border-white/50"
          >
            <span className="font-medium text-lg text-primary">Cognitive Behaviour Therapy</span>
          </motion.div>
          
          <motion.div
            animate={{ 
              y: [0, -15, 0],
              x: [0, 10, 0]
            }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="glass-card px-8 py-4 rounded-2xl shadow-xl border-white/50"
          >
            <span className="font-medium text-lg text-accent-foreground">Philosophical teaching</span>
          </motion.div>
        </div>
      )
    },
    {
      id: 3,
      type: "install",
      bg: "bg-[#eef5ed]",
      content: (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-28 h-28 rounded-3xl bg-primary/15 flex items-center justify-center mb-8 shadow-lg"
          >
            <Download size={48} className="text-primary" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-3xl text-foreground mb-3"
          >
            Install CBT GUIDE
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mb-8 text-sm max-w-xs"
          >
            Add to your home screen for the best experience — works like a real app.
          </motion.p>

          {isStandalone ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <p className="text-green-600 font-medium text-lg mb-6">App installed!</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => goTo(4)}
                className="bg-primary text-primary-foreground px-10 py-4 rounded-full font-medium shadow-lg"
                data-testid="button-continue-after-install"
              >
                Continue
              </motion.button>
            </motion.div>
          ) : isIOS ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full max-w-xs"
            >
              <div className="glass-card rounded-2xl p-5 mb-6 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                  <p className="text-sm text-foreground">Tap <Share size={14} className="inline text-blue-500" /> Share button below</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                  <p className="text-sm text-foreground">Tap "Add to Home Screen"</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
                  <p className="text-sm text-foreground">Tap "Add" and open the app</p>
                </div>
              </div>
              <button
                onClick={skipInstall}
                className="text-sm text-muted-foreground/60 underline"
                data-testid="button-skip-install"
              >
                Skip for now
              </button>
            </motion.div>
          ) : deferredPrompt ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleInstall}
                className="bg-primary text-primary-foreground px-10 py-4 rounded-full font-medium shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
                data-testid="button-install-app"
              >
                <Download size={20} />
                Install App
              </motion.button>
              <button
                onClick={skipInstall}
                className="text-sm text-muted-foreground/60 underline"
                data-testid="button-skip-install"
              >
                Skip for now
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="text-sm text-muted-foreground max-w-xs">
                Use your browser menu to "Add to Home Screen" for the best experience.
              </p>
              <button
                onClick={skipInstall}
                className="text-sm text-muted-foreground/60 underline"
                data-testid="button-skip-install"
              >
                Continue in browser
              </button>
            </motion.div>
          )}
        </div>
      )
    },
    {
      id: 4,
      type: "final",
      bg: "bg-[#f5edf0]",
      content: (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          {showRestoreForm ? (
            // ── Already a user — restore by email ──
            <motion.div
              key="restore"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center w-full max-w-xs"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <div className="w-8 h-8 rounded-full bg-primary/20 animate-pulse" />
              </div>
              <h2 className="font-serif text-3xl text-foreground mb-3">Restore account</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Enter the email you used when you first set up the app.
              </p>

              {restoreStatus === "sent" ? (
                <div className="text-center space-y-3">
                  <p className="text-primary font-medium">Check your email!</p>
                  <p className="text-muted-foreground text-sm">
                    We sent a restore link to <strong>{restoreEmail}</strong>.<br />
                    It expires in 5 minutes.
                  </p>
                  <button
                    onClick={() => { setRestoreStatus("idle"); setRestoreEmail(""); }}
                    className="text-sm text-muted-foreground/60 underline mt-4"
                  >
                    Send again
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    value={restoreEmail}
                    onChange={(e) => setRestoreEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRestoreRequest(); }}
                    placeholder="Your email"
                    data-testid="input-restore-email-onboarding"
                    className="w-full text-center text-lg border-b-2 border-primary/30 focus:border-primary bg-transparent outline-none py-2 mb-6 placeholder:text-muted-foreground/50"
                  />
                  {restoreStatus === "error" && (
                    <p className="text-red-500 text-sm mb-4">{restoreError}</p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRestoreRequest}
                    disabled={restoreStatus === "loading" || !restoreEmail.trim()}
                    className="bg-primary text-primary-foreground px-10 py-4 rounded-full font-medium shadow-lg disabled:opacity-50 w-full"
                    data-testid="button-send-restore-link"
                  >
                    {restoreStatus === "loading" ? "Sending…" : "Send Restore Link"}
                  </motion.button>
                </>
              )}

              <button
                onClick={() => { setShowRestoreForm(false); setRestoreStatus("idle"); setRestoreError(""); }}
                className="text-sm text-muted-foreground/60 underline mt-6"
              >
                Back
              </button>
            </motion.div>
          ) : (
            // ── New user — enter name + email ──
            <motion.div
              key="new-user"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center w-full max-w-xs"
            >
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 animate-pulse" />
              </div>
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-serif text-3xl text-foreground mb-4"
              >
                What's your name?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground mb-6 text-sm"
              >
                We'll use it to personalize your experience.
              </motion.p>
              <motion.input
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name"
                data-testid="input-user-name"
                className="w-full text-center text-lg border-b-2 border-primary/30 focus:border-primary bg-transparent outline-none py-2 mb-5 placeholder:text-muted-foreground/50"
              />
              <motion.input
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                type="email"
                value={userEmail}
                onChange={(e) => { setUserEmail(e.target.value); setShowEmailError(false); setEmailTaken(false); }}
                placeholder="Your email (required)"
                data-testid="input-user-email"
                className={`w-full text-center text-lg border-b-2 bg-transparent outline-none py-2 mb-2 placeholder:text-muted-foreground/50 ${showEmailError ? "border-red-400 focus:border-red-400" : "border-primary/30 focus:border-primary"}`}
              />
              {showEmailError && (
                <p className="text-red-500 text-xs mb-2 w-full text-left">
                  A valid email is required to use the app.
                </p>
              )}
              {emailTaken && (
                <p className="text-red-500 text-xs mb-2 w-full text-left">
                  This email is already registered. Use <button onClick={() => { setShowRestoreForm(true); setEmailTaken(false); }} className="underline font-semibold">Restore account</button> to log in.
                </p>
              )}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-muted-foreground/60 mb-6"
              >
                Used to sync your data across devices and restore your account.
              </motion.p>

              <motion.label
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-start gap-3 mb-1 cursor-pointer text-left w-full"
              >
                <input
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => {
                    setAgreedToPrivacy(e.target.checked);
                    if (e.target.checked) setShowPrivacyError(false);
                  }}
                  data-testid="checkbox-privacy"
                  className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                />
                <span className="text-sm text-muted-foreground">
                  I have read and agree to the{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Privacy Policy
                  </a>
                </span>
              </motion.label>

              {showPrivacyError && (
                <p className="text-red-500 text-xs mb-4 w-full text-left">
                  Agree to Privacy Policy to continue.
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                disabled={beginLoading}
                onClick={async () => {
                  const email = userEmail.trim().toLowerCase();
                  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                  if (!emailValid) {
                    setShowEmailError(true);
                    return;
                  }
                  setShowEmailError(false);

                  if (!agreedToPrivacy) {
                    setShowPrivacyError(true);
                    return;
                  }
                  setShowPrivacyError(false);

                  setBeginLoading(true);
                  try {
                    const existsRes = await fetch(`/api/user/email-exists?email=${encodeURIComponent(email)}`);
                    const existsData = await existsRes.json();
                    if (existsData.exists) {
                      setEmailTaken(true);
                      setBeginLoading(false);
                      return;
                    }
                  } catch {
                    // If check fails, allow continuing
                  }

                  const name = userName.trim() || "Seeker";
                  localStorage.setItem("userName", name);
                  localStorage.setItem("hasSeenOnboarding", "true");
                  localStorage.setItem("cbt_user_email", email);
                  if (!localStorage.getItem("cbt_install_date")) {
                    localStorage.setItem("cbt_install_date", Date.now().toString());
                  }
                  const deviceId = getDeviceId();
                  fetch("/api/user/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
                    body: JSON.stringify({ name, email }),
                  }).catch(() => {});
                  if (onComplete) onComplete();
                  setLocation("/");
                }}
                className="bg-primary text-primary-foreground px-10 py-4 rounded-full font-medium shadow-lg hover:shadow-primary/20 transition-all w-full mt-4 disabled:opacity-50"
                data-testid="button-begin-journey"
              >
                {beginLoading ? "Checking…" : "Begin Journey"}
              </motion.button>

              <button
                onClick={() => setShowRestoreForm(true)}
                data-testid="button-already-a-user"
                className="text-sm font-semibold text-blue-500 hover:text-blue-600 mt-5 transition-colors underline underline-offset-2"
              >
                Already a user? Restore my account
              </button>
            </motion.div>
          )}
        </div>
      )
    }
  ];

  const goTo = (index: number) => {
    if (index < 0 || index >= screens.length || index === current) return;
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goTo(current + 1);
      } else {
        goTo(current - 1);
      }
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div
      className={cn("fixed inset-0 z-[100] transition-colors duration-1000", screens[current].bg)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="h-full w-full"
        >
          {screens[current].content}
        </motion.div>
      </AnimatePresence>

      <div className="fixed bottom-12 left-0 right-0 flex justify-center items-center gap-3">
        {screens.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              current === i ? "bg-primary w-8" : "bg-primary/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const tryShow = () => {
      const dismissed = localStorage.getItem("installDismissed");
      if (dismissed) return;

      const hasOnboarded = localStorage.getItem("hasSeenOnboarding");
      if (!hasOnboarded) return;

      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
        || (navigator as any).standalone === true;
      if (isStandalone) return;

      const ua = navigator.userAgent;
      const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      setIsIOS(isiOS);

      if (isiOS) {
        setTimeout(() => setShowBanner(true), 3000);
        return;
      }

      if (deferredPrompt) {
        setTimeout(() => setShowBanner(true), 2000);
      }
    };

    tryShow();

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const hasOnboarded = localStorage.getItem("hasSeenOnboarding");
      if (hasOnboarded && !localStorage.getItem("installDismissed")) {
        setTimeout(() => setShowBanner(true), 2000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    const interval = setInterval(() => {
      if (localStorage.getItem("hasSeenOnboarding") && !showBanner) {
        tryShow();
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearInterval(interval);
    };
  }, [deferredPrompt, showBanner]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem("installDismissed", "true");
  };

  if (!showBanner) return null;

  if (showIOSGuide) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" data-testid="ios-install-guide">
        <div className="bg-white rounded-t-3xl p-6 w-full max-w-md animate-in-slide-up">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-serif text-2xl text-foreground">Install CBT-MIND</h3>
            <button onClick={handleDismiss} className="p-1 text-muted-foreground" data-testid="button-close-ios-guide">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
              <p>Tap the <Share size={16} className="inline text-blue-500" /> Share button at the bottom of Safari</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
              <p>Scroll down and tap "Add to Home Screen"</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
              <p>Tap "Add" to install CBT-MIND as an app</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="w-full mt-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            data-testid="button-got-it"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-[90] animate-in-slide-up" data-testid="install-banner">
      <div className="glass-card rounded-2xl p-4 shadow-xl border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Download size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">Install CBT-MIND</p>
            <p className="text-xs text-muted-foreground">Add to your home screen for the full experience</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-medium"
              data-testid="button-install-app"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-muted-foreground"
              data-testid="button-dismiss-install"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

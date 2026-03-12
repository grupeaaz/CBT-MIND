import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { getDeviceId } from "@/lib/queryClient";

export default function RestoreLanding() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [restoredName, setRestoredName] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setErrorMessage("No restore token found in this link.");
      setStatus("error");
      return;
    }

    fetch(`/api/restore/validate/${token}`)
      .then((res) => res.json())
      .then(async (data) => {
        if (!data.valid) {
          setErrorMessage(data.error || "This link is invalid or expired.");
          setStatus("error");
          return;
        }

        // Restore name to localStorage
        if (data.profile?.name) {
          localStorage.setItem("userName", data.profile.name);
          setRestoredName(data.profile.name);
        }

        // Stats are resolved server-side via email lookup — no local action needed

        // Save profile (name + email) under the new device ID so subscription lookup works.
        // Use data.email (always present from the token) in case profile doesn't exist yet.
        const emailToSave = data.email || data.profile?.email;

        // Await the profile save — this links Device 2's ID to the email in the DB.
        // Insights syncing depends on this completing before the user reaches that page.
        if (emailToSave) {
          try {
            await fetch("/api/user/profile", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Device-Id": getDeviceId(),
              },
              body: JSON.stringify({
                name: data.profile?.name ?? undefined,
                email: emailToSave,
              }),
            });
          } catch {
            // Non-fatal — continue with restore even if this fails
          }
        }

        // Mark onboarding as complete so app goes straight to home
        localStorage.setItem("hasSeenOnboarding", "true");
        if (emailToSave) localStorage.setItem("cbt_user_email", emailToSave);
        if (!localStorage.getItem("cbt_install_date")) {
          localStorage.setItem("cbt_install_date", Date.now().toString());
        }

        setStatus("success");
        setTimeout(() => setLocation("/"), 2000);
      })
      .catch(() => {
        setErrorMessage("Connection error. Please try again.");
        setStatus("error");
      });
  }, []);

  return (
    <div className="fixed inset-0 bg-[#f5f2ed] flex items-center justify-center px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-xs"
      >
        {status === "loading" && (
          <>
            <Loader2 size={48} className="text-primary mx-auto mb-6 animate-spin" />
            <h2 className="font-serif text-2xl text-foreground mb-2">Restoring your account…</h2>
            <p className="text-muted-foreground text-sm">Just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
            >
              <CheckCircle size={56} className="text-primary mx-auto mb-6" />
            </motion.div>
            <h2 className="font-serif text-2xl text-foreground mb-2">
              Welcome back{restoredName ? `, ${restoredName}` : ""}!
            </h2>
            <p className="text-muted-foreground text-sm">Your account has been restored. Taking you home…</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={56} className="text-red-400 mx-auto mb-6" />
            <h2 className="font-serif text-2xl text-foreground mb-2">Restore failed</h2>
            <p className="text-muted-foreground text-sm mb-8">{errorMessage}</p>
            <button
              onClick={() => setLocation("/")}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-medium text-sm"
            >
              Back to App
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

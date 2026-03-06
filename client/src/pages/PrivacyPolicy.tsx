import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#f5f2ed] px-6 py-10 max-w-2xl mx-auto">
      <button
        onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </button>

      <h1 className="font-serif text-3xl text-foreground font-medium mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

      <div className="space-y-8 text-foreground/80 text-sm leading-relaxed">

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">1. Who we are</h2>
          <p>
            CBT GUIDE is a personal mental wellness app based on Cognitive Behavioural Therapy (CBT),
            philosophical, and religious teachings. We are committed to protecting your privacy.
            If you have any questions, contact us at{" "}
            <a href="mailto:grupeaaz@gmail.com" className="text-blue-500 underline">grupeaaz@gmail.com</a>.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">2. What data we collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Name and email</strong> — provided voluntarily during onboarding, used to personalise your experience and enable account restore.</li>
            <li><strong>Device ID</strong> — a randomly generated identifier stored on your device, used to link your subscription and settings without requiring a login.</li>
            <li><strong>Usage statistics</strong> — total wins, active days, journal reflection count, and focus breakdown, stored to enable account restore across devices.</li>
            <li><strong>Journal entries, mood logs, and wins</strong> — stored <strong>only on your device</strong> (localStorage). We do not send or store this content on our servers.</li>
            <li><strong>Push notification subscription</strong> — if you enable evening reminders, your browser push endpoint is stored to deliver notifications.</li>
            <li><strong>Payment information</strong> — handled entirely by Stripe. We never see or store your card details.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">3. How we use your data</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To personalise the app with your name.</li>
            <li>To restore your account if you switch devices (via a secure one-time email link).</li>
            <li>To manage your subscription status through Stripe.</li>
            <li>To send optional evening reminder notifications (only if you enable them).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">4. Data sharing</h2>
          <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties, except:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Stripe</strong> — for payment processing. Subject to <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Stripe's Privacy Policy</a>.</li>
            <li><strong>OpenAI</strong> — the text you submit for CBT analysis is sent to OpenAI's API to generate a response. We do not store this text on our servers. Subject to <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">OpenAI's Privacy Policy</a>.</li>
            <li><strong>Neon (PostgreSQL)</strong> — our database provider, where name, email, device ID, and stats are stored securely.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">5. Data retention</h2>
          <p>
            Your data is retained for as long as you use the app. You may request deletion of your
            data at any time by emailing{" "}
            <a href="mailto:grupeaaz@gmail.com" className="text-blue-500 underline">grupeaaz@gmail.com</a>.
            Journal entries, mood logs, and wins stored locally on your device can be deleted by
            clearing your browser or app data.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">6. Security</h2>
          <p>
            We use HTTPS for all data in transit. Your personal content (journal, moods, wins)
            never leaves your device. Account restore links are single-use and expire after 5 minutes.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">7. Your rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Withdraw consent at any time by contacting us.</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, email us at{" "}
            <a href="mailto:grupeaaz@gmail.com" className="text-blue-500 underline">grupeaaz@gmail.com</a>.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-foreground mb-2">8. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Any significant changes will be
            communicated through the app. Continued use of the app after changes constitutes
            acceptance of the updated policy.
          </p>
        </section>

      </div>
    </div>
  );
}

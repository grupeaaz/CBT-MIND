import { ArrowLeft } from "lucide-react";

type LegalDocumentType = "privacy" | "disclaimer" | "terms";

interface LegalDocumentModalProps {
  document: LegalDocumentType;
  onClose: () => void;
}

const documentContent: Record<LegalDocumentType, { title: string; sections: { heading?: string; body: string }[] }> = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      { body: "CBT Guide, Demini MB\nMarch 8, 2026\n\nDemini MB operates the CBT Guide application and respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use CBT Guide." },
      { heading: "1. Information We Collect", body: "CBT Guide collects minimal personal information necessary to operate the service. When creating an account we may collect Name and Email address. This information is used only to identify users and manage subscription status.\n\nTechnical Information: We may collect limited technical information such as device type, operating system, and basic usage data to improve the app." },
      { heading: "2. Health Data", body: "CBT Guide does not store or process personal health data on our servers. Any information entered in exercises or tools remains local to the user's device unless explicitly stated otherwise." },
      { heading: "3. How We Use Information", body: "We use collected information to:\n- Provide access to the app\n- Manage subscriptions\n- Improve functionality\n- Respond to support requests\n- Ensure service security\n\nWe do not sell personal data." },
      { heading: "4. Data Sharing", body: "We do not share personal information except with service providers necessary to operate the service (such as hosting providers or payment platforms) or when required by law." },
      { heading: "5. Data Security", body: "We implement reasonable security measures to protect personal information. However, no system can guarantee absolute security." },
      { heading: "6. Your Rights (GDPR)", body: "Users in the European Economic Area may have the right to access their data, correct inaccuracies, request deletion, or withdraw consent where applicable." },
      { heading: "7. Data Retention", body: "We retain account information only as long as necessary to provide the service and manage subscriptions." },
      { heading: "8. Changes to This Policy", body: "We may update this Privacy Policy periodically. Updated versions will be posted on our website." },
      { heading: "9. Contact Us", body: "Company: Demini MB\nWebsite: https://www.cbtguide.com\nEmail: hello@cbtguide.com" },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    sections: [
      { body: "CBT Guide, Demini MB\nMarch 8, 2026\n\nCBT Guide is designed to provide educational and self-help tools based on cognitive behavioral therapy (CBT) principles. The content, exercises, and information provided in the app are intended to support personal wellbeing and self-reflection." },
      { heading: "Not Medical or Psychological Advice", body: "CBT Guide does not provide medical, psychological, or psychiatric advice, diagnosis, or treatment. The app is not a substitute for professional mental health care, therapy, or counseling provided by licensed healthcare professionals. If you are experiencing significant emotional distress, mental health concerns, or thoughts of self-harm, you should seek assistance from a qualified mental health professional or contact your local emergency services immediately." },
      { heading: "Personal Responsibility", body: "By using CBT Guide, you acknowledge that:\n- The app is intended for informational and self-help purposes only\n- You are responsible for your own mental health decisions\n- Any actions you take based on information in the app are done at your own discretion\n\nDemini MB is not liable for decisions or actions taken based on the use of CBT Guide." },
      { heading: "Data and Privacy", body: "CBT Guide is designed with privacy in mind. We only store limited account information, specifically:\n- Name\n- Email address\n\nThis information is used solely to manage user accounts and subscription status. CBT Guide does not store or process personal health data, mental health records, therapy notes, mood tracking entries, or other sensitive health information on our servers. Users remain in control of the information they enter while using the app." },
      { heading: "Limitation of Liability", body: "To the fullest extent permitted by law, Demini MB shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use or inability to use CBT Guide." },
      { heading: "Changes to This Disclaimer", body: "We may update this disclaimer from time to time. Updated versions will be published within the app or on our website." },
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      { body: "CBT Guide, Demini MB\nMarch 8, 2026\n\nThese Terms of Service (\"Terms\") govern your use of the CBT Guide application and related services provided by Demini MB (\"we\", \"our\", or \"us\"). By accessing or using CBT Guide, you agree to these Terms. If you do not agree, please do not use the app." },
      { heading: "1. Description of Service", body: "CBT Guide provides self-help tools and exercises based on Cognitive Behavioral Therapy (CBT) principles designed to support personal wellbeing and self-reflection. CBT Guide is not a medical service and does not provide medical or psychological treatment." },
      { heading: "2. Not Medical Advice", body: "CBT Guide is intended for informational and self-help purposes only. The app does not provide medical advice, psychiatric diagnosis, or psychological treatment. CBT Guide is not a substitute for professional mental health care. If you are experiencing serious mental health concerns, please consult a licensed healthcare professional." },
      { heading: "3. User Accounts", body: "To use certain features of the app, you may need to create an account. You agree to provide accurate information, keep your login information secure, and notify us if you suspect unauthorized use of your account. You are responsible for activity that occurs under your account." },
      { heading: "4. Subscriptions", body: "Some features of CBT Guide may require a paid subscription. Subscriptions may include recurring billing and automatic renewal unless cancelled. Subscriptions can be managed through the platform where they were purchased (such as Apple App Store or Google Play)." },
      { heading: "5. Acceptable Use", body: "You agree not to misuse the app, attempt to disrupt its operation, access unauthorized systems, copy or distribute app content without permission, or use the service for unlawful purposes. We reserve the right to suspend or terminate accounts that violate these Terms." },
      { heading: "6. Intellectual Property", body: "All content within CBT Guide, including text, exercises, design, and software, is the property of Demini MB and protected by intellectual property laws. The app may only be used for personal, non-commercial purposes." },
      { heading: "7. Limitation of Liability", body: "To the fullest extent permitted by law, Demini MB shall not be liable for damages resulting from the use or inability to use CBT Guide. The service is provided \"as is\" without warranties of any kind." },
      { heading: "8. Termination", body: "We may suspend or terminate access if users violate these Terms. Users may stop using the service at any time." },
      { heading: "9. Changes to These Terms", body: "We may update these Terms from time to time. Updated versions will be published on our website or within the app." },
      { heading: "10. Contact Information", body: "Company: Demini MB\nWebsite: https://www.cbtguide.com\nEmail: hello@cbtguide.com" },
    ],
  },
};

export default function LegalDocumentModal({ document, onClose }: LegalDocumentModalProps) {
  const { title, sections } = documentContent[document];

  return (
    <div className="fixed inset-0 z-[200] bg-[#f5f2ed] flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-black/10">
        <button onClick={onClose} className="text-primary hover:opacity-70 transition-opacity">
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-serif text-xl font-bold text-primary">{title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {sections.map((section, index) => (
          <div key={index}>
            {section.heading && (
              <h2 className="font-semibold text-foreground mb-1.5">{section.heading}</h2>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {section.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { LegalDocumentType };

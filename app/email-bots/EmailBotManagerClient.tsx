"use client";

import { useState } from "react";

export type EmailBotConfig = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  subject: string;
  html_template: string;
  enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  initialBots: EmailBotConfig[];
};

export default function EmailBotManagerClient({ initialBots }: Props) {
  const [bots, setBots] = useState<EmailBotConfig[]>(initialBots);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testEmails, setTestEmails] = useState<Record<string, string>>({});

  const updateBotField = (
    key: string,
    field: keyof EmailBotConfig,
    value: unknown
  ) => {
    setBots((prev) =>
      prev.map((bot) =>
        bot.key === key ? ({ ...bot, [field]: value } as EmailBotConfig) : bot
      )
    );
  };

  const handleSave = async (bot: EmailBotConfig) => {
    setSavingKey(bot.key);
    try {
      const res = await fetch("/api/email-bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: bot.key,
          subject: bot.subject,
          html_template: bot.html_template,
          enabled: bot.enabled,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("[email-bots] save error:", json.error);
        alert("Failed to save changes.");
        return;
      }

      setBots((prev) =>
        prev.map((b) => (b.key === bot.key ? json.bot : b))
      );
    } catch (err) {
      console.error("[email-bots] save error:", err);
      alert("Failed to save changes.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSendTest = async (bot: EmailBotConfig) => {
    const toEmail = testEmails[bot.key]?.trim();
    if (!toEmail) {
      alert("Enter a test email address first.");
      return;
    }

    setTestingKey(bot.key);
    try {
      const res = await fetch("/api/email-bots/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: bot.key,
          toEmail,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("[email-bots] test error:", json.error);
        alert(json.error || "Failed to send test email.");
        return;
      }

      alert(`Test email sent to ${toEmail}.`);
    } catch (err) {
      console.error("[email-bots] test error:", err);
      alert("Failed to send test email.");
    } finally {
      setTestingKey(null);
    }
  };

  const renderPreview = (bot: EmailBotConfig) => {
    const sample = bot.html_template
      .replace(/{{\s*name\s*}}/gi, "Douglas")
      .replace(/{{\s*email\s*}}/gi, "doug@example.com")
      .replace(/{{\s*inquiry_id\s*}}/gi, "demo-id-123")
      .replace(/{{\s*page\s*}}/gi, "contact-page");

    return (
      <div
        className="prose prose-sm max-w-none bg-slate-50 rounded-xl p-3 border border-slate-200 overflow-auto"
        dangerouslySetInnerHTML={{ __html: sample }}
      />
    );
  };

  if (!bots.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 text-sm">
        No bot configurations found.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {bots.map((bot) => (
        <div
          key={bot.id}
          className="col-span-3 lg:col-span-1 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col"
        >
          {/* Header */}
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {bot.label}
              </div>
              <div className="text-[11px] text-slate-500">
                {bot.description}
              </div>
            </div>

            {/* Toggle */}
            <label className="flex items-center gap-2 text-[11px] text-slate-600">
              <span>{bot.enabled ? "Enabled" : "Disabled"}</span>
              <button
                type="button"
                onClick={() =>
                  updateBotField(bot.key, "enabled", !bot.enabled)
                }
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                  bot.enabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    bot.enabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 flex-1 flex flex-col">
            {/* Subject */}
            <div>
              <label className="text-[11px] font-medium text-slate-600">
                Subject
              </label>
              <input
                value={bot.subject}
                onChange={(e) =>
                  updateBotField(bot.key, "subject", e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>

            {/* HTML Template */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-600">
                  HTML Template
                </label>
                <span className="text-[10px] text-slate-400">
                  Supports: <code>{"{{name}}"}</code>,{" "}
                  <code>{"{{email}}"}</code>,{" "}
                  <code>{"{{company}}"}</code>,{" "}
                  <code>{"{{message}}"}</code>,{" "}
                  <code>{"{{inquiry_id}}"}</code>,{" "}
                  <code>{"{{page}}"}</code>
                </span>
              </div>
              <textarea
                value={bot.html_template}
                onChange={(e) =>
                  updateBotField(bot.key, "html_template", e.target.value)
                }
                className="mt-1 w-full h-32 rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
              />
            </div>

            {/* Preview */}
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-slate-600">
                Preview (sample data)
              </div>
              {renderPreview(bot)}
            </div>
          </div>

          {/* Footer: Save + Send test */}
          <div className="border-t border-slate-100 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="Send test to..."
                value={testEmails[bot.key] ?? ""}
                onChange={(e) =>
                  setTestEmails((prev) => ({
                    ...prev,
                    [bot.key]: e.target.value,
                  }))
                }
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
              <button
                type="button"
                onClick={() => handleSendTest(bot)}
                disabled={!!testingKey}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
                  testingKey === bot.key
                    ? "bg-slate-200 text-slate-500 cursor-wait"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                }`}
              >
                {testingKey === bot.key ? "Sending..." : "Send test"}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleSave(bot)}
                disabled={savingKey === bot.key}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
                  savingKey === bot.key
                    ? "bg-slate-200 text-slate-500 cursor-wait"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {savingKey === bot.key ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

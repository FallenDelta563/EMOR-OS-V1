// app/inbox/EmailModal.tsx
"use client";

import React, { useState } from "react";

type EmailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  emailData: {
    to: string;
    toName: string;
    subject: string;
    body: string;
    itemType: "inquiry" | "prospect";
    itemId: string;
    availableTemplates?: Array<{ id: string; label: string }>;
  };
  onSend: (customizedEmail: { 
    subject: string; 
    body: string; 
    selectedEmailAccount: string;
    selectedTemplate: string;
  }) => Promise<void>;
  onTemplateChange?: (templateId: string) => { subject: string; body: string };
};

export function EmailModal({ isOpen, onClose, emailData, onSend, onTemplateChange }: EmailModalProps) {
  const [subject, setSubject] = useState(emailData?.subject || '');
  const [body, setBody] = useState(emailData?.body || '');
  const [selectedEmailAccount, setSelectedEmailAccount] = useState<string>('1');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('selective');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email account options - you can move this to a config file or fetch from API
  const emailAccounts = [
    { id: '1', label: 'Inquiries', email: 'inquiries@emorai.com' },
    { id: '2', label: 'OZ', email: 'oswaldoo@emorai.com' },
  ];

  // Templates based on actual email system
  const defaultTemplates = emailData?.itemType === 'prospect' 
    ? [
        { id: 'selective', label: 'Style 1 — Selective (trust-first)' },
        { id: 'intro', label: 'Style 5 — Intro (site mention)' },
      ]
    : [
        { id: 'initial_response', label: 'Initial Response' },
        { id: 'follow_up', label: 'Follow Up' },
        { id: 'thank_you', label: 'Thank You' },
      ];

  const availableTemplates = emailData?.availableTemplates || defaultTemplates;

  // Update state when emailData changes
  React.useEffect(() => {
    if (emailData) {
      setSubject(emailData.subject);
      setBody(emailData.body);
      setError(null);
      setSent(false);
      setSelectedEmailAccount('1'); // Reset to inquiries when new email opens
      setSelectedTemplate(emailData.itemType === 'prospect' ? 'selective' : 'initial_response');
    }
  }, [emailData]);

  // Handle template change
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (onTemplateChange) {
      const result = onTemplateChange(templateId);
      setSubject(result.subject);
      setBody(result.body);
    }
  };

  if (!isOpen) return null;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    
    try {
      await onSend({ subject, body, selectedEmailAccount, selectedTemplate });
      setSent(true);
      setTimeout(() => {
        onClose();
        setSent(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const wordCount = body.trim().split(/\s+/).length;
  const charCount = body.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl border border-gray-300 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {sent ? "Email Sent! ✓" : "Review & Send Email"}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              disabled={sending}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              To: <strong>{emailData.toName}</strong> ({emailData.to})
            </p>
            
            {/* Email Account Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Send from:
              </label>
              <select
                value={selectedEmailAccount}
                onChange={(e) => setSelectedEmailAccount(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                disabled={sending || sent}
              >
                {emailAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} ({account.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Subject Line */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              placeholder="Email subject..."
              disabled={sending || sent}
            />
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Email Body
              </label>
              <span className="text-xs text-gray-500">
                {wordCount} words • {charCount} characters
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
              placeholder="Compose your email..."
              disabled={sending || sent}
            />
          </div>

          {/* Email Preview */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
              <div className="text-xs text-gray-500">
                <strong>From:</strong> {emailAccounts.find(acc => acc.id === selectedEmailAccount)?.email}
              </div>
              <div className="text-xs text-gray-500">
                <strong>To:</strong> {emailData.to}
              </div>
              <div className="text-xs text-gray-500">
                <strong>Subject:</strong> {subject}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-900 whitespace-pre-wrap font-sans">
                  {body}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-gray-200 bg-white/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                defaultChecked
              />
              Save to drafts
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                defaultChecked
              />
              Track email opens
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || sent || !subject || !body}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : sent ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Sent!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
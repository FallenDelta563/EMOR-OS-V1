// app/inbox/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { generateEmailFromTemplate, suggestTemplate, TemplateType } from "@/lib/emailTemplates";
import { EmailModal } from "./EmailModal";

const EMOR_ORG_ID = "45a71a2c-aeea-448b-b8f6-544e25e015ab";

type InboxKind = "inquiry" | "prospect";
type InboxTab = "all" | "inquiries" | "prospects";
type SortMode = "newest" | "oldest" | "score";

type InboxItem = {
  kind: InboxKind;
  id: string;
  title: string;
  subtitle?: string | null;
  createdAt: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  category?: string | null;
  score?: number | null;
  scoreReasons?: string[] | null;
  lastContactedAt?: string | null;
  emailsSent?: number | null;
  page?: string | null;
  runId?: string | null;
  searchQuery?: string | null;
  searchRadiusM?: number | null;
  meta?: any;
};

type InquiryRow = {
  id: string;
  created_at: string;
  page?: string | null;
  org?: string | null;
  form: any;
  last_contacted_at?: string | null;
  emails_sent?: number | null;
  is_deleted?: boolean | null;
};

type ProspectRow = {
  id: string;
  organization_id: string;
  name: string;
  city?: string | null;
  category?: string | null;
  phone?: string | null;
  website?: string | null;
  automation_need_score: number;
  score_reasons?: string[] | null;
  discovered_at?: string | null;
  last_seen_at: string;
  run_id?: string | null;
  search_query?: string | null;
  search_radius_m?: number | null;
  primary_email?: string | null;
  emails?: string[] | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  cms?: string | null;
  has_booking_system?: boolean | null;
  has_live_chat?: boolean | null;
  employee_count?: number | null;
  founded_year?: number | null;
  website_verified?: boolean | null;
  website_trust_score?: number | null;
  website_flags?: string[] | null;
};

type Toast = { id: string; title: string; message?: string; kind?: "info" | "success" | "error" };

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeString(x: any) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  try {
    return String(x);
  } catch {
    return "";
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  if (!Number.isFinite(ms)) return "";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 15) return "now";
  if (sec < 60) return `${sec}s`;
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function scoreTone(score: number) {
  const s = clamp(score, 0, 100);
  if (s >= 80) return { label: "Hot", color: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/30" };
  if (s >= 60) return { label: "Warm", color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" };
  if (s >= 40) return { label: "Good", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
  if (s >= 20) return { label: "Low", color: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30" };
  return { label: "Cold", color: "text-zinc-500", bg: "bg-zinc-600/20", border: "border-zinc-600/30" };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

function normalizeEmail(form: any) {
  return form?.email ?? form?.Email ?? form?.EMAIL ?? null;
}

function normalizeName(form: any) {
  return form?.name ?? form?.full_name ?? form?.Name ?? form?.FULL_NAME ?? "Website Inquiry";
}

function normalizeCompany(form: any) {
  return form?.company ?? form?.org ?? form?.Company ?? form?.ORG ?? "";
}

function normalizeMessage(form: any) {
  return form?.message ?? form?.Message ?? form?.notes ?? form?.Notes ?? "";
}

function normalizePhone(form: any) {
  return form?.phone ?? form?.Phone ?? form?.PHONE ?? null;
}

function normalizeServices(form: any) {
  return form?.services ?? form?.Services ?? null;
}

function normalizeInterest(form: any) {
  return form?.service_interest_text ?? form?.service_interest ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// ICONS (refined, thinner strokes)
// ═══════════════════════════════════════════════════════════════════

function Icon({
  name,
  className,
}: {
  name:
    | "search"
    | "refresh"
    | "x"
    | "filter"
    | "chev"
    | "mail"
    | "phone"
    | "link"
    | "trash"
    | "archive"
    | "check"
    | "spark"
    | "bolt"
    | "info"
    | "copy"
    | "panel"
    | "inbox"
    | "dot"
    | "arrow-up"
    | "arrow-down"
    | "external";
  className?: string;
}): React.ReactElement | null {
  const cls = cx("inline-block shrink-0", className);
  switch (name) {
    case "search":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "refresh":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15-6.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M21 12a9 9 0 0 1-15 6.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18 2v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 22v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "x":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "filter":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18M6 12h12M9 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "chev":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "mail":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "phone":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.24 1.01l-2.2 2.2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "link":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 14a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 10a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "trash":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "archive":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "spark":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "info":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "copy":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "panel":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 3v18" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "inbox":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 12h-6l-2 3H10l-2-3H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "dot":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      );
    case "arrow-up":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "arrow-down":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "external":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function Badge({
  children,
  variant = "default",
  dot,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  dot?: boolean;
}) {
  const variants = {
    default: "bg-gray-100 text-gray-800 border-gray-300",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/15 text-rose-400 border-rose-500/20",
    info: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        variants[variant]
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  className,
  variant = "ghost",
  size = "md",
  disabled,
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  variant?: "ghost" | "solid" | "danger" | "glass";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]";
  const sizes = {
    sm: "rounded-lg px-2.5 py-1.5 text-xs",
    md: "rounded-xl px-3.5 py-2 text-sm",
  };
  const variants: Record<string, string> = {
    ghost: "bg-gray-100 hover:bg-gray-200 text-gray-900 hover:text-gray-900 border border-gray-300 hover:border-gray-300",
    solid: "bg-gray-900 text-white hover:bg-gray-800 border border-gray-400",
    danger: "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/30",
    glass: "backdrop-blur-xl bg-gray-100 hover:bg-gray-200 text-gray-900 hover:text-gray-900 border border-gray-300 hover:border-gray-400 shadow-lg shadow-gray-200/50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  className,
  leftIcon,
  rightNode,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  leftIcon?: React.ReactNode;
  rightNode?: React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <div className={cx("relative w-full group", className)}>
      {leftIcon ? (
        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-gray-700">
          {leftIcon}
        </div>
      ) : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className={cx(
          "h-10 w-full rounded-xl border border-gray-300 bg-gray-100 px-10 text-sm text-gray-900 outline-none transition-all duration-200",
          "placeholder:text-gray-400 focus:border-gray-400 focus:bg-gray-100 focus:ring-1 focus:ring-gray-300",
          "backdrop-blur-sm"
        )}
      />
      {rightNode ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightNode}</div> : null}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
  count,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        active
          ? "bg-gray-200 text-gray-900"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      )}
    >
      {children}
      {typeof count === "number" && (
        <span
          className={cx(
            "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-gray-300 text-gray-900" : "bg-gray-200 text-gray-600"
          )}
        >
          {count}
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gray-900" />
      )}
    </button>
  );
}

function FilterPill({
  active,
  children,
  onClick,
  icon,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-200",
        active
          ? "bg-gray-300 text-gray-900 border-gray-400"
          : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-gray-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-gray-200" />
          <div className="h-2.5 w-1/2 rounded bg-gray-100" />
        </div>
        <div className="h-3 w-12 rounded bg-gray-100" />
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
        {icon || <Icon name="inbox" className="h-6 w-6" />}
      </div>
      <div className="mt-4 text-sm font-medium text-gray-900">{title}</div>
      {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t, i) => (
        <div
          key={t.id}
          style={{ animationDelay: `${i * 50}ms` }}
          className={cx(
            "pointer-events-auto rounded-xl border p-3.5 shadow-2xl shadow-black/40 backdrop-blur-xl animate-in slide-in-from-right-5 duration-300",
            t.kind === "error"
              ? "border-rose-500/20 bg-white/90"
              : t.kind === "success"
              ? "border-emerald-500/20 bg-white/90"
              : "border-gray-300 bg-white/90"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cx(
                "mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg",
                t.kind === "error"
                  ? "bg-rose-500/20 text-rose-400"
                  : t.kind === "success"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-gray-200 text-gray-700"
              )}
            >
              <Icon name={t.kind === "error" ? "x" : t.kind === "success" ? "check" : "info"} className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">{t.title}</div>
              {t.message && <div className="mt-0.5 text-xs text-gray-600">{t.message}</div>}
            </div>
            <button
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SortDropdown({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const labels: Record<SortMode, string> = {
    newest: "Newest",
    oldest: "Oldest",
    score: "Score",
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        <Icon name="arrow-down" className="h-3.5 w-3.5" />
        {labels[value]}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-40 rounded-xl border border-gray-300 bg-white/95 p-1.5 shadow-2xl shadow-gray-300/50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {(["newest", "oldest", "score"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              className={cx(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                value === mode ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
              onClick={() => {
                onChange(mode);
                setOpen(false);
              }}
            >
              {value === mode && <Icon name="check" className="h-4 w-4 text-emerald-400" />}
              <span className={value !== mode ? "ml-6" : ""}>{labels[mode]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InboxRow({
  item,
  active,
  checked,
  onChecked,
  onClick,
  id,
}: {
  item: InboxItem;
  active: boolean;
  checked: boolean;
  onChecked: () => void;
  onClick: () => void;
  id: string;
}) {
  const isProspect = item.kind === "prospect";
  const isInquiry = item.kind === "inquiry";
  const score = item.score ?? 0;
  const tone = scoreTone(score);
  const needsReply = isInquiry && !item.lastContactedAt;

  return (
    <div
      id={id}
      className={cx(
        "group relative rounded-xl border p-3 transition-all duration-200 cursor-pointer",
        active
          ? "border-gray-400 bg-gray-200 shadow-lg shadow-gray-200"
          : "border-transparent hover:border-gray-300 hover:bg-gray-100"
      )}
      onClick={onClick}
    >
      {/* Selection indicator */}
      {active && (
        <div className="absolute -left-px top-3 bottom-3 w-0.5 rounded-full bg-gray-900" />
      )}

      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChecked();
          }}
          className={cx(
            "mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200",
            checked
              ? "border-white bg-gray-900 text-white"
              : "border-gray-400 bg-transparent hover:border-gray-500"
          )}
        >
          {checked && <Icon name="check" className="h-3.5 w-3.5" />}
        </button>

        {/* Avatar */}
        <div
          className={cx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
            active ? "bg-white/20 text-gray-900" : "bg-gray-200 text-gray-800"
          )}
        >
          {initials(item.title)}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cx("truncate text-sm font-medium", active ? "text-gray-900" : "text-gray-900")}>
              {item.title}
            </span>
            {needsReply && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Needs reply" />
            )}
          </div>

          {item.subtitle && (
            <div className={cx("mt-0.5 truncate text-xs", active ? "text-gray-700" : "text-gray-500")}>
              {item.subtitle}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={isInquiry ? "info" : "default"}>
              {isInquiry ? "Inquiry" : "Prospect"}
            </Badge>

            {isProspect && score > 0 && (
              <span
                className={cx(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  tone.bg,
                  tone.border,
                  tone.color
                )}
              >
                <Icon name="bolt" className="h-3 w-3" />
                {score}
              </span>
            )}

            {needsReply && <Badge variant="warning" dot>New</Badge>}
          </div>
        </div>

        {/* Time */}
        <div className={cx("shrink-0 text-right text-[11px] tabular-nums", active ? "text-gray-600" : "text-gray-400")}>
          {formatRelative(item.createdAt)}
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-900 text-right">{value || "—"}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EMAIL GENERATION
// ═══════════════════════════════════════════════════════════════════

function generateInquiryEmail(inquiry: InquiryRow): string {
  const form = inquiry.form ?? {};
  const name = normalizeName(form);
  const email = normalizeEmail(form);
  const company = normalizeCompany(form);
  const message = normalizeMessage(form);
  const services = normalizeServices(form);
  const interest = normalizeInterest(form);

  const firstName = typeof name === "string" ? name.split(" ")[0] : "there";

  return `Subject: Re: Your Inquiry - EMOR OS Lead Intelligence

Hi ${firstName},

Thank you for reaching out! I received your inquiry${inquiry.page ? ` from ${inquiry.page}` : ""} and wanted to get back to you right away.

${message ? `I see you mentioned: "${message}"

` : ""}${services || interest ? `You expressed interest in: ${services || interest}

` : ""}I'd love to discuss how EMOR OS can help ${company ? company : "your business"} with intelligent lead management and automation. Our system helps businesses:

• Automatically capture and score leads
• Streamline inquiry management  
• Generate intelligent outreach
• Track engagement and conversions

Would you be available for a quick 15-minute call this week to explore how we can help?

Best regards,
[Your Name]
EMOR OS Team

---
RAW DATA FOR CUSTOMIZATION:
Name: ${name}
Email: ${email}
${company ? `Company: ${company}` : ""}
${message ? `Message: ${message}` : ""}
${services ? `Services: ${services}` : ""}
${interest ? `Interest: ${interest}` : ""}
Page: ${inquiry.page || "N/A"}
Received: ${new Date(inquiry.created_at).toLocaleString()}`;
}

function generateProspectEmail(prospect: ProspectRow): string {
  return `Subject: Intelligent Lead Management for ${prospect.name}

Hi there,

I came across ${prospect.name}${prospect.city ? ` in ${prospect.city}` : ""} and thought you might be interested in learning about EMOR OS.

${prospect.category ? `As a business in the ${prospect.category} industry, ` : ""}You're likely dealing with:
• Managing inquiries from multiple sources
• Following up with potential customers
• Tracking which leads are most valuable
• Automating repetitive outreach tasks

EMOR OS is designed to solve exactly these challenges. Our intelligent lead management system:

✓ Automatically scores and prioritizes leads (Your automation score: ${prospect.automation_need_score}/100)
✓ Captures inquiries from all your channels
✓ Generates smart follow-ups
✓ Tracks engagement and conversions

${prospect.automation_need_score >= 60 ? "Based on our analysis, your business could significantly benefit from automation." : ""}

Would you be interested in a quick 10-minute demo?

Best regards,
[Your Name]
EMOR OS Team

---
RAW DATA FOR CUSTOMIZATION:
Business: ${prospect.name}
${prospect.city ? `Location: ${prospect.city}` : ""}
${prospect.category ? `Industry: ${prospect.category}` : ""}
${prospect.phone ? `Phone: ${prospect.phone}` : ""}
${prospect.website ? `Website: ${prospect.website}` : ""}
Automation Score: ${prospect.automation_need_score}/100
${prospect.score_reasons?.length ? `Score Reasons: ${prospect.score_reasons.join(", ")}` : ""}`;
}

// ═══════════════════════════════════════════════════════════════════
// DETAIL COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function InquiryDetail({
  item,
  onSoftDelete,
  onOpenEmailModal,
}: {
  item: InboxItem;
  onSoftDelete: () => Promise<void>;
  onOpenEmailModal: (inquiry: InquiryRow) => void;
}) {
  const inquiry = item.meta as InquiryRow;
  const form = inquiry?.form ?? {};
  const email = normalizeEmail(form);
  const name = normalizeName(form);
  const company = normalizeCompany(form);
  const message = normalizeMessage(form);
  const phone = normalizePhone(form);
  const services = normalizeServices(form);
  const interest = normalizeInterest(form);
  const [copying, setCopying] = useState(false);

  const copyMessage = async () => {
    if (!message) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(safeString(message));
    } catch {}
    setTimeout(() => setCopying(false), 1500);
  };

  const openEmailModal = () => {
    onOpenEmailModal(inquiry);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-lg font-semibold text-gray-900 ring-1 ring-gray-300">
            {initials(safeString(name))}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{safeString(name)}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {email && (
                <a href={`mailto:${safeString(email)}`} className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                  <Icon name="mail" className="h-3.5 w-3.5" />
                  {safeString(email)}
                </a>
              )}
              {phone && (
                <a href={`tel:${safeString(phone)}`} className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                  <Icon name="phone" className="h-3.5 w-3.5" />
                  {safeString(phone)}
                </a>
              )}
              {company && (
                <span className="flex items-center gap-1.5">
                  <Icon name="spark" className="h-3.5 w-3.5" />
                  {safeString(company)}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="info">Inquiry</Badge>
              {!inquiry.last_contacted_at ? (
                <Badge variant="warning" dot>Needs reply</Badge>
              ) : (
                <Badge variant="success">Contacted</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="solid" 
            onClick={openEmailModal}
            disabled={!email}
          >
            <Icon name="spark" className="h-4 w-4" />
            Generate Email
          </Button>
          {email && (
            <Button variant="glass" onClick={() => window.location.href = `mailto:${safeString(email)}`}>
              <Icon name="mail" className="h-4 w-4" />
              Email
            </Button>
          )}
          {phone && (
            <Button variant="glass" onClick={() => window.location.href = `tel:${safeString(phone)}`}>
              <Icon name="phone" className="h-4 w-4" />
              Call
            </Button>
          )}
          <Link
            href={`/inquiries?id=${inquiry.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-100 px-3.5 py-2 text-sm font-medium text-gray-900 transition-all duration-200 hover:bg-gray-200 hover:text-gray-900"
          >
            <Icon name="external" className="h-4 w-4" />
            Full view
          </Link>
          <Button variant="danger" onClick={() => void onSoftDelete()}>
            <Icon name="archive" className="h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <DetailSection title="Timeline">
          <MetaRow label="Received" value={formatDateTime(inquiry.created_at)} />
          <MetaRow label="Last contacted" value={inquiry.last_contacted_at ? formatDateTime(inquiry.last_contacted_at) : "Never"} />
          <MetaRow label="Emails sent" value={inquiry.emails_sent ?? 0} />
        </DetailSection>

        <DetailSection title="Source">
          <MetaRow label="Page" value={inquiry.page ?? "Unknown"} />
          <MetaRow label="Organization" value={inquiry.org ?? "—"} />
        </DetailSection>

        <DetailSection title="Intent">
          <MetaRow label="Interest" value={interest} />
          <MetaRow
            label="Services"
            value={services ? (Array.isArray(services) ? services.join(", ") : safeString(services)) : null}
          />
        </DetailSection>
      </div>

      {/* Message */}
      {message ? (
        <DetailSection
          title="Message"
          actions={
            <Button size="sm" variant="ghost" onClick={copyMessage}>
              <Icon name={copying ? "check" : "copy"} className="h-3.5 w-3.5" />
              {copying ? "Copied" : "Copy"}
            </Button>
          }
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
            {safeString(message)}
          </p>
        </DetailSection>
      ) : (
        <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No message in this inquiry
        </div>
      )}

      {/* Raw payload */}
      <details className="rounded-xl border border-gray-300 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors">
          View raw payload
        </summary>
        <div className="border-t border-gray-300 p-4">
          <pre className="overflow-auto rounded-lg bg-black/30 p-3 text-xs text-gray-700 font-mono">
            {JSON.stringify(form ?? {}, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}

function ProspectDetail({ 
  item,
  onOpenEmailModal,
}: { 
  item: InboxItem;
  onOpenEmailModal: (prospect: ProspectRow) => void;
}) {
  const p = item.meta as ProspectRow;
  const score = p?.automation_need_score ?? 0;
  const tone = scoreTone(score);
  const [copying, setCopying] = useState(false);

  const copyInfo = async () => {
    setCopying(true);
    const payload = [
      safeString(p?.name),
      p?.city ? `City: ${p.city}` : "",
      p?.category ? `Category: ${p.category}` : "",
      p?.phone ? `Phone: ${p.phone}` : "",
      p?.website ? `Website: ${p.website}` : "",
      `Score: ${score}`,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(payload);
    } catch {}
    setTimeout(() => setCopying(false), 1500);
  };

  const openEmailModal = () => {
    onOpenEmailModal(p);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={cx(
              "flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold text-gray-900 ring-1 ring-gray-300",
              score >= 60 ? "bg-gradient-to-br from-rose-500/20 to-amber-500/20" : "bg-gray-200"
            )}
          >
            {initials(safeString(p?.name ?? "P"))}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{safeString(p?.name ?? "Prospect")}</h1>
            <div className="mt-1 text-sm text-gray-600">
              {[p?.city, p?.category].filter(Boolean).join(" • ") || "No location"}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge>Prospect</Badge>
              <span
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
                  tone.bg,
                  tone.border,
                  tone.color
                )}
              >
                <Icon name="bolt" className="h-3.5 w-3.5" />
                {tone.label} • {score}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="solid" 
            onClick={openEmailModal}
          >
            <Icon name="spark" className="h-4 w-4" />
            Generate Email
          </Button>
          {p?.phone && (
            <Button variant="glass" onClick={() => window.location.href = `tel:${safeString(p.phone)}`}>
              <Icon name="phone" className="h-4 w-4" />
              Call
            </Button>
          )}
          {p?.website && (
            <a
              href={safeString(p.website)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-100 px-3.5 py-2 text-sm font-medium text-gray-900 transition-all duration-200 hover:bg-gray-200 hover:text-gray-900 backdrop-blur-xl shadow-lg shadow-gray-200/50"
            >
              <Icon name="link" className="h-4 w-4" />
              Website
            </a>
          )}
          <Button variant="ghost" onClick={copyInfo}>
            <Icon name={copying ? "check" : "copy"} className="h-4 w-4" />
            {copying ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
{/* Website Trust Score Alert */}
      {p.website_flags && p.website_flags.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Icon name="info" className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 mb-1">Website Issues</p>
              <ul className="text-xs text-amber-800 space-y-1">
                {p.website_flags.map((flag: string, idx: number) => (
                  <li key={idx}>• {flag}</li>
                ))}
              </ul>
              {p.website_trust_score !== null && (
                <p className="text-xs text-amber-700 mt-2">Trust: {p.website_trust_score}/100</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Addresses */}
      {(p.primary_email || (p.emails && p.emails.length > 0)) && (
        <DetailSection title="📧 Emails">
          <div className="space-y-2">
            {p.primary_email && (
              <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 p-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-semibold text-blue-700 uppercase shrink-0">Primary</span>
                  <a href={`mailto:${p.primary_email}`} className="text-sm text-blue-600 hover:underline font-medium truncate">
                    {p.primary_email}
                  </a>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(p.primary_email!)}
                  className="text-blue-600 hover:text-blue-700 shrink-0 ml-2"
                >
                  <Icon name="copy" className="h-4 w-4" />
                </button>
              </div>
            )}
            {p.emails && p.emails.length > 0 && (
              <div className="space-y-1.5">
                {p.emails.filter((e: string) => e !== p.primary_email).map((email: string, idx: number) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <a href={`mailto:${email}`} className="text-sm text-gray-700 hover:text-blue-600 truncate flex-1">
                      {email}
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(email)}
                      className="text-gray-500 hover:text-gray-700 shrink-0 ml-2"
                    >
                      <Icon name="copy" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {/* Social Profiles */}
      {(p.linkedin_url || p.facebook_url || p.instagram_url || p.twitter_url) && (
        <DetailSection title="🔗 Social">
          <div className="space-y-2">
            {p.linkedin_url && (
              <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-[#0A66C2] shrink-0">
                  <span className="text-white text-sm font-bold">in</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600">LinkedIn</p>
                  <p className="text-sm text-gray-900 truncate group-hover:text-blue-600">{p.linkedin_url}</p>
                </div>
                <Icon name="external" className="h-4 w-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
              </a>
            )}
            {p.facebook_url && (
              <a href={p.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 hover:border-blue-400 hover:bg-blue-50 transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-[#1877F2] shrink-0">
                  <span className="text-white text-xl font-bold">f</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600">Facebook</p>
                  <p className="text-sm text-gray-900 truncate group-hover:text-blue-600">{p.facebook_url}</p>
                </div>
                <Icon name="external" className="h-4 w-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
              </a>
            )}
            {p.instagram_url && (
              <a href={p.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 hover:border-pink-300 hover:bg-pink-50 transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 shrink-0">
                  <span className="text-white text-lg">📷</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600">Instagram</p>
                  <p className="text-sm text-gray-900 truncate group-hover:text-pink-600">{p.instagram_url}</p>
                </div>
                <Icon name="external" className="h-4 w-4 text-gray-400 group-hover:text-pink-600 shrink-0" />
              </a>
            )}
            {p.twitter_url && (
              <a href={p.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 hover:border-sky-300 hover:bg-sky-50 transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-black shrink-0">
                  <span className="text-white text-xl font-bold">𝕏</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600">Twitter/X</p>
                  <p className="text-sm text-gray-900 truncate group-hover:text-sky-600">{p.twitter_url}</p>
                </div>
                <Icon name="external" className="h-4 w-4 text-gray-400 group-hover:text-sky-600 shrink-0" />
              </a>
            )}
          </div>
        </DetailSection>
      )}

      {/* Business Intelligence */}
      {(p.cms || p.employee_count || p.founded_year || p.has_booking_system || p.has_live_chat) && (
        <DetailSection title="🧠 Intelligence">
          <div className="grid grid-cols-2 gap-3">
            {p.cms && (
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
                <p className="text-xs font-medium text-purple-700 mb-1">Platform</p>
                <p className="text-sm font-semibold text-purple-900">{p.cms}</p>
              </div>
            )}
            {p.employee_count !== null && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-medium text-blue-700 mb-1">Team</p>
                <p className="text-sm font-semibold text-blue-900">~{p.employee_count}</p>
              </div>
            )}
            {p.founded_year !== null && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs font-medium text-emerald-700 mb-1">Founded</p>
                <p className="text-sm font-semibold text-emerald-900">{p.founded_year}</p>
              </div>
            )}
            {p.has_booking_system && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                <p className="text-xs font-medium text-orange-700 mb-1">Booking</p>
                <p className="text-sm font-semibold text-orange-900">✓ System</p>
              </div>
            )}
            {p.has_live_chat && (
              <div className="rounded-lg bg-cyan-50 border border-cyan-200 p-3">
                <p className="text-xs font-medium text-cyan-700 mb-1">Chat</p>
                <p className="text-sm font-semibold text-cyan-900">✓ Enabled</p>
              </div>
            )}
          </div>
        </DetailSection>
      )}
      {/* Meta cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <DetailSection title="Discovery">
          <MetaRow label="Discovered" value={formatDateTime((p?.discovered_at ?? p?.last_seen_at) as string)} />
          <MetaRow label="Last seen" value={p?.last_seen_at ? formatDateTime(p.last_seen_at) : null} />
        </DetailSection>

        <DetailSection title="Source">
          <MetaRow label="Search query" value={p?.search_query} />
          <MetaRow label="Radius" value={typeof p?.search_radius_m === "number" ? `${p.search_radius_m}m` : null} />
          <MetaRow label="Run ID" value={p?.run_id ? <code className="font-mono text-[10px]">{p.run_id.slice(0, 8)}...</code> : null} />
        </DetailSection>

        <DetailSection title="Priority">
          <p className="text-xs text-gray-700 leading-relaxed">
            {score >= 60
              ? "High automation potential. Focus outreach on pain points like missed online opportunities, weak reviews, or no website presence."
              : "Lower priority. Consider batching with other outreach or deprioritizing for now."}
          </p>
        </DetailSection>
      </div>

      {/* Score reasons */}
      {Array.isArray(p?.score_reasons) && p.score_reasons.length > 0 ? (
        <DetailSection title="Score breakdown">
          <div className="space-y-2">
            {p.score_reasons.map((reason, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg bg-gray-100 p-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-200 text-[10px] font-bold text-gray-700">
                  {idx + 1}
                </span>
                <p className="text-sm text-gray-800 leading-relaxed">{reason}</p>
              </div>
            ))}
          </div>
        </DetailSection>
      ) : (
        <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No score breakdown available
        </div>
      )}

      {/* Raw data */}
      <details className="rounded-xl border border-gray-300 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors">
          View raw record
        </summary>
        <div className="border-t border-gray-300 p-4">
          <pre className="overflow-auto rounded-lg bg-black/30 p-3 text-xs text-gray-700 font-mono">
            {JSON.stringify(p ?? {}, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function InboxPage() {
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);

  const [tab, setTab] = useState<InboxTab>("prospects");
  const [sort, setSort] = useState<SortMode>("score");

  const [query, setQuery] = useState("");
  const [onlyHot, setOnlyHot] = useState(false);
  const [onlyWithContact, setOnlyWithContact] = useState(false);

  // Pagination state - show 20 items initially with option to expand
  const [prospectsLimit, setProspectsLimit] = useState(20);
  const [inquiriesLimit, setInquiriesLimit] = useState(20);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<Record<string, boolean>>({});

  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalData, setEmailModalData] = useState<any>(null);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: Toast = { id, ...t };
    setToasts((prev) => [next, ...prev].slice(0, 4));
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  // Helper to prepare inquiry email data
  const prepareInquiryEmailData = useCallback((inquiry: InquiryRow) => {
    const form = inquiry.form ?? {};
    const name = normalizeName(form);
    const email = normalizeEmail(form);
    
    return {
      name: typeof name === 'string' ? name : 'Website Inquiry',
      firstName: typeof name === 'string' ? name.split(' ')[0] : 'there',
      email: email ? String(email) : '',
      company: normalizeCompany(form),
      phone: normalizePhone(form) ? String(normalizePhone(form)) : undefined,
      message: normalizeMessage(form),
      services: normalizeServices(form),
      interest: normalizeInterest(form),
      page: inquiry.page || undefined,
      receivedDate: inquiry.created_at,
    };
  }, []);

  // Helper to prepare prospect email data
  const prepareProspectEmailData = useCallback((prospect: ProspectRow) => {
    return {
      businessName: prospect.name,
      city: prospect.city || undefined,
      category: prospect.category || undefined,
      phone: prospect.phone || undefined,
      website: prospect.website || undefined,
      automationScore: prospect.automation_need_score,
      scoreReasons: prospect.score_reasons || undefined,
    };
  }, []);

  const loadAll = useCallback(async (reason?: string) => {
    setLoading(true);

    // Smart loading based on current tab
    const [{ data: inquiriesData, error: iErr }, { data: prospectsData, error: pErr }] = await Promise.all([
      // Load inquiries based on tab and limit
      tab === "inquiries" || tab === "all" 
        ? supabaseBrowser
            .from("inquiries")
            .select("id, created_at, page, org, form, last_contacted_at, emails_sent, is_deleted")
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(tab === "all" ? 300 : inquiriesLimit)
        : Promise.resolve({ data: [], error: null }),
      // Load prospects based on tab and limit
      tab === "prospects" || tab === "all"
        ? supabaseBrowser
            .from("prospects")
            .select(`
  id, organization_id, name, city, category, phone, website, 
  automation_need_score, score_reasons, discovered_at, last_seen_at, 
  run_id, search_query, search_radius_m,
  primary_email, emails, linkedin_url, facebook_url, instagram_url, twitter_url,
  cms, has_booking_system, has_live_chat, employee_count, founded_year,
  website_verified, website_trust_score, website_flags
`)
            .eq("organization_id", EMOR_ORG_ID)
            .order("automation_need_score", { ascending: false })
            .limit(tab === "all" ? 300 : prospectsLimit)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (iErr) console.error("Inquiries error:", iErr.message);
    if (pErr) console.error("Prospects error:", pErr.message);

    setInquiries((inquiriesData as any) ?? []);
    setProspects((prospectsData as any) ?? []);
    setLoading(false);

    if (reason && (iErr || pErr)) {
      toast({ title: "Refresh failed", message: "Check console for details", kind: "error" });
    } else if (reason) {
      toast({ title: "Refreshed", message: reason, kind: "success" });
    }
  }, [toast, tab, prospectsLimit, inquiriesLimit]);

  useEffect(() => {
    loadAll();

    const ch = supabaseBrowser
      .channel("inbox-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => loadAll())
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(ch);
    };
  }, [loadAll]);

  // Reload when tab changes or limits change
  useEffect(() => {
    loadAll();
  }, [tab, prospectsLimit, inquiriesLimit]);

  const items: InboxItem[] = useMemo(() => {
    const a: InboxItem[] = inquiries.map((r) => {
      const form = r.form ?? {};
      const email = normalizeEmail(form);
      const phone = normalizePhone(form);
      const name = normalizeName(form);
      const title = typeof name === "string" ? name : "Website Inquiry";
      const subtitle = email ? String(email) : r.page ?? "Inquiry";
      return {
        kind: "inquiry",
        id: r.id,
        title,
        subtitle,
        createdAt: r.created_at,
        email: email ? String(email) : null,
        phone: phone ? String(phone) : null,
        lastContactedAt: r.last_contacted_at ?? null,
        emailsSent: r.emails_sent ?? null,
        page: r.page ?? null,
        meta: r,
      };
    });

    const b: InboxItem[] = prospects.map((p) => {
      const createdAt = (p.discovered_at ?? p.last_seen_at) as string;
      return {
        kind: "prospect",
        id: p.id,
        title: p.name,
        subtitle: [p.city, p.category].filter(Boolean).join(" • "),
        createdAt,
        phone: p.phone ?? null,
        website: p.website ?? null,
        city: p.city ?? null,
        category: p.category ?? null,
        score: p.automation_need_score ?? 0,
        scoreReasons: p.score_reasons ?? null,
        runId: p.run_id ?? null,
        searchQuery: p.search_query ?? null,
        searchRadiusM: p.search_radius_m ?? null,
        meta: p,
      };
    });

    return [...a, ...b];
  }, [inquiries, prospects]);

  const counts = useMemo(() => {
    const inquiryCount = items.filter((x) => x.kind === "inquiry").length;
    const prospectCount = items.filter((x) => x.kind === "prospect").length;
    const hotProspects = items.filter((x) => x.kind === "prospect" && (x.score ?? 0) >= 60).length;
    const needsAttention = items.filter((x) => x.kind === "inquiry" && !x.lastContactedAt).length;
    return { inquiryCount, prospectCount, hotProspects, needsAttention, total: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = items;

    if (tab === "inquiries") base = base.filter((x) => x.kind === "inquiry");
    if (tab === "prospects") base = base.filter((x) => x.kind === "prospect");

    if (onlyHot) base = base.filter((x) => x.kind === "prospect" && (x.score ?? 0) >= 60);

    if (onlyWithContact) {
      base = base.filter((x) => !!x.email || !!x.phone || !!x.website);
    }

    if (q) {
      base = base.filter((x) => {
        const hay = [
          x.title,
          x.subtitle ?? "",
          x.email ?? "",
          x.phone ?? "",
          x.website ?? "",
          x.city ?? "",
          x.category ?? "",
          x.page ?? "",
          x.runId ?? "",
          x.searchQuery ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const sorted = [...base].sort((a, b) => {
      if (sort === "score") {
        const sa = a.score ?? -1;
        const sb = b.score ?? -1;
        if (sa !== sb) return sb - sa;
        return a.createdAt < b.createdAt ? 1 : -1;
      }
      if (sort === "oldest") return a.createdAt > b.createdAt ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

    return sorted;
  }, [items, tab, onlyHot, onlyWithContact, query, sort]);

  const selectedItem = useMemo(() => {
    if (!selectedKey) return null;
    return filtered.find((x) => `${x.kind}:${x.id}` === selectedKey) ?? items.find((x) => `${x.kind}:${x.id}` === selectedKey) ?? null;
  }, [selectedKey, filtered, items]);

  useEffect(() => {
    if (!selectedKey && filtered.length) {
      setSelectedKey(`${filtered[0].kind}:${filtered[0].id}`);
    }
  }, [filtered, selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;
    const exists = filtered.some((x) => `${x.kind}:${x.id}` === selectedKey);
    if (!exists && filtered.length) setSelectedKey(`${filtered[0].kind}:${filtered[0].id}`);
  }, [filtered, selectedKey]);

  const selectedCount = useMemo(() => Object.values(selectedSet).filter(Boolean).length, [selectedSet]);

  const toggleSelect = (key: string) => {
    setSelectedSet((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearBulk = () => setSelectedSet({});
  const bulkSelectAll = () => {
    const map: Record<string, boolean> = {};
    for (const it of filtered) map[`${it.kind}:${it.id}`] = true;
    setSelectedSet(map);
  };

  async function softDeleteInquiry(id: string) {
    const { error } = await supabaseBrowser.from("inquiries").update({ is_deleted: true }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async function bulkArchiveSelected() {
    const keys = Object.entries(selectedSet).filter(([, v]) => v).map(([k]) => k);
    if (!keys.length) return;

    const inquiryIds = keys.filter((k) => k.startsWith("inquiry:")).map((k) => k.split(":")[1]);

    try {
      if (inquiryIds.length) {
        const { error } = await supabaseBrowser.from("inquiries").update({ is_deleted: true }).in("id", inquiryIds);
        if (error) throw new Error(error.message);
      }
      toast({ title: "Archived", message: `${inquiryIds.length} item(s)`, kind: "success" });
      clearBulk();
      loadAll("After archive");
    } catch (e: any) {
      toast({ title: "Archive failed", message: e?.message, kind: "error" });
    }
  }

  async function bulkCopySelected() {
    const keys = Object.entries(selectedSet).filter(([, v]) => v).map(([k]) => k);
    if (!keys.length) return;
    const selectedItems = items.filter((x) => keys.includes(`${x.kind}:${x.id}`));
    const text = selectedItems
      .map((x) =>
        [
          `[${x.kind.toUpperCase()}] ${x.title}`,
          x.subtitle ? `— ${x.subtitle}` : "",
          x.email ? `email: ${x.email}` : "",
          x.phone ? `phone: ${x.phone}` : "",
          x.website ? `website: ${x.website}` : "",
          x.score != null ? `score: ${x.score}` : "",
        ].filter(Boolean).join(" ")
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", message: `${selectedItems.length} item(s)`, kind: "success" });
    } catch {
      toast({ title: "Copy failed", message: "Clipboard blocked", kind: "error" });
    }
  }

  const showBulkBar = selectedCount > 0;

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-rose-500/10 blur-[100px]" />
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((x) => x.id !== id))} />

      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-200 ring-1 ring-gray-300">
              <Icon name="inbox" className="h-6 w-6 text-gray-900" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
              <p className="mt-0.5 text-sm text-gray-600">
                {loading
                  ? "Loading..."
                  : `${counts.total} total · ${counts.needsAttention} new · ${counts.hotProspects} hot`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => loadAll("Manual refresh")}>
              <Icon name="refresh" className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </header>

        {/* Search & filters */}
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 max-w-xl">
            <Input
              value={query}
              onChange={setQuery}
              placeholder="Search by name, email, phone, city..."
              leftIcon={<Icon name="search" className="h-4 w-4" />}
              rightNode={
                query && (
                  <button
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                    onClick={() => setQuery("")}
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                )
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={onlyHot} onClick={() => setOnlyHot(!onlyHot)} icon={<Icon name="bolt" className="h-3.5 w-3.5" />}>
              Hot only
            </FilterPill>
            <FilterPill active={onlyWithContact} onClick={() => setOnlyWithContact(!onlyWithContact)} icon={<Icon name="filter" className="h-3.5 w-3.5" />}>
              Has contact
            </FilterPill>
            <SortDropdown value={sort} onChange={setSort} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex items-center gap-1 border-b border-gray-300 pb-px">
          <TabButton active={tab === "all"} onClick={() => setTab("all")} count={counts.total}>
            All
          </TabButton>
          <TabButton active={tab === "inquiries"} onClick={() => setTab("inquiries")} count={counts.inquiryCount}>
            Inquiries
          </TabButton>
          <TabButton active={tab === "prospects"} onClick={() => setTab("prospects")} count={counts.prospectCount}>
            Prospects
          </TabButton>
        </div>

        {/* Bulk action bar */}
        {showBulkBar && (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border-2 border-blue-500/30 bg-blue-50 p-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
                <Icon name="check" className="h-4 w-4" />
              </span>
              <span className="text-sm text-gray-900">
                <strong>{selectedCount}</strong> {selectedCount === 1 ? "item" : "items"} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={bulkCopySelected}>
                <Icon name="copy" className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button size="sm" variant="danger" onClick={bulkArchiveSelected}>
                <Icon name="archive" className="h-3.5 w-3.5" />
                Clear Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={clearBulk}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* List */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="rounded-2xl border border-gray-300 bg-gray-50 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2 border-b border-gray-300 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (selectedCount === filtered.length && filtered.length > 0) {
                        clearBulk();
                      } else {
                        bulkSelectAll();
                      }
                    }}
                    className={cx(
                      "flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200",
                      selectedCount === filtered.length && filtered.length > 0
                        ? "border-white bg-gray-900 text-white"
                        : "border-gray-400 bg-transparent hover:border-gray-500"
                    )}
                    title={selectedCount === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
                  >
                    {selectedCount === filtered.length && filtered.length > 0 && <Icon name="check" className="h-3.5 w-3.5" />}
                  </button>
                  <span className="text-sm font-medium text-gray-900">Queue</span>
                </div>
                <span className="text-xs text-gray-500 tabular-nums">
                  {loading ? "..." : selectedCount > 0 ? `${selectedCount} selected` : `${filtered.length} items`}
                </span>
              </div>

              <div
                className="divide-y divide-gray-200 overflow-auto p-2"
                style={{ maxHeight: "calc(100vh - 320px)" }}
              >
                {loading ? (
                  <div className="space-y-2 p-2">
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    title="No results"
                    subtitle="Try adjusting your filters"
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          setQuery("");
                          setOnlyHot(false);
                          setOnlyWithContact(false);
                          setTab("all");
                        }}
                      >
                        Reset filters
                      </Button>
                    }
                  />
                ) : (
                  filtered.map((it) => {
                    const key = `${it.kind}:${it.id}`;
                    const active = selectedKey === key;
                    const checked = !!selectedSet[key];

                    return (
                      <InboxRow
                        key={key}
                        id={`row-${key}`}
                        item={it}
                        active={active}
                        checked={checked}
                        onChecked={() => toggleSelect(key)}
                        onClick={() => {
                          setSelectedKey(key);
                          setMobileDetailOpen(true);
                        }}
                      />
                    );
                  })
                )}
              </div>

              {/* Load More Button */}
              {!loading && filtered.length > 0 && (
                <div className="border-t border-gray-200 p-3">
                  {tab === "prospects" && prospects.length >= prospectsLimit && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-gray-500">Showing {prospects.length} prospects</span>
                      <div className="flex gap-2">
                        {prospectsLimit < 40 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setProspectsLimit(40)}
                          >
                            Load 40
                          </Button>
                        )}
                        {prospectsLimit < 60 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setProspectsLimit(60)}
                          >
                            Load 60
                          </Button>
                        )}
                        {prospectsLimit < 300 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setProspectsLimit(300)}
                          >
                            Load All
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {tab === "inquiries" && inquiries.length >= inquiriesLimit && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-gray-500">Showing {inquiries.length} inquiries</span>
                      <div className="flex gap-2">
                        {inquiriesLimit < 40 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInquiriesLimit(40)}
                          >
                            Load 40
                          </Button>
                        )}
                        {inquiriesLimit < 60 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInquiriesLimit(60)}
                          >
                            Load 60
                          </Button>
                        )}
                        {inquiriesLimit < 300 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInquiriesLimit(300)}
                          >
                            Load All
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {tab === "all" && (
                    <div className="text-center">
                      <span className="text-xs text-gray-500">
                        Showing {prospects.length} prospects + {inquiries.length} inquiries
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Detail panel (desktop) */}
          <div className="hidden lg:block lg:col-span-8 xl:col-span-9">
            <div className="rounded-2xl border border-gray-300 bg-gray-50 p-6 backdrop-blur-sm min-h-[calc(100vh-320px)]">
              {!selectedItem ? (
                <EmptyState
                  icon={<Icon name="panel" className="h-6 w-6" />}
                  title="Select an item"
                  subtitle="Choose from the list to see details"
                />
              ) : selectedItem.kind === "inquiry" ? (
                <InquiryDetail
                  item={selectedItem}
                  onSoftDelete={async () => {
                    try {
                      await softDeleteInquiry(selectedItem.id);
                      toast({ title: "Archived", kind: "success" });
                      clearBulk();
                      loadAll("After archive");
                    } catch (e: any) {
                      toast({ title: "Failed", message: e?.message, kind: "error" });
                    }
                  }}
                  onOpenEmailModal={(inquiry) => {
                    const emailData = prepareInquiryEmailData(inquiry);
                    const suggestedTemplate = suggestTemplate('inquiry', emailData);
                    const generated = generateEmailFromTemplate(suggestedTemplate, emailData);
                    
                    setEmailModalData({
                      to: emailData.email,
                      toName: emailData.name,
                      subject: generated.subject,
                      body: generated.body,
                      itemType: 'inquiry' as const,
                      itemId: inquiry.id,
                    });
                    setEmailModalOpen(true);
                  }}
                />
              ) : (
                <ProspectDetail 
                  item={selectedItem}
                  onOpenEmailModal={(prospect) => {
                    const emailData = prepareProspectEmailData(prospect);
                    const suggestedTemplate = suggestTemplate('prospect', emailData);
                    const generated = generateEmailFromTemplate(suggestedTemplate, emailData);
                    
                    setEmailModalData({
                      to: '', // Prospects don't have email in current schema
                      toName: prospect.name,
                      subject: generated.subject,
                      body: generated.body,
                      itemType: 'prospect' as const,
                      itemId: prospect.id,
                    });
                    setEmailModalOpen(true);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile detail overlay */}
      {mobileDetailOpen && selectedItem && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-gray-900/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMobileDetailOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-auto rounded-t-3xl border-t border-gray-300 bg-white p-4 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gray-300" />
            <button
              className="absolute right-4 top-4 rounded-lg p-2 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              onClick={() => setMobileDetailOpen(false)}
            >
              <Icon name="x" className="h-5 w-5" />
            </button>

            {selectedItem.kind === "inquiry" ? (
              <InquiryDetail
                item={selectedItem}
                onSoftDelete={async () => {
                  try {
                    await softDeleteInquiry(selectedItem.id);
                    toast({ title: "Archived", kind: "success" });
                    clearBulk();
                    loadAll("After archive");
                    setMobileDetailOpen(false);
                  } catch (e: any) {
                    toast({ title: "Failed", message: e?.message, kind: "error" });
                  }
                }}
                onOpenEmailModal={(inquiry) => {
                  const emailData = prepareInquiryEmailData(inquiry);
                  const suggestedTemplate = suggestTemplate('inquiry', emailData);
                  const generated = generateEmailFromTemplate(suggestedTemplate, emailData);
                  
                  setEmailModalData({
                    to: emailData.email,
                    toName: emailData.name,
                    subject: generated.subject,
                    body: generated.body,
                    itemType: 'inquiry' as const,
                    itemId: inquiry.id,
                  });
                  setEmailModalOpen(true);
                }}
              />
            ) : (
              <ProspectDetail 
                item={selectedItem}
                onOpenEmailModal={(prospect) => {
                  const emailData = prepareProspectEmailData(prospect);
                  const suggestedTemplate = suggestTemplate('prospect', emailData);
                  const generated = generateEmailFromTemplate(suggestedTemplate, emailData);
                  
                  setEmailModalData({
                    to: '',
                    toName: prospect.name,
                    subject: generated.subject,
                    body: generated.body,
                    itemType: 'prospect' as const,
                    itemId: prospect.id,
                  });
                  setEmailModalOpen(true);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModalOpen && emailModalData && (
        <EmailModal
          isOpen={emailModalOpen}
          onClose={() => {
            setEmailModalOpen(false);
            setEmailModalData(null);
          }}
          emailData={emailModalData}
          onSend={async (finalEmail) => {
            try {
              // Use YOUR existing API endpoint
              const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: emailModalData.to,
                  subject: finalEmail.subject,
                  message: finalEmail.body,
                  inquiryId: emailModalData.itemType === 'inquiry' ? emailModalData.itemId : undefined,
                }),
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send email');
              }
              
              // Success! Show toast and reload
              toast({ title: 'Email sent successfully!', kind: 'success' });
              setEmailModalOpen(false);
              setEmailModalData(null);
              loadAll('Email sent');
            } catch (error: any) {
              // Don't close modal on error so user can try again
              throw error;
            }
          }}
        />
      )}
    </div>
  );
}
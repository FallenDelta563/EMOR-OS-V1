// lib/emailTemplates.ts - EMORAI EMAIL SYSTEM (Human-first outreach)

export type TemplateType = "prospect";

export type ProspectData = {
  businessName: string;
  city?: string;
  category?: string;
  phone?: string;
  website?: string;
  automationScore?: number;
  scoreReasons?: string[];

  // Enrichment data
  primary_email?: string;
  cms?: string;
  has_booking_system?: boolean;
  has_live_chat?: boolean;
  employee_count?: number;
  founded_year?: number;
  linkedin_url?: string;
  facebook_url?: string;
};

export type EmailOutput = {
  subject: string;
  body: string;
};

// ✅ Single outreach style (for now)
export type OutreachStyle = "default";

export const OUTREACH_STYLE_LABEL: Record<OutreachStyle, string> = {
  default: "Style 1 — Introduction",
};

function safeFirstName(toName?: string, businessName?: string) {
  const raw = (toName || "").trim();
  
  // If we have a person's name (contains space or is clearly a first name)
  if (raw && raw.length > 0) {
    // If it looks like a full name (has space), take first part
    if (raw.includes(' ')) {
      return raw.split(/\s+/)[0];
    }
    // If it's a single word and looks like a person name (not business-y)
    // Check if it doesn't contain business keywords
    const businessKeywords = ['LLC', 'Inc', 'Corp', 'Company', 'Co.', 'Ltd', 'Services', 'Group'];
    const hasBusinessKeyword = businessKeywords.some(keyword => 
      raw.toUpperCase().includes(keyword.toUpperCase())
    );
    
    if (!hasBusinessKeyword && raw.length < 20) {
      return raw;
    }
  }
  
  // Fall back to shortened business name
  if (businessName) {
    const bizName = businessName.trim();
    // Remove common business suffixes and take first word or two
    const cleaned = bizName
      .replace(/\s+(LLC|Inc\.|Corp\.|Company|Co\.|Ltd\.|Services|Group|Roofing|Contractors?).*$/i, '')
      .trim();
    
    // Take first 1-2 words (max 25 chars)
    const words = cleaned.split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 25);
    }
    // Return first two words if reasonable length
    const shortName = words.slice(0, 2).join(' ');
    return shortName.length <= 25 ? shortName : words[0];
  }
  
  return "there";
}

function safeBizName(name?: string) {
  const raw = (name || "").trim();
  return raw || "your business";
}

// Smart calendar function - gets next two business days (Mon-Fri)
function getNextTwoBusinessDays(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();
  const businessDays: string[] = [];
  let currentDate = new Date(today);
  
  // Start from tomorrow
  currentDate.setDate(currentDate.getDate() + 1);
  
  while (businessDays.length < 2) {
    const dayOfWeek = currentDate.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays.push(days[dayOfWeek]);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return `${businessDays[0]} or ${businessDays[1]}`;
}

// ═══════════════════════════════════════════════════════════════════
// HUMAN-FIRST EMAIL GENERATION (Style 1 + Style 5)
// Now distinguishes between businesses with/without websites
// ═══════════════════════════════════════════════════════════════════

export function generateProspectOutreachEmail(
  style: OutreachStyle,
  data: ProspectData,
  opts?: { senderName?: string; toName?: string }
): EmailOutput {
  const senderName = opts?.senderName || "Oswaldo";
  const firstName = safeFirstName(opts?.toName, data.businessName);
  const businessName = safeBizName(data.businessName);
  const location = data.city ? ` in ${data.city}` : "";
  const hasWebsite = !!(data.website && data.website.trim().length > 0);

  // Style 1 — Main outreach template
  // Automatically adapts based on whether business has a website
  if (hasWebsite) {
    // Has website version - coming soon, use same as no-website for now
    const nextBusinessDays = getNextTwoBusinessDays();
    
    return {
      subject: `Intro — EMOR AI`,
      body: `Hi ${firstName},

I'm ${senderName}, founder of EMOR AI.

I came across ${businessName}${location} while browsing businesses in your area. I noticed that you don't have much of an online presence yet, and I thought it might be worth introducing myself.

At EMOR AI, we help businesses get found online and handle leads properly when they come in. This is especially important for service businesses that rely on word of mouth, which is quite common in your field.

If you'd like to see who I am first, our site is emorai.com. Otherwise, I'd be happy to explain why I reached out. I'm available on ${nextBusinessDays} if you had any inquiries.

Best,
${senderName}`,
    };
  } else {
    // No website version
    const nextBusinessDays = getNextTwoBusinessDays();
    
    return {
      subject: `Intro — EMOR AI`,
      body: `Hi ${firstName},

I'm ${senderName}, founder of EMOR AI.

I came across ${businessName}${location} while browsing businesses in your area. I noticed that you don't have much of an online presence yet, and I thought it might be worth introducing myself.

At EMOR AI, we help businesses get found online and handle leads properly when they come in. This is especially important for service businesses that rely on word of mouth, which is quite common in your field.

If you'd like to see who I am first, our site is emorai.com. Otherwise, I'd be happy to explain why I reached out. I'm available on ${nextBusinessDays} if you had any inquiries.

Best,
${senderName}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN API (your app calls this)
// Now supports style selection + personalization
// ═══════════════════════════════════════════════════════════════════

export function generateEmailFromTemplate(
  templateType: TemplateType,
  data: ProspectData,
  opts?: { style?: OutreachStyle; senderName?: string; toName?: string }
): EmailOutput {
  if (templateType !== "prospect") {
    return {
      subject: `Re: ${safeBizName(data.businessName)}`,
      body: `Hi,

Thanks for reaching out.

If you share what you're trying to improve this quarter (leads, follow-up, booking, reporting), I can tell you if we're a fit and what I'd recommend first.

Best,
${opts?.senderName || "Oswaldo"}
EMOR AI`,
    };
  }

  const style = opts?.style ?? "default";
  return generateProspectOutreachEmail(style, data, {
    senderName: opts?.senderName || "Oswaldo",
    toName: opts?.toName,
  });
}

// Kept for compatibility with your existing code paths
export function suggestTemplate(
  type: "inquiry" | "prospect",
  data: any
): TemplateType {
  return "prospect";
}
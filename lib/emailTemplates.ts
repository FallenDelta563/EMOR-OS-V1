// lib/emailTemplates.ts
/**
 * Email Template System for EMOR OS
 * 
 * Strong, proven templates for inquiry responses and prospect outreach.
 * Each template can be customized with dynamic data.
 */

type InquiryData = {
  name: string;
  firstName: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  services?: string;
  interest?: string;
  page?: string;
  receivedDate: string;
};

type ProspectData = {
  businessName: string;
  city?: string;
  category?: string;
  phone?: string;
  website?: string;
  automationScore: number;
  scoreReasons?: string[];
};

// ═══════════════════════════════════════════════════════════════════
// INQUIRY RESPONSE TEMPLATES
// ═══════════════════════════════════════════════════════════════════

export const inquiryTemplates = {
  // Default professional response
  professional: (data: InquiryData) => ({
    subject: `Re: Your Inquiry${data.company ? ` - ${data.company}` : ''}`,
    body: `Hi ${data.firstName},

Thank you for reaching out${data.page ? ` through ${data.page}` : ''}! I received your inquiry and wanted to respond right away.

${data.message ? `I see you mentioned: "${data.message.substring(0, 150)}${data.message.length > 150 ? '...' : ''}"\n\n` : ''}${data.services || data.interest ? `You expressed interest in: ${data.services || data.interest}\n\n` : ''}I'd love to discuss how EMOR OS can help${data.company ? ` ${data.company}` : ' your business'} streamline lead management and automate your workflow.

Our platform helps businesses:
• Automatically capture and score every lead
• Never miss an inquiry with intelligent notifications
• Generate personalized outreach at scale
• Track engagement and conversions in real-time

Would you be available for a quick 15-minute call this week to explore how we can help?

Best regards,
[Your Name]
EMOR OS - Lead Intelligence System

P.S. - Feel free to reply with your availability or ${data.phone ? 'I can call you at ' + data.phone : 'share your phone number and I\'ll reach out'}.`
  }),

  // Quick and friendly response
  friendly: (data: InquiryData) => ({
    subject: `Hey ${data.firstName} - Let's Talk!`,
    body: `Hey ${data.firstName}!

Thanks so much for reaching out! 🎉

${data.message ? `I read through your message about "${data.message.substring(0, 100)}${data.message.length > 100 ? '...' : ''}" and I think we can definitely help.\n\n` : ''}Here's the quick version of what EMOR OS does:
→ Captures every lead automatically
→ Scores and prioritizes them instantly  
→ Helps you respond faster than your competition
→ Tracks everything so nothing falls through the cracks

${data.company ? `For ${data.company}, this ` : 'This '}typically means more conversions with less manual work.

Want to hop on a quick call this week? I can show you exactly how it works for your specific situation.

Cheers,
[Your Name]
EMOR OS

${data.phone ? `P.S. - I can also call you at ${data.phone} if that's easier!` : ''}`
  }),

  // Detailed/consultative response
  consultative: (data: InquiryData) => ({
    subject: `${data.company || data.firstName} + EMOR OS: Strategic Lead Management`,
    body: `Hi ${data.firstName},

Thank you for your inquiry. I wanted to take a moment to share how EMOR OS can specifically address${data.company ? ` ${data.company}'s` : ' your'} lead management challenges.

${data.message ? `Based on your message: "${data.message.substring(0, 200)}${data.message.length > 200 ? '...' : ''}"\n\nHere's what I'm thinking:\n\n` : ''}**The Challenge:**
Most businesses lose 30-40% of leads due to slow response times, lack of follow-up, and poor prioritization. The best leads get the same treatment as tire-kickers.

**Our Solution:**
EMOR OS is a lead intelligence system that:

1. **Automated Capture** - Every inquiry from every source flows into one place
2. **Intelligent Scoring** - AI rates each lead's potential so you focus on winners first  
3. **Smart Outreach** - Generate personalized responses in seconds, not hours
4. **Complete Tracking** - See every interaction, never wonder "did we follow up?"

${data.services || data.interest ? `**Specifically for ${data.services || data.interest}:**\nWe've helped similar businesses increase response rates by 3x and conversion rates by 40% just by responding faster and smarter.\n\n` : ''}**Next Steps:**
I'd like to schedule a 20-minute consultation to:
• Understand your current lead flow
• Show you how EMOR OS would work for your specific situation
• Create a custom automation plan

Are you available this week?

Best regards,
[Your Name]
Lead Intelligence Specialist
EMOR OS

${data.phone ? `Phone: ${data.phone}` : ''}
Email: ${data.email}`
  }),

  // Service-specific response (customize based on industry)
  serviceSpecific: (data: InquiryData) => ({
    subject: `${data.services || 'Your Service'} + Lead Intelligence - Let's Talk`,
    body: `Hi ${data.firstName},

Thanks for your interest in${data.services ? ` ${data.services}` : ' our services'}!

${data.company ? `I looked into ${data.company} ` : 'I '}wanted to reach out personally because I think we have a really strong solution for ${data.services || 'your needs'}.

**What makes us different:**

For ${data.services || 'your industry'}, the biggest challenge is usually managing inquiry volume while maintaining quality. That's exactly what EMOR OS solves:

✓ Every inquiry captured and organized automatically
✓ AI scoring to identify your best prospects immediately
✓ Intelligent follow-up suggestions based on lead behavior
✓ Full tracking so your team always knows what's happening

${data.message ? `\n**Regarding your specific question:**\n"${data.message.substring(0, 150)}${data.message.length > 150 ? '...' : ''}"\n\nI have some ideas on how we can address this. ` : ''}
Let's schedule a quick demo where I can show you:
→ How leads would flow through YOUR system
→ What automation would look like for YOUR team  
→ The ROI you could expect in YOUR situation

I have time this week - does ${getSuggestedTimes()} work for you?

Looking forward to connecting,
[Your Name]
EMOR OS

${data.phone ? `I can also call you directly at ${data.phone}.` : ''}`
  }),
};

// ═══════════════════════════════════════════════════════════════════
// PROSPECT OUTREACH TEMPLATES
// ═══════════════════════════════════════════════════════════════════

export const prospectTemplates = {
  // Cold outreach for high-score prospects
  coldHigh: (data: ProspectData) => ({
    subject: `${data.businessName} - Lead Management Opportunity`,
    body: `Hi there,

I came across ${data.businessName}${data.city ? ` in ${data.city}` : ''} and noticed something interesting.

${data.category ? `As a ${data.category} business, ` : ''}You're likely dealing with:
• Multiple inquiry sources (website, phone, social, referrals)
• Inconsistent response times
• Leads falling through the cracks
• Not knowing which leads to prioritize

Sound familiar?

**Here's what caught my attention:**
Based on your business profile, I calculated an automation readiness score of ${data.automationScore}/100. ${data.automationScore >= 80 ? 'That\'s exceptionally high - you\'re prime for automation.' : data.automationScore >= 60 ? 'That\'s above average - there\'s real opportunity here.' : 'There\'s definitely room for improvement.'}

${data.scoreReasons && data.scoreReasons.length > 0 ? `\n**Why this score?**\n${data.scoreReasons.slice(0, 3).map(r => `• ${r}`).join('\n')}\n\n` : ''}**What EMOR OS Does:**

Think of it as an intelligent assistant that:
→ Captures every lead automatically, from every source
→ Scores and prioritizes them in seconds
→ Suggests perfect responses based on lead quality
→ Tracks everything so nothing gets missed

The result? Most clients see 2-3x more conversions just from better organization and faster response.

**Quick Question:**
Would you be interested in a 10-minute demo to see how this would work specifically for ${data.businessName}?

I can show you:
1. How your current leads would be organized
2. What automation would look like for your workflow
3. Expected ROI based on your lead volume

No pressure - just want to show you what's possible.

Best,
[Your Name]
EMOR OS - Lead Intelligence
${data.phone ? `\nP.S. - I can also call you at ${data.phone} if that's easier.` : ''}${data.website ? `\nP.P.S. - Took a look at ${data.website} - nice setup!` : ''}`
  }),

  // Warm outreach for medium-score prospects
  coldMedium: (data: ProspectData) => ({
    subject: `Quick question for ${data.businessName}`,
    body: `Hi,

Quick question: How are you currently managing your incoming leads?

I ask because I work with ${data.category || 'businesses'} like ${data.businessName}, and I keep hearing the same challenges:
• "We're too slow to respond"
• "Leads slip through the cracks"
• "We waste time on bad leads"
• "We don't know what's working"

If any of that resonates, I might be able to help.

**What I Do:**
I help businesses set up intelligent lead management with EMOR OS. It's basically an AI-powered system that:
- Captures every inquiry automatically
- Scores each one so you know who to call first
- Suggests responses based on the lead quality
- Tracks everything end-to-end

**Your Situation:**
Based on ${data.businessName}'s profile${data.city ? ` in ${data.city}` : ''}, I calculated an automation score of ${data.automationScore}/100. That suggests you could benefit from better lead organization.

${data.automationScore >= 50 ? 'Want to see how it would work for your specific setup? I can show you in 10 minutes.' : 'Not sure if it\'s a fit, but happy to show you what\'s possible in 10 minutes.'}

No commitment, just a quick look.

Interested?

[Your Name]
EMOR OS
${data.phone ? `\nPhone: ${data.phone}` : ''}${data.website ? `\n\n(Nice website by the way - ${data.website})` : ''}`
  }),

  // Follow-up for prospects who didn't respond
  followUp: (data: ProspectData) => ({
    subject: `Following up - ${data.businessName}`,
    body: `Hi,

I reached out last week about lead management for ${data.businessName}${data.city ? ` in ${data.city}` : ''}.

Not sure if you saw it, but I wanted to follow up quickly.

**The short version:**
Most ${data.category || 'businesses'} lose 30-40% of leads due to poor organization and slow response times. EMOR OS fixes that with intelligent automation.

**One stat that matters:**
Our clients typically see 2-3x more conversions within 60 days, just from:
→ Responding faster (minutes vs hours/days)
→ Prioritizing the right leads
→ Never missing a follow-up

With your automation score of ${data.automationScore}/100, I think there's real opportunity here.

**Simple ask:**
10-minute screen share where I show you exactly how it would work for ${data.businessName}. No pitch, just showing you what's possible.

Available this week?

Best,
[Your Name]
EMOR OS

P.S. - If this isn't the right time, just let me know and I won't bug you again!`
  }),

  // Value-first approach
  valueBased: (data: ProspectData) => ({
    subject: `Free lead audit for ${data.businessName}`,
    body: `Hi there,

I'm doing something a bit different - offering free lead audits to ${data.category || 'businesses'} in ${data.city || 'your area'}.

**What I'll do (free):**
1. Analyze your current lead sources
2. Identify where leads are being lost
3. Calculate your potential revenue recovery
4. Show you what's possible with better automation

**Why free?**
I'm building case studies for EMOR OS (lead intelligence platform), and ${data.businessName} would be a perfect fit based on your automation score of ${data.automationScore}/100.

${data.automationScore >= 60 ? `With a score that high, I'm confident we can show you some significant opportunities.` : `Even with room for improvement in your score, there's usually 30-40% more revenue just sitting in better organization.`}

**What you get:**
• Clear analysis of your current lead flow
• Specific recommendations (whether you use us or not)
• Calculator showing potential ROI
• No obligation whatsoever

**Time investment:**
About 20 minutes total - quick call or screen share.

Interested?

[Your Name]
Lead Intelligence Specialist
EMOR OS

${data.website ? `P.S. - Checked out ${data.website}. ${websiteCompliment()}` : ''}${data.phone ? `\nP.P.S. - Can call you at ${data.phone} if that's easier.` : ''}`
  }),
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function getSuggestedTimes(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const days = ['Tuesday', 'Wednesday', 'Thursday'];
  const times = ['10am', '2pm', '3pm'];
  
  return `${days[Math.floor(Math.random() * days.length)]} at ${times[Math.floor(Math.random() * times.length)]}`;
}

function websiteCompliment(): string {
  const compliments = [
    'Clean design!',
    'Nice setup.',
    'Professional look.',
    'Great user experience.',
    'Really well done.',
  ];
  return compliments[Math.floor(Math.random() * compliments.length)];
}

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE SELECTOR
// ═══════════════════════════════════════════════════════════════════

export type TemplateType = 
  | 'inquiry_professional'
  | 'inquiry_friendly' 
  | 'inquiry_consultative'
  | 'inquiry_service_specific'
  | 'prospect_cold_high'
  | 'prospect_cold_medium'
  | 'prospect_follow_up'
  | 'prospect_value_based';

export function generateEmailFromTemplate(
  templateType: TemplateType,
  data: InquiryData | ProspectData
): { subject: string; body: string } {
  switch (templateType) {
    // Inquiry templates
    case 'inquiry_professional':
      return inquiryTemplates.professional(data as InquiryData);
    case 'inquiry_friendly':
      return inquiryTemplates.friendly(data as InquiryData);
    case 'inquiry_consultative':
      return inquiryTemplates.consultative(data as InquiryData);
    case 'inquiry_service_specific':
      return inquiryTemplates.serviceSpecific(data as InquiryData);
    
    // Prospect templates
    case 'prospect_cold_high':
      return prospectTemplates.coldHigh(data as ProspectData);
    case 'prospect_cold_medium':
      return prospectTemplates.coldMedium(data as ProspectData);
    case 'prospect_follow_up':
      return prospectTemplates.followUp(data as ProspectData);
    case 'prospect_value_based':
      return prospectTemplates.valueBased(data as ProspectData);
    
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SMART TEMPLATE SELECTION
// ═══════════════════════════════════════════════════════════════════

export function suggestTemplate(
  itemType: 'inquiry' | 'prospect',
  data: InquiryData | ProspectData
): TemplateType {
  if (itemType === 'inquiry') {
    const inquiryData = data as InquiryData;
    
    // If they have detailed message, use consultative
    if (inquiryData.message && inquiryData.message.length > 200) {
      return 'inquiry_consultative';
    }
    
    // If they mentioned specific services, use service-specific
    if (inquiryData.services || inquiryData.interest) {
      return 'inquiry_service_specific';
    }
    
    // Default to professional
    return 'inquiry_professional';
  } else {
    const prospectData = data as ProspectData;
    
    // High-score prospects get high-touch approach
    if (prospectData.automationScore >= 70) {
      return 'prospect_cold_high';
    }
    
    // Medium score gets softer approach
    if (prospectData.automationScore >= 50) {
      return 'prospect_cold_medium';
    }
    
    // Lower score gets value-based approach
    return 'prospect_value_based';
  }
}
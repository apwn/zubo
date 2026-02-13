export interface WorkflowRecipe {
  id: string;
  name: string;
  description: string;
  category: "productivity" | "communication" | "development" | "monitoring";
  icon: string;
  schedule: string; // cron expression
  scheduleHuman: string; // human-readable
  task: string; // the prompt sent to the agent
  requires?: string[]; // optional: integration names needed
}

export const WORKFLOW_RECIPES: WorkflowRecipe[] = [
  {
    id: "morning-briefing",
    name: "Morning Briefing",
    description: "Get a daily summary of your calendar, emails, and pending tasks every morning.",
    category: "productivity",
    icon: "☀️",
    schedule: "0 9 * * 1-5",
    scheduleHuman: "Weekdays at 9:00am",
    task: "Generate a morning briefing. Check my calendar for today's events, summarize any new unread emails, and list any pending or urgent tasks. Format it as a concise digest with sections: 📅 Today's Calendar, 📧 Email Summary, ✅ Tasks.",
  },
  {
    id: "email-triage",
    name: "Email Triage",
    description: "Automatically categorize and summarize incoming emails every few hours.",
    category: "communication",
    icon: "📧",
    schedule: "0 */3 * * *",
    scheduleHuman: "Every 3 hours",
    task: "Check my recent emails from the last 3 hours. Categorize them as: 🔴 Urgent (needs reply today), 🟡 Important (needs reply this week), 🟢 FYI (no action needed), 🗑️ Skip (newsletters, spam). Give a one-line summary for each email.",
    requires: ["gmail"],
  },
  {
    id: "weekly-report",
    name: "Weekly Report",
    description: "Generate a weekly summary of activity, tasks completed, and key metrics.",
    category: "productivity",
    icon: "📊",
    schedule: "0 17 * * 5",
    scheduleHuman: "Fridays at 5:00pm",
    task: "Generate a weekly report summarizing this week's activity. Include: conversations held, tools used, tasks completed via cron jobs, and any notable events. Format as a clean report with sections and bullet points.",
  },
  {
    id: "github-digest",
    name: "GitHub Digest",
    description: "Daily summary of new issues, PRs, and activity across your repositories.",
    category: "development",
    icon: "🐙",
    schedule: "0 10 * * 1-5",
    scheduleHuman: "Weekdays at 10:00am",
    task: "Check my GitHub repositories for activity in the last 24 hours. Summarize new issues, pull requests, and any PRs that need my review. Format as: 🔔 Needs Review, 🆕 New Issues, 📝 New PRs.",
    requires: ["github"],
  },
  {
    id: "standup-prep",
    name: "Standup Prep",
    description: "Prepare your daily standup notes based on recent activity.",
    category: "development",
    icon: "🎯",
    schedule: "0 8 * * 1-5",
    scheduleHuman: "Weekdays at 8:00am",
    task: "Help me prepare for my daily standup. Based on my recent conversations and any tools used yesterday, draft standup notes in the format: ✅ What I did yesterday, 🔜 What I'm doing today, 🚧 Any blockers.",
  },
  {
    id: "system-health",
    name: "System Health Check",
    description: "Monitor Zubo's health — database size, memory usage, error rates.",
    category: "monitoring",
    icon: "🏥",
    schedule: "0 8 * * *",
    scheduleHuman: "Daily at 8:00am",
    task: "Run a system health check using the diagnose tool. Report on: database size, memory count, recent errors, cron job status, and any issues. Flag anything that needs attention.",
  },
  {
    id: "calendar-reminder",
    name: "Calendar Reminder",
    description: "Get notified about upcoming meetings 15 minutes before they start.",
    category: "productivity",
    icon: "📅",
    schedule: "*/15 * * * *",
    scheduleHuman: "Every 15 minutes",
    task: "Check my Google Calendar for any events starting in the next 15 minutes. If there are any, send me a brief reminder with the event name, time, and meeting link if available.",
    requires: ["google_calendar"],
  },
  {
    id: "news-digest",
    name: "News & Trends Digest",
    description: "Daily briefing of top news and trends relevant to your interests.",
    category: "productivity",
    icon: "📰",
    schedule: "0 7 * * *",
    scheduleHuman: "Daily at 7:00am",
    task: "Search the web for today's top technology and AI news. Summarize the 5 most important stories in 1-2 sentences each. Focus on: AI developments, major tech announcements, and cybersecurity news.",
  },
];

export function getRecipeById(id: string): WorkflowRecipe | undefined {
  return WORKFLOW_RECIPES.find(r => r.id === id);
}

export function getRecipesByCategory(): Record<string, WorkflowRecipe[]> {
  const result: Record<string, WorkflowRecipe[]> = {};
  for (const recipe of WORKFLOW_RECIPES) {
    if (!result[recipe.category]) result[recipe.category] = [];
    result[recipe.category].push(recipe);
  }
  return result;
}

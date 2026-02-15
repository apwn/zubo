export interface ParsedSchedule {
  cron: string;
  once: boolean;
}

/**
 * Parse natural language schedule descriptions into cron expressions.
 * Returns a standard 5-field cron expression (minute hour day month weekday).
 * Throws if the input can't be parsed.
 *
 * Also supports one-shot delayed schedules like "in 30 minutes", "in 2 hours".
 * These return a cron expression targeting the exact future time, with once=true.
 */
export function parseNaturalSchedule(input: string): string | ParsedSchedule {
  const text = input.toLowerCase().trim();

  // --- One-shot "in X minutes/hours" patterns ---
  const inMinMatch = text.match(/^in\s+(\d+)\s*min(?:ute)?s?$/i);
  if (inMinMatch) {
    const mins = parseInt(inMinMatch[1], 10);
    if (mins < 1 || mins > 1440) throw new Error("Delay must be between 1 minute and 24 hours");
    return makeOnceCron(mins);
  }

  const inHourMatch = text.match(/^in\s+(\d+)\s*hours?$/i);
  if (inHourMatch) {
    const hrs = parseInt(inHourMatch[1], 10);
    if (hrs < 1 || hrs > 24) throw new Error("Delay must be between 1 and 24 hours");
    return makeOnceCron(hrs * 60);
  }

  // "in X hours and Y minutes" or "in Xh Ym"
  const inHourMinMatch = text.match(/^in\s+(\d+)\s*(?:hours?|h)\s*(?:and\s*)?(\d+)\s*(?:min(?:ute)?s?|m)$/i);
  if (inHourMinMatch) {
    const totalMins = parseInt(inHourMinMatch[1], 10) * 60 + parseInt(inHourMinMatch[2], 10);
    if (totalMins < 1 || totalMins > 1440) throw new Error("Delay must be between 1 minute and 24 hours");
    return makeOnceCron(totalMins);
  }

  // "in half an hour" / "in 30min" style aliases
  if (/^in\s+(?:half\s+an?\s+hour|30\s*min)$/i.test(text)) {
    return makeOnceCron(30);
  }

  if (/^in\s+an?\s+hour$/i.test(text)) {
    return makeOnceCron(60);
  }

  // Direct cron expression passthrough — only accept standard 5-field cron
  if (/^[\d*\/,\-]+(\s+[\d*\/,\-]+){4}$/.test(text)) return text;

  // Time parsing helper
  function parseTime(s: string): { hour: number; minute: number } | null {
    // "9am", "9:30am", "9:30 am", "14:00", "2pm", "noon", "midnight"
    if (/noon/i.test(s)) return { hour: 12, minute: 0 };
    if (/midnight/i.test(s)) return { hour: 0, minute: 0 };

    const match = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3]?.toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  // Day of week mapping
  const dayMap: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  // Extract time from the text
  function findTime(): { hour: number; minute: number } {
    // Look for "at <time>" pattern
    const atMatch = text.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (atMatch) {
      const t = parseTime(atMatch[1]);
      if (t) return t;
    }
    // Look for standalone time
    const timeMatch = text.match(/(\d{1,2}(?::\d{2})\s*(?:am|pm)?)/i) || text.match(/(\d{1,2}\s*(?:am|pm))/i);
    if (timeMatch) {
      const t = parseTime(timeMatch[1]);
      if (t) return t;
    }
    // "noon", "midnight"
    if (/noon/.test(text)) return { hour: 12, minute: 0 };
    if (/midnight/.test(text)) return { hour: 0, minute: 0 };
    // "morning" = 9am, "evening" = 6pm, "night" = 9pm
    if (/\bmorning\b/.test(text)) return { hour: 9, minute: 0 };
    if (/\bevening\b/.test(text)) return { hour: 18, minute: 0 };
    if (/\bnight\b/.test(text)) return { hour: 21, minute: 0 };
    // Default to 9am
    return { hour: 9, minute: 0 };
  }

  // --- Pattern matching ---

  // "every X minutes/hours"
  const everyMinMatch = text.match(/every\s+(\d+)\s*min(?:ute)?s?/i);
  if (everyMinMatch) {
    const mins = parseInt(everyMinMatch[1], 10);
    if (mins < 1 || mins > 59) throw new Error("Interval must be between 1-59 minutes");
    return `*/${mins} * * * *`;
  }

  const everyHourMatch = text.match(/every\s+(\d+)\s*hours?/i);
  if (everyHourMatch) {
    const hrs = parseInt(everyHourMatch[1], 10);
    if (hrs < 1 || hrs > 23) throw new Error("Interval must be between 1-23 hours");
    return `0 */${hrs} * * *`;
  }

  // "every hour"
  if (/every\s+hour\b/i.test(text)) return "0 * * * *";

  // "every day at <time>" or "daily at <time>"
  if (/(?:every\s+day|daily)\b/i.test(text)) {
    const t = findTime();
    return `${t.minute} ${t.hour} * * *`;
  }

  // "every weekday at <time>" or "weekdays at <time>"
  if (/(?:every\s+)?weekday/i.test(text)) {
    const t = findTime();
    return `${t.minute} ${t.hour} * * 1-5`;
  }

  // "every weekend at <time>"
  if (/(?:every\s+)?weekend/i.test(text)) {
    const t = findTime();
    return `${t.minute} ${t.hour} * * 0,6`;
  }

  // "every monday at <time>", "every mon, wed, fri at <time>"
  // Extract everything between "every" and "at" (or end) to find day names
  const everyDayMatch = text.match(/every\s+(.+?)(?:\s+at\s+|$)/i);
  if (everyDayMatch) {
    const dayStr = everyDayMatch[1].toLowerCase();
    const days: number[] = [];
    for (const [name, num] of Object.entries(dayMap)) {
      const wordPattern = new RegExp(`\\b${name}\\b`);
      if (wordPattern.test(dayStr)) {
        if (!days.includes(num)) days.push(num);
      }
    }
    if (days.length > 0) {
      const t = findTime();
      return `${t.minute} ${t.hour} * * ${days.sort().join(",")}`;
    }
  }

  // "<weekday> at <time>" — single day with explicit "at" keyword
  for (const [name, num] of Object.entries(dayMap)) {
    const wordPattern = new RegExp(`\\b${name}\\b`);
    if (wordPattern.test(text) && /\bat\b/.test(text)) {
      const t = findTime();
      return `${t.minute} ${t.hour} * * ${num}`;
    }
  }

  // "every month on the <nth> at <time>" or "monthly on <nth>"
  const monthlyMatch = text.match(/(?:every\s+month|monthly)\s+(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/i);
  if (monthlyMatch) {
    const day = parseInt(monthlyMatch[1], 10);
    if (day < 1 || day > 31) throw new Error("Day must be between 1-31");
    const t = findTime();
    return `${t.minute} ${t.hour} ${day} * *`;
  }

  // "twice a day" -> 9am and 5pm
  if (/twice\s+a\s+day/i.test(text)) return "0 9,17 * * *";

  // "every morning" -> 9am daily
  if (/every\s+morning/i.test(text)) return "0 9 * * *";

  // "every evening" -> 6pm daily
  if (/every\s+evening/i.test(text)) return "0 18 * * *";

  // "every night" -> 9pm daily
  if (/every\s+night/i.test(text)) return "0 21 * * *";

  // Fallback: if there's just a time, assume daily
  const t = findTime();
  if (text.includes("at") || /\d{1,2}\s*(?:am|pm)/i.test(text)) {
    return `${t.minute} ${t.hour} * * *`;
  }

  throw new Error(
    `Could not parse schedule: "${input}". Try formats like "every day at 9am", "every weekday at 8:30am", "every monday and friday at noon", "every 30 minutes", or "in 30 minutes".`
  );
}

/**
 * Create a one-shot schedule that fires once at now + delayMinutes.
 * Uses an ISO 8601 date string which croner handles natively for one-time firing.
 */
function makeOnceCron(delayMinutes: number): ParsedSchedule {
  const target = new Date(Date.now() + delayMinutes * 60_000);
  // Use ISO 8601 string — croner fires exactly once at this time
  return {
    cron: target.toISOString(),
    once: true,
  };
}

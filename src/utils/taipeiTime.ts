/**
 * Clock in Taiwan time. Every schedule is published in Asia/Taipei local time, so the
 * device's own timezone (a traveller's phone, a laptop set to UTC) must not leak in.
 */

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Taipei',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const ISO_WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export interface TaipeiClock {
  /** Minutes since midnight in Taiwan. */
  minutes: number;
  /** ISO weekday in Taiwan, Mon=1 .. Sun=7. */
  weekday: number;
}

export function taipeiClock(now: Date = new Date()): TaipeiClock {
  const parts = Object.fromEntries(PARTS.formatToParts(now).map(p => [p.type, p.value]));
  return {
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: ISO_WEEKDAY[parts.weekday ?? ''] ?? 0,
  };
}

/** ISO weekday (Mon=1 .. Sun=7) in Taiwan. */
export function taipeiIsoWeekday(now: Date = new Date()): number {
  return taipeiClock(now).weekday;
}

/** "週一" .. "週日" */
export function weekdayLabel(isoWeekday: number): string {
  return `週${'一二三四五六日'[isoWeekday - 1] ?? '?'}`;
}

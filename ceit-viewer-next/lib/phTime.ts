/**
 * Philippine timezone helpers.
 *
 * Browsers and kiosk devices may be configured to any timezone, but the calendar
 * MUST always reflect Asia/Manila (UTC+08:00) because that's the canonical clock
 * for CvSU events. These helpers normalize "today" / "now" to PH local calendar
 * regardless of the host machine's timezone.
 */

export const PH_TZ = 'Asia/Manila';

/** Y/M/D values in Asia/Manila for the given moment (defaults to now). `month` is 0-based. */
export function phYMD(date: Date = new Date()): { year: number; month: number; day: number } {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: PH_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);
	return {
		year: Number(parts.find((p) => p.type === 'year')?.value ?? new Date().getFullYear()),
		month: Number(parts.find((p) => p.type === 'month')?.value ?? 1) - 1,
		day: Number(parts.find((p) => p.type === 'day')?.value ?? 1),
	};
}

/**
 * A Date whose LOCAL Y/M/D equals PH Y/M/D (time = 00:00 local). Use this when
 * building calendar grids or comparing day-of-week — `getMonth()`, `getDate()`,
 * `getDay()` and `toDateString()` will all reflect PH calendar values.
 */
export function phToday(): Date {
	const { year, month, day } = phYMD();
	return new Date(year, month, day);
}

/** Stable PH calendar key like `2026-05-28` for the given moment. */
export function phDateKey(date: Date = new Date()): string {
	const { year, month, day } = phYMD(date);
	return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Formatted PH wall-clock time string, e.g. `2:14:09 PM`. */
export function phTimeString(date: Date = new Date(), opts?: Intl.DateTimeFormatOptions): string {
	return date.toLocaleTimeString('en-US', {
		timeZone: PH_TZ,
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
		hour12: true,
		...opts,
	});
}

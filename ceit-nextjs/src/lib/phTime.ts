/**
 * Philippine timezone helpers (admin dashboard side).
 * See `ceit-viewer-next/lib/phTime.ts` for the public-viewer twin.
 */

export const PH_TZ = 'Asia/Manila';

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

export function phToday(): Date {
	const { year, month, day } = phYMD();
	return new Date(year, month, day);
}

export function phDateKey(date: Date = new Date()): string {
	const { year, month, day } = phYMD(date);
	return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

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

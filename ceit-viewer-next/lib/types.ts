/**
 * Shared domain types for ceit-viewer-next.
 * Import from here instead of duplicating in each page file.
 */

export type Post = {
  id: string;
  caption: string;
  body?: string;
  imageUrl?: string;
  createdAt: string;
  adminName?: string;
  departmentName?: string;
  /** Present only on viewer page responses */
  departmentId?: string;
};

export type CalendarEvent = {
  id: string;
  eventDate: string;
  endDate?: string | null;
  title?: string;
  description?: string;
  location?: string;
  eventLink?: string | null;
  /** Kiosk-only field — event cover image */
  eventImageUrl?: string | null;
  departmentName?: string;
  adminName?: string;
  isAnnouncement?: boolean;
};

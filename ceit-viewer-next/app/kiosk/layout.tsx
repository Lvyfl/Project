import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kiosk Display | CvSU CEIT',
  description: 'TV/kiosk display board for CvSU CEIT announcements and events.',
  // Prevent search engines from indexing the kiosk page
  robots: { index: false, follow: false },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

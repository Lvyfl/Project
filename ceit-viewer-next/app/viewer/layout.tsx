import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bulletin Board | CvSU CEIT',
  description:
    'Latest announcements and updates from the CvSU College of Engineering and Information Technology.',
  openGraph: {
    title: 'CvSU CEIT Bulletin Board',
    description: 'Latest announcements from CvSU CEIT.',
    type: 'website',
  },
};

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Events | CvSU CEIT',
  description:
    'Upcoming events and schedule for the CvSU College of Engineering and Information Technology.',
  openGraph: {
    title: 'CvSU CEIT Events',
    description: 'Upcoming events from CvSU CEIT.',
    type: 'website',
  },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

# CEIT Viewer (Next.js)

`ceit-viewer-next` is now fully App Router-based Next.js viewer frontend.

## Routes

- `/` → redirects to `/viewer`
- `/viewer` → main public announcements + calendar viewer
- `/events` → dedicated events/calendar-focused page
- `/pdf/[id]` → PDF preview page

Legacy compatibility routes are also supported:

- `/viewer.html` → redirects to `/viewer`
- `/events.html` → redirects to `/events`

## Environment

Set backend URL (optional; defaults to localhost backend):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/viewer`.

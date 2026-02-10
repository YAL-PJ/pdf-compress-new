import { LandingPage } from '@/components/landing/LandingPage';
import { AppShell } from '@/components/AppShell';

// This is now a Server Component
// The initial HTML will be fully rendered on the server (SSR/SSG).
// AppShell (Client Component) wraps it to handle the dynamic state switch to the App view.

export default function Home() {
  return (
    <AppShell>
      <LandingPage />
    </AppShell>
  );
}

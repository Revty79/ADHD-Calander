import { Href, Link, Slot, usePathname } from "expo-router";

const navigationItems: { href: Href; label: string }[] = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" },
  { href: "/recovery", label: "Recovery" },
  { href: "/recap", label: "Recap" },
  { href: "/guide", label: "Guide" },
  { href: "/settings", label: "Settings" }
];

export default function WebTabLayout() {
  const pathname = usePathname();

  return (
    <div className="web-app-shell">
      <aside className="web-sidebar">
        <div className="web-brand">
          <span className="web-brand-kicker">Local planning</span>
          <span className="web-brand-name">ADHD Calendar</span>
        </div>
        <Navigation pathname={pathname} />
        <RecoveryShortcut />
        <p className="web-sidebar-note">Your calendar stays on this browser.</p>
      </aside>

      <div className="web-mobile-shell-header">
        <div className="web-mobile-brand">ADHD Calendar</div>
        <Navigation pathname={pathname} />
        <RecoveryShortcut compact />
      </div>

      <main className="web-main-content">
        <Slot />
      </main>
    </div>
  );
}

function RecoveryShortcut({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      aria-label="Plans changed? Review what to keep, move, or let go"
      className={`web-recovery-shortcut${compact ? " web-recovery-shortcut-compact" : ""}`}
      href="/recovery/start"
    >
      <strong>Plans changed?</strong>
      {!compact ? <small>Review what to keep, move, or let go.</small> : null}
    </Link>
  );
}

function Navigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary navigation" className="web-navigation">
      {navigationItems.map((item) => {
        const href = String(item.href);
        const isCurrent = pathname === href;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className="web-nav-link"
            href={item.href}
            key={href}
          >
            <span>{item.label}</span>
            {isCurrent ? <span className="web-current-label">Current</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

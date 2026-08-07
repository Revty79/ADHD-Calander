import { Href, Link, Slot, usePathname } from "expo-router";

const navigationItems: { href: Href; label: string }[] = [
  { href: "/", label: "Today" },
  { href: "/tasks", label: "Tasks" },
  { href: "/recovery", label: "Recovery" },
  { href: "/recap", label: "Recap" },
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
        <p className="web-sidebar-note">Your tasks stay on this browser.</p>
      </aside>

      <div className="web-mobile-shell-header">
        <div className="web-mobile-brand">ADHD Calendar</div>
        <Navigation pathname={pathname} />
      </div>

      <main className="web-main-content">
        <Slot />
      </main>
    </div>
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

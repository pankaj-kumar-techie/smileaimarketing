"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  IconGrid,
  IconStorefront,
  IconTarget,
  IconChat,
  IconCalendarCheck,
  IconTrendingUp,
  IconSettings,
  IconLogout,
  IconMenuDots,
  IconSearch,
  IconCheck,
  IconChevronDown,
  IconMonitor,
} from "@/components/icons";

const PRIMARY_NAV_ITEMS = [
  { label: "Overview", path: "/admin", Icon: IconGrid },
  { label: "Campaigns", path: "/admin/campaigns", Icon: IconTarget },
  { label: "Leads", path: "/admin/businesses", Icon: IconStorefront },
  { label: "Outreach", path: "/admin/outreach", Icon: IconChat, xlOnly: true },
  { label: "Meetings", path: "/admin/meetings", Icon: IconCalendarCheck },
];

const MORE_NAV_ITEMS = [
  { label: "Outreach", path: "/admin/outreach", Icon: IconChat, mdOnly: true },
  { label: "Audits", path: "/admin/audits", Icon: IconTarget },
  { label: "Pipeline", path: "/admin/pipeline", Icon: IconTrendingUp },
  { label: "Analytics", path: "/admin/analytics", Icon: IconMonitor },
  { label: "Integrations", path: "/admin/integrations", Icon: IconCheck },
  { label: "Automations", path: "/admin/automations", Icon: IconSettings },
  { label: "Settings", path: "/admin/settings", Icon: IconSettings },
];

const MOBILE_NAV_ITEMS = [
  { label: "Overview", path: "/admin", Icon: IconGrid },
  { label: "Campaigns", path: "/admin/campaigns", Icon: IconTarget },
  { label: "Leads", path: "/admin/businesses", Icon: IconStorefront },
  { label: "Outreach", path: "/admin/outreach", Icon: IconChat },
];

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/campaigns": "Campaigns",
  "/admin/businesses": "Leads",
  "/admin/audits": "Audits",
  "/admin/outreach": "Outreach",
  "/admin/meetings": "Meetings",
  "/admin/appointments": "Meetings",
  "/admin/pipeline": "Pipeline",
  "/admin/analytics": "Analytics",
  "/admin/integrations": "Integrations",
  "/admin/automations": "Automations",
  "/admin/settings": "Settings",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMoreOpen(false);
        setSearchModalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    setSearchModalOpen(false);
    router.push(q ? `/admin/businesses?q=${encodeURIComponent(q)}` : "/admin/businesses");
  };

  // Contextual action rule: Show campaign action ONLY on Overview, Campaigns list, and Campaign Detail pages
  const isOverview = pathname === "/admin";
  const isCampaignRoute = pathname.startsWith("/admin/campaigns");
  const showCampaignAction = isOverview || isCampaignRoute;

  const isMoreRouteActive = MORE_NAV_ITEMS.some(
    (item) => pathname === item.path || (pathname.startsWith("/admin/businesses/") && item.path === "/admin/businesses")
  );

  const pageTitle = PAGE_TITLES[pathname] || "Command Centre";

  return (
    <div className="theme-navy min-h-screen bg-background font-body text-foreground">
      {/* Desktop Top Header */}
      <header className="sticky top-0 z-40 hidden border-b border-border bg-surface/95 backdrop-blur-md lg:block">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
          
          {/* ZONE 1: LEFT (Logo) */}
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/admin" className="text-base font-extrabold tracking-tight text-foreground transition-opacity hover:opacity-90">
              Smile AI<span className="text-primary">.</span>
            </Link>
          </div>

          {/* ZONE 2: CENTER (Primary Navigation + More Dropdown) */}
          <nav aria-label="Admin primary desktop" className="flex min-w-0 items-center gap-1 xl:gap-2">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.path ||
                (item.path === "/admin/businesses" && pathname.startsWith("/admin/businesses")) ||
                (item.path === "/admin/meetings" && pathname === "/admin/appointments");

              const visibilityClass = item.xlOnly ? "hidden xl:flex" : "flex";

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`${visibilityClass} items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <item.Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Accessible "More" Dropdown */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                aria-label="More navigation items"
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isMoreRouteActive || moreOpen
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <span>More</span>
                <IconChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
              </button>

              {moreOpen && (
                <div className="animate-fade-in-down absolute left-0 top-10 z-50 w-48 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                  {MORE_NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.path;
                    const visibilityClass = item.mdOnly ? "flex xl:hidden" : "flex";

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setMoreOpen(false)}
                        className={`${visibilityClass} min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                        }`}
                      >
                        <item.Icon className="h-4 w-4 text-primary shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* ZONE 3: RIGHT (Search Icon + Contextual Action + User Menu) */}
          <div className="flex shrink-0 items-center gap-2.5">
            {/* Search Icon Button */}
            <button
              onClick={() => setSearchModalOpen(true)}
              aria-label="Search practices"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <IconSearch className="h-4 w-4" />
            </button>

            {/* Contextual Campaign Action */}
            {showCampaignAction && (
              <Link
                href="/admin/campaigns"
                className="inline-flex h-9 items-center rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <span className="hidden xl:inline">+ New Campaign</span>
                <span className="inline xl:hidden">+ New</span>
              </Link>
            )}

            {/* User Avatar Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="Account menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary transition-colors hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                A
              </button>

              {userMenuOpen && (
                <div className="animate-fade-in-down absolute right-0 top-11 z-50 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                  <p className="truncate px-3 py-2 text-metadata text-muted-foreground">
                    hello@smileaimarketing.com
                  </p>
                  <div className="my-1 border-t border-border" />
                  <Link
                    href="/admin/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-xs font-semibold text-foreground hover:bg-surface-muted"
                  >
                    <IconSettings className="h-4 w-4 text-muted-foreground" /> Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-xs font-semibold text-danger hover:bg-danger/10"
                  >
                    <IconLogout className="h-4 w-4" /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Compact Search Dialog / Popover */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 backdrop-blur-xs px-4"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            className="animate-fade-in-down w-full max-w-md space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-body-small font-bold text-foreground">Search Practices</h2>
              <button
                onClick={() => setSearchModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
                aria-label="Close search"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="search"
                autoFocus
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search by practice name, city, or domain..."
                aria-label="Search practices"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary-hover"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-body font-bold text-foreground">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          {showCampaignAction && (
            <Link
              href="/admin/campaigns"
              className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-metadata font-bold text-primary-foreground"
            >
              + New
            </Link>
          )}
          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground"
          >
            <IconLogout className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1400px] px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Admin primary mobile"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || (item.path === "/admin/businesses" && pathname.startsWith("/admin/businesses"));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
              moreOpen || MORE_NAV_ITEMS.some((i) => i.path === pathname) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <IconMenuDots className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Bottom Sheet */}
      {moreOpen && (
        <>
          <button
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
          <div className="pb-safe animate-fade-in-up fixed inset-x-0 bottom-16 z-50 rounded-t-2xl border-t border-border bg-surface p-4 shadow-xl lg:hidden">
            <div className="space-y-1">
              {MORE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-body-small font-semibold text-foreground hover:bg-surface-muted"
                >
                  <item.Icon className="h-5 w-5 text-primary" />
                  <span>{item.label}</span>
                </Link>
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleLogout();
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-body-small font-semibold text-danger hover:bg-danger/10"
              >
                <IconLogout className="h-5 w-5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

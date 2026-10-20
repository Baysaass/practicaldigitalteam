"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { useTheme } from "next-themes";
import { Award, LayoutDashboard, Moon, RefreshCw, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncNow } from "@/app/actions";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/evaluation", label: "Гүйцэтгэлийн үнэлгээ", icon: Award },
] as const;

/** Sidebar on desktop, a tab row on phones (ERPNext desk layout). */
export function Nav({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname();
  return (
    <nav className={cn(mobile ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-0.5")}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-8 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-sm transition-colors",
              active ? "border bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Өнгөний горим" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}

export function SyncButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
      {pending ? "Татаж байна…" : "Jira-аас татах"}
    </Button>
  );
}

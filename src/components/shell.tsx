"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Award, LayoutDashboard, Lock, Menu, Moon, RefreshCw, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { syncNow } from "@/app/actions";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/evaluation", label: "Гүйцэтгэлийн үнэлгээ", icon: Award },
  { href: "/zaki", label: "Удирдлага (PIN)", icon: Lock },
] as const;

/** Sidebar on desktop, a tab row on phones (ERPNext desk layout). */
export function Nav({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  return (
    <nav className={cn(mobile ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-0.5")}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex h-9 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-sm transition-colors",
              active ? "border bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavSheet() {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Цэс нээх"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center gap-2.5">
              <div className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                IT
              </div>
              <SheetTitle className="text-base font-semibold">
                Гүйцэтгэлийн самбар
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              IT хэлтсийн ажлын хяналт, үнэлгээ
            </SheetDescription>
          </SheetHeader>
          <div className="p-3">
            <div className="px-2.5 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Үнэлгээний цэс
            </div>
            <Nav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Өнгөний горим"
      icon={
        <>
          <Sun className="hidden size-4 dark:block" />
          <Moon className="size-4 dark:hidden" />
        </>
      }
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    />
  );
}

export function SyncButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      icon={<RefreshCw className="size-3.5" />}
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      {pending ? "Татаж байна…" : "Jira-аас татах"}
    </Button>
  );
}

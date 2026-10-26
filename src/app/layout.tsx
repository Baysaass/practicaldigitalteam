import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { MobileNavSheet, Nav, SyncButton, ThemeToggle } from "@/components/shell";
import { SyncStatus } from "@/components/sync-status";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Гүйцэтгэлийн самбар",
  description: "IT хэлтсийн ажлын гүйцэтгэлийн хяналт, үнэлгээ",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans text-sm text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            {/* Navbar (ERPNext desk) */}
            <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur md:px-4 print:hidden">
              <MobileNavSheet />
              <div className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">IT</div>
              <span className="hidden font-semibold sm:inline">Гүйцэтгэл</span>
              <div className="flex-1" />
              <Suspense fallback={null}>
                <SyncStatus />
              </Suspense>
              <SyncButton />
              <ThemeToggle />
            </header>
            <div className="flex">
              <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground p-3 md:block print:hidden">
                <div className="px-2.5 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Үнэлгээний цэс</div>
                <Nav />
              </aside>
              <main className="min-w-0 flex-1 px-4 py-5 md:px-8">
                <div className="mb-4 md:hidden print:hidden">
                  <Nav mobile />
                </div>
                {children}
              </main>
            </div>
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SettingsProvider, ThemeToggle } from "@/components/Settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "Openfile — play and learn chess",
  description: "Play chess against an engine in your browser and learn the game step by step.",
};

// Applies the saved theme before first paint so dark mode does not flash white.
const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("openfile-settings")||"{}");var m=s.mode||"system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.dataset.theme=d?"dark":"light";e.dataset.board=s.board||"slate";e.dataset.pieces=s.pieces||"classic";}catch(x){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <SettingsProvider>
          <header className="nav">
            <Link href="/" className="logo">Openfile</Link>
            <nav>
              <Link href="/play">Play</Link>
              <Link href="/learn">Learn</Link>
              <Link href="/puzzles">Puzzles</Link>
              <Link href="/review">Review</Link>
              <Link href="/settings">Settings</Link>
              <ThemeToggle />
            </nav>
          </header>
          <main>{children}</main>
        </SettingsProvider>
      </body>
    </html>
  );
}

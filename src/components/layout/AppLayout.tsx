import type { ReactNode } from "react";
import { TopNav } from "./TopNav";
import type { PageKey } from "./nav";

interface AppLayoutProps {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

/** 应用布局壳：顶部导航 + 内容容器 */
export default function AppLayout({ page, onNavigate, children }: AppLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <TopNav page={page} onNavigate={onNavigate} />
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
      <footer className="relative z-10 pb-8 text-center text-xs text-muted-foreground">
        青序 · 慢慢来，一切都来得及
      </footer>
    </div>
  );
}

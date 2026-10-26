import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Sprout, User, X } from "lucide-react";
import { EMOTIONS } from "@/types";
import type { PageKey } from "./nav";
import { PersonalCenterModal } from "@/components/profile/PersonalCenterModal";

const NAV_ITEMS: { key: PageKey; label: string }[] = [
  { key: "dashboard", label: "工作台" },
  { key: "tasks", label: "任务规划" },
  { key: "mood", label: "心情树洞" },
  { key: "relief", label: "减压" },
];

interface TopNavProps {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
}

/** 顶部导航栏（移动端折叠为汉堡菜单） */
export function TopNav({ page, onNavigate }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const go = (key: PageKey) => {
    onNavigate(key);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/50 bg-white/60 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <Sprout className="h-5 w-5" />
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-base font-semibold tracking-widest">青序</p>
            <p className="text-[10px] text-muted-foreground">
              大学生学业倦怠智能干预
            </p>
          </div>
          <p className="text-base font-semibold tracking-widest sm:hidden">青序</p>
        </div>

        {/* 桌面端导航 */}
        <nav className="hidden items-center gap-1 rounded-2xl bg-white/50 p-1 shadow-xs md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.key === page;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm transition-colors duration-300 ${
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-primary shadow-soft"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* 个人中心入口（桌面端图标） */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="个人中心"
            title="个人中心"
            className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-white/60 text-foreground shadow-xs transition-colors hover:bg-white md:flex"
          >
            <User className="h-5 w-5" />
          </button>

          {/* 情绪色指示点：每种情绪一颗小圆点 */}
          <div
            className="hidden items-center gap-1.5 lg:flex"
            aria-hidden
            title="9 种情绪色"
          >
            {EMOTIONS.map((e) => (
              <span
                key={e.id}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: e.color }}
              />
            ))}
          </div>

          {/* 移动端汉堡按钮 */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 text-foreground shadow-xs transition-colors hover:bg-white md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-white/50 bg-white/80 backdrop-blur-md md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {/* 个人中心（移动端菜单首项） */}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full rounded-xl px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
              >
                个人中心
              </button>
              {NAV_ITEMS.map((item) => {
                const active = item.key === page;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => go(item.key)}
                    className={`w-full rounded-xl px-4 py-3 text-left text-sm transition-colors ${
                      active
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground hover:bg-white hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              {/* 情绪色指示（移动端收纳进菜单底部） */}
              <div className="flex items-center justify-center gap-1.5 px-4 pb-1 pt-3">
                {EMOTIONS.map((e) => (
                  <span
                    key={e.id}
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                ))}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* 个人中心弹窗（新增模块） */}
      <PersonalCenterModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}

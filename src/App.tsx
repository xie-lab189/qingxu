import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/components/layout/AppLayout";
import { WelcomeModal } from "@/components/auth/WelcomeModal";
import { EmotionProvider } from "@/hooks/useEmotionTheme";
import { AgentChatProvider } from "@/hooks/useAgentChat";
import { SchedulerProvider } from "@/hooks/useScheduler";
import { TimerProvider } from "@/hooks/useTimer";
import { getSession } from "@/lib/api";
import { getCurrentUser } from "@/lib/profileService";
import { onEmailPromptRequested } from "@/lib/emailGate";
import { EmailGateModal } from "@/components/email/EmailGateModal";
import { requestNotifyPermission } from "@/lib/notify";
import { startSyncEngine } from "@/lib/sync";
import { MoodBackdrop } from "@/components/mood/MoodBackdrop";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { AgentTriggers } from "@/components/agent/AgentTriggers";
import { AchievementChecker } from "@/components/agent/AchievementChecker";
import { TimerPill } from "@/components/timer/TimerPill";
import DashboardPage from "@/pages/DashboardPage";
import TasksPage from "@/pages/TasksPage";
import MoodPage from "@/pages/MoodPage";
import ReliefPage from "@/pages/ReliefPage";
import type { PageKey } from "@/components/layout/nav";

/** 页面切换动画：淡入上移进入，淡出上移离开 */
function PageTransition({ page }: { page: PageKey }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={page}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      >
        {page === "dashboard" && <DashboardPage />}
        {page === "tasks" && <TasksPage />}
        {page === "mood" && <MoodPage />}
        {page === "relief" && <ReliefPage />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  /** 是否有有效会话；首次打开为 false → 弹出欢迎弹窗 */
  const [authed, setAuthed] = useState<boolean>(() => getSession() !== null);
  /** 邮箱引导弹窗（方案 A：首次进入且无邮箱时引导填写） */
  const [emailGateOpen, setEmailGateOpen] = useState<boolean>(false);

  /* 已登录：启动跨设备同步引擎（远端有更新则水合刷新，本地变更定时推送） */
  useEffect(() => {
    if (authed) {
      startSyncEngine();
      // 页面初始化时请求浏览器通知权限（督促官定时提醒用）
      requestNotifyPermission();
    }
  }, [authed]);

  /* 首次进入且无邮箱 → 引导填写（方案 A）；并订阅「建任务时请求邮箱」事件 */
  useEffect(() => {
    if (!authed) return;
    if (!getCurrentUser()?.qqEmail) setEmailGateOpen(true);
    const off = onEmailPromptRequested(() => setEmailGateOpen(true));
    return off;
  }, [authed]);

  /* 深夜模式（20:00-06:00）：每分钟检查系统时间，切换 html.night 暖暗滤镜 */
  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      document.documentElement.classList.toggle("night", h >= 20 || h < 6);
    };
    apply();
    const iv = window.setInterval(apply, 60_000);
    return () => window.clearInterval(iv);
  }, []);

  return (
    <EmotionProvider>
      <AgentChatProvider>
        {/* 智能调度中枢：每日自动发布任务 + 情绪驱动重排（需在 AgentChat 之内以便播报） */}
        <SchedulerProvider>
          <TimerProvider>
            {/* 情绪主题背景层（固定定位，交叉淡入淡出） */}
            <MoodBackdrop />
            <AppLayout page={page} onNavigate={setPage}>
              <PageTransition page={page} />
            </AppLayout>

            {/* 多智能体：主动触发逻辑 + 悬浮对话面板 */}
            <AgentTriggers />
            <AgentPanel />
            {/* 成就系统：监听并弹出解锁动画 */}
            <AchievementChecker />
            {/* 全局番茄钟胶囊（左下角） */}
            <TimerPill />
            {/* 首次打开：欢迎弹窗（用户名 + 手机号，手机号 = 唯一用户 ID） */}
            <WelcomeModal open={!authed} onComplete={() => setAuthed(true)} />
            {/* 方案 A：引导填写 QQ 邮箱以接收每晚 20:00 邮件提醒 */}
            <EmailGateModal open={emailGateOpen} onClose={() => setEmailGateOpen(false)} />
          </TimerProvider>
        </SchedulerProvider>
      </AgentChatProvider>
    </EmotionProvider>
  );
}

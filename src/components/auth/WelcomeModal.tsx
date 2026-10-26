import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Leaf, Loader2 } from "lucide-react";
import { registerUser, saveSession, getSession } from "@/lib/api";
import { hydrateAfterLogin } from "@/lib/sync";
import { loginWithPhone } from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WelcomeModalProps {
  open: boolean;
  onComplete: () => void;
}

/**
 * 欢迎弹窗：首次打开时温和地询问用户名 + 手机号。
 * 手机号是唯一用户 ID：登录后保存为 Session，下次打开自动识别；
 * 换设备登录同一手机号即可完整同步任务与心情记录。
 */
export function WelcomeModal({ open, onComplete }: WelcomeModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  /** 选填：邮件提醒兜底（督促官每晚 21:00 未打卡时发提醒） */
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneValid = /^1\d{10}$/.test(phone);
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    if (!name.trim()) return setError("给自己起个昵称吧，比如「小青」");
    if (!phoneValid) return setError("请输入 11 位手机号（作为你的唯一记忆标识）");
    if (!emailValid) return setError("邮箱格式看起来不太对，留空也可以哦");
    setError("");
    setLoading(true);
    try {
      const previousPhone = getSession()?.phone ?? null;
      const user = await registerUser(name.trim(), phone, email.trim() || undefined);
      saveSession(user);
      // 换设备：水合该手机号的云端数据后刷新；换号登录：先清本地旧数据防串号
      let needReload = await hydrateAfterLogin(user.phone, previousPhone);
      // 【个人中心】登记/恢复账号档案；换号或本地为空时恢复该手机号的历史数据
      const profile = await loginWithPhone({
        phone,
        name: name.trim(),
        qqEmail: email.trim(),
        previousPhone,
      });
      if (profile.needReload) needReload = true;
      if (needReload) {
        window.location.reload();
        return;
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/25 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="glass-card mx-4 w-full max-w-md p-9"
          >
            <div className="flex flex-col items-center text-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.15 }}
                className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-soft"
              >
                <Leaf className="h-7 w-7" />
              </motion.span>
              <h1 className="mt-4 text-2xl font-semibold tracking-widest text-foreground">
                青序
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                欢迎来到这里。留下你的名字和手机号，
                <br />
                无论换哪台设备，你的任务与心情都会被记住。
              </p>
            </div>

            <div className="mt-7 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wm-name" className="text-xs text-foreground">
                  怎么称呼你
                </Label>
                <Input
                  id="wm-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的昵称"
                  maxLength={12}
                  className="rounded-2xl border-border/70 bg-white/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wm-phone" className="text-xs text-foreground">
                  手机号（唯一记忆标识，不会用于其他用途）
                </Label>
                <Input
                  id="wm-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="11 位手机号"
                  inputMode="numeric"
                  className="rounded-2xl border-border/70 bg-white/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wm-email" className="text-xs text-foreground">
                  邮箱（选填：每晚未打卡时发一封提醒邮件）
                </Label>
                <Input
                  id="wm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-2xl border-border/70 bg-white/80"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-destructive"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="w-full rounded-2xl py-6 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在为你准备空间…
                  </>
                ) : (
                  "进入青序"
                )}
              </Button>
              <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                数据仅与你的手机号绑定存储，用于跨设备同步，不会对外泄露
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

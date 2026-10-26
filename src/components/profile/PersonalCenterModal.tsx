import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Loader2, Mail, Save, Smartphone, User } from "lucide-react";
import {
  ensureProfileForSession,
  getCurrentUser,
  logout,
  saveProfile,
  type ConflictResolution,
} from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PersonalCenterModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 个人中心（新增模块 · 不影响任何现有业务逻辑）
 *
 * - 展示 / 修改：姓名、手机号（核心账号）、QQ 邮箱
 * - 【保存修改】：同号直接更新；换号自动完成「账号迁移」并以新号重新登录
 * - 【退出登录】：清空会话，回到欢迎登录弹窗（本机数据保留，重新登录即恢复）
 */
export function PersonalCenterModal({ open, onClose }: PersonalCenterModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qqEmail, setQqEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);

  // 打开时用当前账号填充（老用户无档案时按现有会话补建）
  useEffect(() => {
    if (!open) return;
    ensureProfileForSession();
    const user = getCurrentUser();
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setQqEmail(user?.qqEmail ?? "");
    setError("");
    setSaved(false);
    setConflict(false);
  }, [open]);

  const phoneValid = /^1\d{10}$/.test(phone);
  const emailValid = !qqEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(qqEmail);
  const phoneChanged = phone.trim() !== (getCurrentUser()?.phone ?? "");

  const handleSave = async () => {
    if (!name.trim()) return setError("姓名不能为空哦");
    if (!phoneValid) return setError("请输入 11 位手机号（作为你的核心账号）");
    if (!emailValid) return setError("邮箱格式看起来不太对，留空也可以");
    setError("");
    setSaving(true);
    try {
      const res = await saveProfile({ name, phone, qqEmail });
      // 换号且新号已有云端数据：弹出三选一，不立即落盘
      if (res.conflict) {
        setConflict(true);
        setSaving(false);
        return;
      }
      setSaved(true);
      // 刷新页面：问候语与各模块读取最新资料（换号时已完成账号迁移与重新登录）
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setError("保存失败，请稍后再试");
      setSaving(false);
    }
  };

  const handleResolveConflict = async (choice: ConflictResolution) => {
    setSaving(true);
    try {
      await saveProfile({ name, phone, qqEmail }, choice);
      setConflict(false);
      setSaved(true);
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setError("保存失败，请稍后再试");
      setSaving(false);
    }
  };

  const handleLogout = () => {
    const ok = window.confirm(
      "退出后将回到登录页。本机数据仍会保留，重新登录同一手机号即可恢复。确定退出吗？"
    );
    if (!ok) return;
    logout(); // 清空会话 + 重载 → 弹出欢迎登录
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
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="glass-card mx-4 w-full max-w-md p-8"
          >
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-soft">
                <User className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-xl font-semibold tracking-widest text-foreground">
                个人中心
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                姓名、手机号与邮箱仅与你的账号绑定
                <br />
                换任何设备登录同一手机号，数据都会回来
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pc-name" className="text-xs text-foreground">
                  姓名
                </Label>
                <Input
                  id="pc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的昵称"
                  maxLength={12}
                  className="rounded-2xl border-border/70 bg-white/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-phone" className="text-xs text-foreground">
                  手机号（核心账号）
                </Label>
                <Input
                  id="pc-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="11 位手机号"
                  inputMode="numeric"
                  className="rounded-2xl border-border/70 bg-white/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-email" className="text-xs text-foreground">
                  QQ 邮箱（选填：接收每晚 8 点的督促官邮件）
                </Label>
                <Input
                  id="pc-email"
                  type="email"
                  value={qqEmail}
                  onChange={(e) => setQqEmail(e.target.value)}
                  placeholder="123456@qq.com"
                  className="rounded-2xl border-border/70 bg-white/80"
                />
              </div>

              {phoneChanged && phoneValid && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl bg-accent/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground"
                >
                  <Smartphone className="mr-1 inline h-3 w-3" />
                  检测到手机号变更：保存后将把该账号的全部数据（任务、树洞、打卡）迁移到新手机号名下，并以新手机号重新登录。
                </motion.p>
              )}

              {qqEmail && emailValid && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  每晚 8 点若有未完成任务，督促官会发邮件到此邮箱
                </p>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-destructive"
                >
                  {error}
                </motion.p>
              )}

              {saved && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-primary"
                >
                  已保存，正在刷新…
                </motion.p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-1 rounded-2xl py-5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 保存中…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> 保存修改
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="rounded-2xl px-5 py-5"
                >
                  取消
                </Button>
              </div>

              <Button
                type="button"
                variant="destructive"
                onClick={handleLogout}
                className="w-full rounded-2xl py-5"
              >
                <LogOut className="mr-2 h-4 w-4" /> 退出登录
              </Button>
            </div>
          </motion.div>

          {conflict && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
                className="glass-card w-full max-w-md p-7"
              >
                <h3 className="text-lg font-semibold tracking-wide text-foreground">
                  新手机号已有数据
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  你正在把账号迁移到{" "}
                  <span className="font-medium text-foreground">{phone}</span>
                  ，但它的云端已经有一份数据。请选择要保留哪一份：
                </p>
                <div className="mt-5 space-y-2.5">
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => handleResolveConflict("keepOld")}
                    className="w-full justify-start rounded-2xl py-4 text-left"
                  >
                    ① 保留当前（旧号）数据，覆盖新号
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => handleResolveConflict("keepNew")}
                    className="w-full justify-start rounded-2xl py-4 text-left"
                  >
                    ② 改用新号已有的数据
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => handleResolveConflict("merge")}
                    className="w-full justify-start rounded-2xl py-4 text-left"
                  >
                    ③ 合并两份数据（按 ID 去重）
                  </Button>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  旧号的服务端数据不会被删除，即便选错也可改回原手机号重新登录找回。
                </p>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

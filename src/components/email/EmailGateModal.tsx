import { useEffect, useState } from "react";
import { Clock, Loader2, Mail } from "lucide-react";
import {
  ensureProfileForSession,
  getCurrentUser,
  saveProfile,
} from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailGateModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 邮箱引导弹窗（方案 A）：首次进入 / 首次建任务时，引导用户填写 QQ 邮箱，
 * 以便每晚 20:00 收到督促官邮件。邮箱仅用于发送提醒，可「稍后再说」暂不填写。
 */
export function EmailGateModal({ open, onClose }: EmailGateModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qqEmail, setQqEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
  }, [open]);

  const emailValid = !qqEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(qqEmail);

  const handleSave = async () => {
    if (!emailValid) return setError("邮箱格式看起来不太对，请检查后重试");
    setError("");
    setSaving(true);
    try {
      await saveProfile({ name, phone, qqEmail });
      setSaved(true);
      window.setTimeout(() => onClose(), 600);
    } catch {
      setError("保存失败，请稍后再试");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">开启每晚 8 点邮件提醒</DialogTitle>
          <DialogDescription className="text-center">
            填写 QQ 邮箱后，督促官会在每晚 20:00 给你发送当日未完成任务提醒，
            哪怕那天没打开 App 也能收到。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gate-email" className="text-xs">
              QQ 邮箱
            </Label>
            <Input
              id="gate-email"
              type="email"
              value={qqEmail}
              onChange={(e) => setQqEmail(e.target.value)}
              placeholder="123456@qq.com"
              className="rounded-2xl"
              autoFocus
            />
          </div>

          {qqEmail && emailValid && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              每晚 8 点若有未完成任务，督促官会发邮件到这里
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {saved && (
            <p className="text-xs text-primary">已保存，马上为你开启提醒～</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-1 rounded-2xl"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 保存中…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" /> 保存并开启
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-2xl"
            >
              稍后再说
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

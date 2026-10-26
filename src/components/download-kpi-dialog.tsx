"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, FileSpreadsheet, Eye, EyeOff, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { verifyPersonKpiPassword } from "@/app/actions";

export function DownloadKpiDialog({
  open,
  person,
  period,
  onClose,
}: {
  open: boolean;
  person: string | null;
  period: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open || !person) return null;

  const handleDownload = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPw = password.trim();
    if (!cleanPw) {
      setError("Нууц үгээ оруулна уу.");
      return;
    }

    startTransition(async () => {
      setError("");
      const valid = await verifyPersonKpiPassword(person, cleanPw);
      if (!valid) {
        setError("Нууц үг буруу байна! Зөвхөн тухайн ажилтны хувийн нууц үгээр татах боломжтой.");
        return;
      }

      toast.success(`${person}: Нууц үг зөв. Excel тайлан татаж байна...`);
      window.location.href = `/api/export-kpi?person=${encodeURIComponent(person)}&quarter=${period}&password=${encodeURIComponent(cleanPw)}`;
      setPassword("");
      setError("");
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <Card className="relative w-full max-w-sm border-primary/20 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Хаах"
        >
          <X className="size-4" />
        </button>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary">
            <Lock className="size-5" />
            <CardTitle className="text-base font-semibold">KPI Excel тайлан татах</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Ажилтан: <span className="font-semibold text-foreground">{person}</span> · {period}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDownload} className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-800 dark:text-amber-300 leading-normal">
              <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <span>
                Эрсдэлээс сэргийлж, хүн бүрийн тайлан өөр өөрийн нууц үгээр хамгаалагдсан. Тухайн ажилтны хувийн нууц үгийг оруулна уу.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Хувийн нууц үг / PIN</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Нууц үг оруулах..."
                  className="h-10 pr-10 font-mono tracking-wider"
                  value={password}
                  autoFocus
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
                Цуцлах
              </Button>
              <Button type="submit" size="sm" loading={isPending} className="gap-1.5">
                <FileSpreadsheet className="size-4" />
                {isPending ? "Шалгаж байна…" : "Татах"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

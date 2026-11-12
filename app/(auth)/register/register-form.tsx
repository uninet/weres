"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rss, Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// 验证函数
const validateEmail = (email: string): string => {
  if (!email) return "请输入邮箱地址";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "请输入有效的邮箱地址";
  return "";
};

const validateNickname = (nickname: string): string => {
  if (nickname && nickname.length > 20) return "昵称不能超过20个字符";
  return "";
};

// 这里的规则要与 /api/auth/register 完全一致，否则会出现
// 「前端放行、后端拒绝」或者反过来的情况，用户只会看到一句笼统的
// 「输入数据无效」。后端硬要求是 8–72 位且同时含字母和数字；
// 强度条（strength）只用来给视觉反馈，不当作拦截条件 ——
// 一个 30 位的纯小写+数字密码强度条显示两格，但它完全合法。
const validatePassword = (password: string): { error: string; strength: number } => {
  if (!password) return { error: "请输入密码", strength: 0 };
  if (password.length < 8) return { error: "密码至少 8 位", strength: 1 };
  if (password.length > 72) return { error: "密码最多 72 位", strength: 1 };
  if (!/[A-Za-z]/.test(password)) return { error: "密码需要包含字母", strength: 1 };
  if (!/\d/.test(password)) return { error: "密码需要包含数字", strength: 1 };

  let strength = 1;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  return { error: "", strength };
};

const validateConfirmPassword = (password: string, confirmPassword: string): string => {
  if (!confirmPassword) return "请确认密码";
  if (password !== confirmPassword) return "两次输入的密码不一致";
  return "";
};

// 密码强度指示器
function PasswordStrengthIndicator({ strength }: { strength: number }) {
  const levels = [
    { label: "太弱", color: "bg-destructive" },
    { label: "弱", color: "bg-orange-500" },
    { label: "一般", color: "bg-yellow-500" },
    { label: "强", color: "bg-green-500" },
    { label: "非常强", color: "bg-green-600" },
  ];

  const level = levels[Math.min(strength - 1, 4)];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors duration-300",
              i <= strength ? level.color : "bg-muted"
            )}
          />
        ))}
      </div>
      {strength > 0 && (
        <p className={cn("text-xs", level.color.replace("bg-", "text-"))}>
          密码强度: {level.label}
        </p>
      )}
    </div>
  );
}

// 密码要求检查项
function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { label: "至少8位字符", met: password.length >= 8 },
    { label: "包含小写字母", met: /[a-z]/.test(password) },
    { label: "包含大写字母", met: /[A-Z]/.test(password) },
    { label: "包含数字", met: /\d/.test(password) },
    { label: "包含特殊字符", met: /[^a-zA-Z0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 space-y-1">
      {requirements.map((req, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          {req.met ? (
            <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
          ) : (
            <X className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          )}
          <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
            {req.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nickname: "",
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 字段错误状态
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    nickname?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
  }>({});

  // 触摸状态
  const [touched, setTouched] = useState<{
    email?: boolean;
    nickname?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
  }>({});

  // 密码强度
  const [passwordStrength, setPasswordStrength] = useState(0);

  // 处理字段变化
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, email: value }));
    if (touched.email) {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, nickname: value }));
    if (touched.nickname) {
      setFieldErrors((prev) => ({ ...prev, nickname: validateNickname(value) }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, password: value }));

    const validation = validatePassword(value);
    setPasswordStrength(validation.strength);

    if (touched.password) {
      setFieldErrors((prev) => ({ ...prev, password: validation.error }));
    }

    // 同时验证确认密码
    if (touched.confirmPassword && formData.confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(value, formData.confirmPassword),
      }));
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, confirmPassword: value }));
    if (touched.confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(formData.password, value),
      }));
    }
  };

  const handleBlur = (field: "email" | "nickname" | "password" | "confirmPassword") => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    switch (field) {
      case "email":
        setFieldErrors((prev) => ({ ...prev, email: validateEmail(formData.email) }));
        break;
      case "nickname":
        setFieldErrors((prev) => ({ ...prev, nickname: validateNickname(formData.nickname) }));
        break;
      case "password":
        setFieldErrors((prev) => ({ ...prev, password: validatePassword(formData.password).error }));
        break;
      case "confirmPassword":
        setFieldErrors((prev) => ({
          ...prev,
          confirmPassword: validateConfirmPassword(formData.password, formData.confirmPassword),
        }));
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证所有字段
    const emailError = validateEmail(formData.email);
    const nicknameError = validateNickname(formData.nickname);
    const passwordValidation = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(
      formData.password,
      formData.confirmPassword
    );

    setFieldErrors({
      email: emailError,
      nickname: nicknameError,
      password: passwordValidation.error,
      confirmPassword: confirmPasswordError,
    });

    setTouched({
      email: true,
      nickname: true,
      password: true,
      confirmPassword: true,
    });

    if (emailError || nicknameError || passwordValidation.error || confirmPasswordError) {
      return;
    }

    if (!formData.agreeTerms) {
      setFieldErrors((prev) => ({ ...prev, agreeTerms: "请同意用户协议和隐私政策" }));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nickname: formData.nickname,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "注册失败");
        return;
      }

      router.push("/login");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Rss className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">WeRSS</span>
          </Link>
          <p className="mt-2 text-muted-foreground">创建新账号</p>
        </div>

        {/* Form */}
        <div className="bg-card p-8 rounded-xl border shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* 邮箱 */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱 <span className="text-destructive">*</span>
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleEmailChange}
                onBlur={() => handleBlur("email")}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : "email-hint"}
                className={cn(fieldErrors.email && "border-destructive")}
              />
              {fieldErrors.email ? (
                <p id="email-error" className="text-sm text-destructive">
                  {fieldErrors.email}
                </p>
              ) : (
                <p id="email-hint" className="text-xs text-muted-foreground">
                  请输入有效的邮箱地址，用于登录和找回密码
                </p>
              )}
            </div>

            {/* 昵称 */}
            <div className="space-y-2">
              <label htmlFor="nickname" className="text-sm font-medium">
                昵称 <span className="text-muted-foreground">(可选)</span>
              </label>
              <Input
                id="nickname"
                type="text"
                placeholder="您的昵称"
                value={formData.nickname}
                onChange={handleNicknameChange}
                onBlur={() => handleBlur("nickname")}
                aria-invalid={!!fieldErrors.nickname}
                aria-describedby={fieldErrors.nickname ? "nickname-error" : "nickname-hint"}
                className={cn(fieldErrors.nickname && "border-destructive")}
              />
              {fieldErrors.nickname ? (
                <p id="nickname-error" className="text-sm text-destructive">
                  {fieldErrors.nickname}
                </p>
              ) : (
                <p id="nickname-hint" className="text-xs text-muted-foreground">
                  设置一个昵称，让其他用户更容易认识您
                </p>
              )}
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                密码 <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="8-20位，包含字母和数字"
                  value={formData.password}
                  onChange={handlePasswordChange}
                  onBlur={() => handleBlur("password")}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : "password-requirements"
                  }
                  className={cn("pr-10", fieldErrors.password && "border-destructive")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id="password-error" className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              ) : (
                <div id="password-requirements">
                  <PasswordStrengthIndicator strength={passwordStrength} />
                  {formData.password && <PasswordRequirements password={formData.password} />}
                </div>
              )}
            </div>

            {/* 确认密码 */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                确认密码 <span className="text-destructive">*</span>
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={formData.confirmPassword}
                onChange={handleConfirmPasswordChange}
                onBlur={() => handleBlur("confirmPassword")}
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={
                  fieldErrors.confirmPassword ? "confirm-error" : "confirm-hint"
                }
                className={cn(fieldErrors.confirmPassword && "border-destructive")}
              />
              {fieldErrors.confirmPassword ? (
                <p id="confirm-error" className="text-sm text-destructive">
                  {fieldErrors.confirmPassword}
                </p>
              ) : (
                <p id="confirm-hint" className="text-xs text-muted-foreground">
                  请再次输入密码以确认
                </p>
              )}
            </div>

            {/* 用户协议 */}
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 mt-0.5"
                  checked={formData.agreeTerms}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, agreeTerms: e.target.checked }));
                    if (e.target.checked) {
                      setFieldErrors((prev) => ({ ...prev, agreeTerms: undefined }));
                    }
                  }}
                  aria-invalid={!!fieldErrors.agreeTerms}
                  aria-describedby={fieldErrors.agreeTerms ? "terms-error" : undefined}
                />
                <span className="text-muted-foreground">
                  我已阅读并同意
                  <Link href="#" className="text-primary hover:underline">
                    用户协议
                  </Link>
                  和
                  <Link href="#" className="text-primary hover:underline">
                    隐私政策
                  </Link>
                </span>
              </label>
              {fieldErrors.agreeTerms && (
                <p id="terms-error" className="text-sm text-destructive">
                  {fieldErrors.agreeTerms}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  注册中...
                </>
              ) : (
                "注册"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            已有账号？{" "}
            <Link href="/login" className="text-primary hover:underline">
              立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

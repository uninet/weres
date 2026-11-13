"use client";

import { RegisterForm } from "./register-form";

/**
 * 注册页。
 *
 * 外壳（背景、品牌区、卡片框）由 `RegisterForm` 内部的 `AuthShell` 提供，
 * 这里不再套一层 —— 之前页面和表单各画了一套 Logo 和卡片，同一个页面上
 * 叠了两个品牌区。
 */
export default function RegisterPage() {
  return <RegisterForm />;
}

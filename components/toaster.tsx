"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 全局消息提示容器。
 *
 * 为什么必须有这个东西：
 *   sonner 的 `toast()` 只是把一条消息推进内部 store，
 *   真正渲染出来的是 <Toaster /> 组件。项目里有 9 个页面、
 *   61 处调用 toast()，但根布局从来没挂过 <Toaster />，
 *   所以所有提示（订阅成功 / 订阅失败 / 保存成功）都静默丢弃 ——
 *   用户点完按钮看到的是「什么都没发生」。
 *
 * 放在 layout 里而不是每个页面里：翻页时提示不应该中断，而且
 * 只需要挂一次。
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      // 3.5 秒够读完一行中文，太短会被误认为没出现
      duration={3500}
      toastOptions={{
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 文本转语音（TTS）。
 *
 * 用浏览器内置的 Web Speech API，不引第三方服务、不需要 API Key ——
 * 这一点对这个项目很重要：别人把仓库拉下来就能用，不该再让他去申请
 * 一个语音合成服务。
 *
 * 已知限制（会在界面上说明，不假装完美）：
 *   - Chrome / Edge / Safari 支持，部分轻量浏览器没有；
 *   - 中文音质取决于操作系统装的语音包，Linux 服务器上可能没有中文音色；
 *   - 长文一次性塞给 speak() 会被部分浏览器截断，这里按句子切段排队播。
 */

/** 把长文按句子切成若干段，避免单次 speak 过长被截断 */
function splitIntoSentences(text: string, maxLen = 220): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // 中英文句末标点后断开
  const raw = clean.split(/(?<=[。！？!?；;])\s*/);
  const chunks: string[] = [];
  let buf = "";

  for (const piece of raw) {
    if ((buf + piece).length > maxLen) {
      if (buf) chunks.push(buf);
      buf = piece;
    } else {
      buf += piece;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export interface UseTextToSpeechReturn {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  rate: number;
  setRate: (rate: number) => void;
  play: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  toggle: (text: string) => void;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);

  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  // 用 ref 存 rate，避免 speak 队列里读到旧的闭包值
  const rateRef = useRef(1);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    indexRef.current = 0;
    setSpeaking(false);
    setPaused(false);
  }, []);

  const speakNext = useCallback(() => {
    const queue = queueRef.current;
    const i = indexRef.current;

    if (i >= queue.length) {
      setSpeaking(false);
      setPaused(false);
      queueRef.current = [];
      indexRef.current = 0;
      return;
    }

    const utter = new SpeechSynthesisUtterance(queue[i]);
    utter.lang = "zh-CN";
    utter.rate = rateRef.current;

    // 挑一个中文音色（有的话）
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.find((v) => v.lang?.toLowerCase().startsWith("zh"));
    if (zh) utter.voice = zh;

    utter.onend = () => {
      indexRef.current += 1;
      speakNext();
    };
    utter.onerror = () => {
      setSpeaking(false);
      setPaused(false);
    };

    window.speechSynthesis.speak(utter);
  }, []);

  const play = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();

      const chunks = splitIntoSentences(text);
      if (chunks.length === 0) return;

      queueRef.current = chunks;
      indexRef.current = 0;
      setSpeaking(true);
      setPaused(false);
      speakNext();
    },
    [speakNext]
  );

  const pause = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const toggle = useCallback(
    (text: string) => {
      if (speaking && !paused) {
        pause();
      } else if (speaking && paused) {
        resume();
      } else {
        play(text);
      }
    },
    [speaking, paused, pause, resume, play]
  );

  // 组件卸载 / 切文章时停止朗读，避免声音继续播
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    supported,
    speaking,
    paused,
    rate,
    setRate,
    play,
    pause,
    resume,
    stop,
    toggle,
  };
}

/** 把 HTML 正文转成适合朗读的纯文本 */
export function htmlToSpeakableText(html: string | undefined | null): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    // 服务端没有 DOMParser，退回粗暴的正则
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  // 图片、代码块不适合朗读
  doc.querySelectorAll("script, style, pre, code, figure").forEach((el) => el.remove());
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

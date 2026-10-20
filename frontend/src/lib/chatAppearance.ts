import type { CSSProperties } from "react";

export const CHAT_THEMES = [
  { id: "navy", bubble: "#14233A", text: "#ffffff", tick: "#7dd3fc" },
  { id: "brand", bubble: "#F4511E", text: "#0f1111", tick: "#fff7ed" },
  { id: "teal", bubble: "#0f766e", text: "#ffffff", tick: "#99f6e4" },
  { id: "grape", bubble: "#5b4b8a", text: "#ffffff", tick: "#ddd6fe" },
  { id: "sand", bubble: "#b08968", text: "#1f140c", tick: "#fff7ed" },
] as const;

export const CHAT_WALLPAPERS = [
  { id: "plain", src: "", repeat: true, tint: "#eef1f4" },
  { id: "dots", src: "/chat-bg/dots.svg", repeat: true, tint: "#e4ecf3" },
  { id: "waves", src: "/chat-bg/waves.svg", repeat: true, tint: "#e7eef6" },
  { id: "grid", src: "/chat-bg/grid.svg", repeat: true, tint: "#eef1f4" },
  { id: "dusk", src: "/chat-bg/dusk.svg", repeat: false, tint: "#1b2430" },
  { id: "leaves", src: "/chat-bg/leaves.svg", repeat: true, tint: "#e7f0e4" },
  { id: "paper", src: "/chat-bg/paper.svg", repeat: true, tint: "#efe7d8" },
  { id: "night", src: "/chat-bg/night.svg", repeat: false, tint: "#141b24" },
] as const;

export type ChatThemeId = (typeof CHAT_THEMES)[number]["id"];
export type ChatWallpaperId = (typeof CHAT_WALLPAPERS)[number]["id"];

export function chatTheme(id?: string | null) {
  return CHAT_THEMES.find((item) => item.id === id) || CHAT_THEMES[0];
}

export function chatWallpaper(id?: string | null) {
  return CHAT_WALLPAPERS.find((item) => item.id === id) || CHAT_WALLPAPERS[0];
}

export function wallpaperStyle(id?: string | null): CSSProperties {
  const wall = chatWallpaper(id);
  return {
    backgroundColor: wall.tint,
    backgroundImage: wall.src ? `url(${wall.src})` : undefined,
    backgroundRepeat: wall.repeat ? "repeat" : "no-repeat",
    backgroundSize: wall.repeat ? "280px" : "cover",
    backgroundPosition: "center",
  };
}

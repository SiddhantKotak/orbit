"use client";

import dynamic from "next/dynamic";
import { ChatSkeleton } from "@/components/shell/route-skeleton";

/** The chat screen without its heavy dependencies (AI SDK client, markdown) in the page's first JavaScript. */
export const ChatViewLazy = dynamic(() => import("./chat-view").then((m) => m.ChatView), {
  ssr: false,
  loading: () => <ChatSkeleton />,
});

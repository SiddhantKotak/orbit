"use client";

import dynamic from "next/dynamic";
import { EditorSkeleton } from "@/components/shell/route-skeleton";

/** The post editor (tiptap, prosemirror, chat) loads after the shell paints; the editor skeleton fills the gap. */
export const PostEditorViewLazy = dynamic(() => import("./post-editor-view").then((m) => m.PostEditorView), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

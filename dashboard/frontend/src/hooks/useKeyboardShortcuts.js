import { useEffect, useRef } from "react";

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(handlers) {
  const sequenceRef = useRef("");
  const sequenceTimerRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const key = event.key.toLowerCase();
      const withMeta = event.metaKey || event.ctrlKey;

      if (withMeta && key === "k") {
        event.preventDefault();
        handlers.openPalette?.();
        return;
      }

      if (isEditableTarget(target)) return;

      if (key === "/") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("agent-squad:focus-search"));
        return;
      }

      if (key === "t") {
        handlers.toggleTheme?.();
        return;
      }

      if (key === "[") {
        handlers.previousWorkspace?.();
        return;
      }

      if (key === "]") {
        handlers.nextWorkspace?.();
        return;
      }

      if (key === "g") {
        sequenceRef.current = "g";
        clearTimeout(sequenceTimerRef.current);
        sequenceTimerRef.current = setTimeout(() => {
          sequenceRef.current = "";
        }, 900);
        return;
      }

      if (sequenceRef.current === "g") {
        sequenceRef.current = "";
        clearTimeout(sequenceTimerRef.current);
        if (key === "m") handlers.goMission?.();
        if (key === "s") handlers.goSummary?.();
        if (key === "t") handlers.goTasks?.();
        if (key === "c") handlers.goComms?.();
        if (key === "a") handlers.goArtifacts?.();
        if (key === "n") handlers.goAnalytics?.();
        if (key === "u") handlers.goSetup?.();
        if (key === "e") handlers.goSettings?.();
        if (key === "h") handlers.goHelp?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(sequenceTimerRef.current);
    };
  }, [handlers]);
}

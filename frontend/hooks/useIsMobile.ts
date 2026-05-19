"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the viewport width is below the mobile breakpoint (768px).
 * Returns null on the first render (SSR / before mount) so the caller can
 * decide what to render before the viewport is known — both UIs are valid
 * fallbacks but rendering the wrong one and then flipping is jarring.
 */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    // Modern API (Safari ≥14 / Chrome / Firefox).
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

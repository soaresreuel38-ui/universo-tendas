"use client";

import { useEffect } from "react";
import { track, type TrackEvent } from "@/lib/analytics";

/** Registra um evento quando a página abre (ex.: produto visualizado). */
export function TrackView({ event, props }: { event: TrackEvent; props: Record<string, string | number> }) {
  const key = JSON.stringify(props);
  useEffect(() => {
    track(event, JSON.parse(key));
  }, [event, key]);
  return null;
}

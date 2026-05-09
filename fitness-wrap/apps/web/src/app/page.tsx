"use client";

import React, { useEffect, useRef, useState } from "react";
import SlideRenderer from "@/components/SlideRenderer";
import type { WrappedResponse } from "@/types/wrapped";

export default function HomePage() {
  const [data, setData] = useState<WrappedResponse | null>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const rawSlides = (data?.slides ?? []) as any[];
  const titleCase = (input: string) => {
    const s = String(input ?? "");
    // Capitalize the first letter after start or whitespace; keep other chars as-is.
    return s.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${String(p2).toUpperCase()}`);
  };

  // Remove backend slides we don't want to show
  const slidesNoTotals = rawSlides.filter((s) => {
    const t = String(s?.title ?? "").toLowerCase().trim();

    // Remove backend slides we don't want to show (be tolerant of minor title variations)
    if (t === "totals" || t.includes("totals")) return false;
    if (t.includes("your year in one line")) return false;
    if (t.includes("best months")) return false;
    if (t.includes("strava distance per month")) return false;
    if (t.includes("steps per month")) return false;
    if (t.includes("biggest efforts")) return false;
    if (t.includes("strava highlights")) return false;
    if (t.includes("sleep hours per month")) return false;

    return true;
  });

  // Build the dedicated stat slides from backend stats (Steps, Distance, Flights)
  const stats: any = (data as any)?.stats ?? {};
  const stravaHighlights: any = (stats as any)?.strava?.highlights ?? {};

  const longestRunPolyline: string | null = stravaHighlights?.longestRunPolyline ?? null;
  const longestRunBounds: any = stravaHighlights?.longestRunBounds ?? null;
  const longestRidePolyline: string | null = stravaHighlights?.longestRidePolyline ?? null;
  const longestRideBounds: any = stravaHighlights?.longestRideBounds ?? null;

  const toNumOrNull = (v: any): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim().length) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  // Optional: backend may or may not provide these
  const longestRunTimeSeconds: number | null =
    toNumOrNull(stravaHighlights?.longestRunTimeSeconds) ??
    toNumOrNull(stravaHighlights?.longestRunTimeSec) ??
    toNumOrNull(stravaHighlights?.longestRunDurationSeconds) ??
    null;

  const longestRunPaceSecondsPerKm: number | null =
    toNumOrNull(stravaHighlights?.longestRunPaceSecondsPerKm) ??
    toNumOrNull(stravaHighlights?.longestRunPaceSecPerKm) ??
    null;

  const longestRunPaceMinPerKm: number | null = toNumOrNull(stravaHighlights?.longestRunPaceMinPerKm);

  const fmtInt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
  const fmtKm = (n: number) => `${Number(n).toFixed(2)} km`;
  const fmtHours = (n: number) => `${Number(n).toFixed(0)} Hours`;

  const fmtDuration = (seconds: number) => {
    const s = Math.max(0, Math.round(seconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad2 = (x: number) => String(x).padStart(2, "0");
    return hh > 0 ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${mm}:${pad2(ss)}`;
  };

  const fmtPace = (secondsPerKm: number) => {
    const s = Math.max(0, Math.round(secondsPerKm));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    const pad2 = (x: number) => String(x).padStart(2, "0");
    return `${mm}:${pad2(ss)} /km`;
  };

  const paceToSecondsPerKm = (minPerKm: number) => {
    // minPerKm can be like 5.42 (minutes). Convert to seconds.
    return Math.max(0, Math.round(minPerKm * 60));
  };

  const stepsVal = typeof stats.steps === "number" ? fmtInt(stats.steps) : "";
  const distVal = typeof stats.walkRunKm === "number" ? fmtKm(stats.walkRunKm) : "";
  const flightsVal = typeof stats.flights === "number" ? fmtInt(stats.flights) : "";
  const sleepHoursVal = typeof stats.sleepHours === "number" ? fmtHours(stats.sleepHours) : "";
  const avgSleepHoursVal = typeof stats.avgSleepHours === "number" ? `${Number(stats.avgSleepHours).toFixed(2)} Hours` : "";
  const cnTowerEquiv =
    typeof (stats as any).cnTowerEquiv === "number" ? (stats as any).cnTowerEquiv : null;
  const cnTowerText = cnTowerEquiv
    ? `That's Like Cimbing The CN Tower ~${cnTowerEquiv.toFixed(0)} Times.`
    : "";

  const stepsSlide: any =
    String(stepsVal).length > 0
      ? {
          type: "stat",
          title: titleCase("Total Steps In 2025"),
          value: stepsVal,
          subtitle: "",
        }
      : null;

  const distanceSlide: any =
    String(distVal).length > 0
      ? {
          type: "stat",
          title: titleCase("Distance Covered"),
          value: distVal,
          subtitle: "",
        }
      : null;


  const flightsSlide: any =
    String(flightsVal).length > 0
      ? {
          type: "stat",
          title: titleCase("Flights Climbed"),
          value: flightsVal,
          subtitle: cnTowerText,
        }
      : null;

  const rechargeTitleSlide: any = {
    type: "stat",
    title: "",
    value: titleCase("Let’s see how you recharged throughout the year"),
    subtitle: "",
  };

  const sleepTotalSlide: any =
    String(sleepHoursVal).length > 0
      ? {
          type: "stat",
          title: titleCase("Total Sleep In 2025"),
          value: sleepHoursVal,
          subtitle: "",
        }
      : null;

  const sleepAvgSlide: any =
    String(avgSleepHoursVal).length > 0
      ? {
          type: "stat",
          title: titleCase("Average Sleep"),
          value: avgSleepHoursVal,
          subtitle: titleCase("Average hours per sleep session"),
        }
      : null;

  const summaryItems = [
    stepsVal ? { label: "Steps", value: stepsVal, icon: "👟" } : null,
    distVal ? { label: "Distance", value: distVal, icon: "🗺️" } : null,
    flightsVal ? { label: "Flights", value: flightsVal, icon: "🗼" } : null,
    sleepHoursVal ? { label: "Sleep", value: sleepHoursVal, icon: "😴" } : null,
    avgSleepHoursVal ? { label: "Avg Sleep", value: avgSleepHoursVal, icon: "🛌" } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; icon: string }>;

  const summarySlide: any =
    summaryItems.length
      ? {
          type: "summary",
          title: titleCase("Your 2025 Wrapped"),
          subtitle: titleCase("Your year, in one clean snapshot"),
          items: summaryItems,
        }
      : null;

  const injectedStatSlides: any[] = [stepsSlide, distanceSlide, flightsSlide].filter(Boolean);

  // Final slides: keep the backend hero as slide 1, then a welcome slide, then inject Steps/Distance/Flights, then the three backend slides (Biggest Day, Top Step Months, Steps Per Month), then the rest
  const slides = (() => {
    if (!slidesNoTotals.length) return [];

    const first = slidesNoTotals[0];
    const restAll = slidesNoTotals.slice(1);

    // Extract "Biggest Efforts" from the raw backend slides so we can split it into 3 stat slides
    const biggestEffortsRaw = rawSlides.find((s) =>
      String(s?.title ?? "").toLowerCase().includes("biggest efforts")
    );
    const biggest = extractBiggestEfforts(biggestEffortsRaw);

    const longestRunSlideFromEfforts: any =
      biggest.longestRunKm && biggest.longestRunDate
        ? {
            type: "stat",
            title: titleCase("Longest Run"),
            value: `${Number(biggest.longestRunKm).toFixed(2)} km`,
            subtitle: `On ${formatIsoDate(biggest.longestRunDate)}`,
            routePolyline: longestRunPolyline,
            routeBounds: longestRunBounds,
          }
        : null;

    const longestRunPaceSlide: any =
      longestRunSlideFromEfforts && (longestRunTimeSeconds || longestRunPaceSecondsPerKm || longestRunPaceMinPerKm)
        ? {
            type: "stat",
            title: titleCase("Best Running Pace"),
            value:
              longestRunPaceSecondsPerKm
                ? fmtPace(longestRunPaceSecondsPerKm)
                : longestRunPaceMinPerKm
                  ? fmtPace(paceToSecondsPerKm(longestRunPaceMinPerKm))
                  : "—",
            subtitle: longestRunTimeSeconds ? `Time: ${fmtDuration(longestRunTimeSeconds)}` : "Time: —",
            // reuse longest-run distance for this pace/time card
            distanceKm: biggest.longestRunKm ? Number(biggest.longestRunKm) : null,
            paceLayout: true,
          }
        : null;

    const longestRideSlideFromEfforts: any =
      biggest.longestRideKm && biggest.longestRideDate
        ? {
            type: "stat",
            title: titleCase("Longest Bike Ride"),
            value: `${Number(biggest.longestRideKm).toFixed(2)} km`,
            subtitle: `On ${formatIsoDate(biggest.longestRideDate)}`,
            routePolyline: longestRidePolyline,
            routeBounds: longestRideBounds,
          }
        : null;


    const stepExtrasTitles = [
      "your biggest day",
      "top step months",
    ];

    const stepExtras = restAll.filter((s) =>
      stepExtrasTitles.includes(String(s?.title ?? "").toLowerCase())
    );

    const stepExtrasOrdered = stepExtrasTitles
      .map((t) => stepExtras.find((s) => String(s?.title ?? "").toLowerCase() === t))
      .filter(Boolean) as any[];

    const rest = restAll.filter(
      (s) => !stepExtrasTitles.includes(String(s?.title ?? "").toLowerCase())
    );

    const restWithoutSleep = rest;

    const welcomeSlide = {
      type: "stat",
      title: "",
      value: titleCase("Welcome To Your 2025 Health Wrapped"),
      subtitle: "",
    };

    const merged = [
      first,
      welcomeSlide,
      ...(stepsSlide ? [stepsSlide] : []),
      ...stepExtrasOrdered,
      ...(distanceSlide ? [distanceSlide] : []),

      ...(flightsSlide ? [flightsSlide] : []),

      ...(longestRunSlideFromEfforts || longestRideSlideFromEfforts
        ? [{
            type: "stat",
            title: "",
            value: "Your Longest Routes",
            subtitle: "Let’s take a look at your longest run and bike ride this year",
          }]
        : []),

      ...(longestRunSlideFromEfforts ? [longestRunSlideFromEfforts] : []),
      ...(longestRunPaceSlide ? [longestRunPaceSlide] : []),
      ...(longestRideSlideFromEfforts ? [longestRideSlideFromEfforts] : []),
      // ...(biggestWeekSlideFromEfforts ? [biggestWeekSlideFromEfforts] : []), // removed

      ...restWithoutSleep,
      ...(rechargeTitleSlide ? [rechargeTitleSlide] : []),
      ...(sleepTotalSlide ? [sleepTotalSlide] : []),
      ...(sleepAvgSlide ? [sleepAvgSlide] : []),
      ...(summarySlide ? [summarySlide] : []),
    ];

    return merged.map((s: any) => {
      if (!s || typeof s !== "object") return s;
      if (typeof s.title === "string" && s.title.trim().length) {
        return { ...s, title: titleCase(s.title) };
      }
      return s;
    });
  })();

  const progress = slides.length ? Math.round(((activeIdx + 1) / slides.length) * 100) : 0;

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;

    // Header is 112px tall
    const sectionH = window.innerHeight - 112;
    const denom = sectionH > 0 ? sectionH : (el.clientHeight || window.innerHeight || 1);

    const idx = Math.round(el.scrollTop / denom);
    const clamped = Math.max(0, Math.min(idx, Math.max(0, slides.length - 1)));
    if (clamped !== activeIdx) setActiveIdx(clamped);
  }

  async function fetchWrappedAuto() {
    setIsFetching(true);
    setError(null);

    const attempts: Array<{
      label: string;
      input: RequestInfo;
      init?: RequestInit;
    }> = [
      {
        label: "GET /wrapped",
        input: "http://127.0.0.1:8000/wrapped",
        init: { method: "GET" },
      },
      {
        label: "POST /wrapped (no body)",
        input: "http://127.0.0.1:8000/wrapped",
        init: { method: "POST" },
      },
      {
        label: "POST /wrapped (json)",
        input: "http://127.0.0.1:8000/wrapped",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      },
      {
        label: "GET /wrapped/latest",
        input: "http://127.0.0.1:8000/wrapped/latest",
        init: { method: "GET" },
      },
    ];

    for (const a of attempts) {
      try {
        setStatus(`Trying ${a.label}…`);
        const res = await fetch(a.input, a.init);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }

        const payload = (await res.json()) as WrappedResponse;
        setData(payload);
        setActiveIdx(0);
        requestAnimationFrame(() => {
          if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
        });
        setIsFetching(false);
        setStatus("Loaded");
        return;
      } catch {
        // continue
      }
    }

    setIsFetching(false);
    setStatus("Failed");
    setError(
      "Could not load Wrapped from the backend. Make sure FastAPI is running on 127.0.0.1:8000 and expose an endpoint like GET /wrapped or POST /wrapped that returns the WrappedResponse JSON."
    );
  }

  useEffect(() => {
    fetchWrappedAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line no-console
    console.log("DEBUG strava longestRunPolyline", {
      hasStats: !!(data as any)?.stats,
      hasStrava: !!(data as any)?.stats?.strava,
      hasHighlights: !!(data as any)?.stats?.strava?.highlights,
      polylineType: typeof (data as any)?.stats?.strava?.highlights?.longestRunPolyline,
      polylineLen: String((data as any)?.stats?.strava?.highlights?.longestRunPolyline ?? "").length,
      sample: String((data as any)?.stats?.strava?.highlights?.longestRunPolyline ?? "").slice(0, 24),
    });
    (window as any).__WRAPPED_DEBUG__ = {
      stats: (data as any)?.stats,
    };
  }, [data]);

  const renderHaloTitle = (title: string) => {
    return (
      <>
        {Array.from(title).map((ch, idx) => {
          if (ch === "o" || ch === "O") {
            return (
              <span key={idx} className="fw-halo-letter">
                {ch}
              </span>
            );
          }
          return <span key={idx}>{ch}</span>;
        })}
      </>
    );
  };

  return (
    <main style={{ minHeight: "100vh", color: "#fff" }}>
      <style jsx global>{`
        /* Final summary slide */
        .fw-summary {
          width: 100%;
          text-align: center;
          padding: 18px 8px;
          transform: translateY(-32px);
        }

        .fw-summaryTitle {
          font-size: clamp(28px, 3.6vw, 46px);
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 0 0 10px 0;
          text-shadow:
            0 0 16px rgba(251, 146, 60, 0.18),
            0 0 30px rgba(59, 130, 246, 0.12);
        }

        .fw-summarySub {
          font-size: clamp(14px, 1.6vw, 18px);
          opacity: 0.7;
          margin: 0 0 18px 0;
        }

        .fw-summaryGrid {
          width: min(860px, 92vw);
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px;
        }

        .fw-summaryCard {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          box-shadow:
            0 18px 44px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset,
            0 0 34px rgba(59, 130, 246, 0.10);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 16px 14px 14px 14px;
          text-align: left;
          position: relative;
          overflow: hidden;
          flex: 0 1 270px;
          max-width: 320px;
        }

        .fw-summaryCard::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 20% 10%, rgba(251, 146, 60, 0.14), rgba(0,0,0,0) 55%),
                      radial-gradient(circle at 90% 30%, rgba(59, 130, 246, 0.14), rgba(0,0,0,0) 60%);
          opacity: 0.9;
          pointer-events: none;
        }

        .fw-summaryTop {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .fw-summaryLabel {
          font-size: 12px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          opacity: 0.65;
          font-weight: 800;
        }

        .fw-summaryIcon {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(0, 0, 0, 0.14);
          box-shadow: 0 0 24px rgba(59, 130, 246, 0.10);
          font-size: 16px;
        }

        .fw-summaryValue {
          position: relative;
          font-size: clamp(22px, 3.0vw, 34px);
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .fw-summaryValue.fw-orangeGradientText {
          text-shadow:
            0 0 18px rgba(251, 146, 60, 0.30),
            0 0 36px rgba(249, 115, 22, 0.20);
        }

        @media (max-width: 860px) {
          .fw-summaryGrid {
            width: min(720px, 92vw);
          }
        }

        @media (max-width: 520px) {
          .fw-summaryGrid {
            width: min(420px, 92vw);
          }
          .fw-summaryCard {
            text-align: center;
          }
          .fw-summaryTop {
            justify-content: center;
          }
        }
        html,
        body {
          margin: 0;
          padding: 0; 
          height: 100%;
          color: #fff;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          background:
            radial-gradient(1200px 800px at 20% 20%, rgba(239, 68, 68, 0.18), rgba(0, 0, 0, 0) 55%),
            radial-gradient(1200px 800px at 80% 30%, rgba(59, 130, 246, 0.18), rgba(0, 0, 0, 0) 55%),
            radial-gradient(1400px 900px at 50% 70%, rgba(30, 64, 175, 0.12), rgba(0, 0, 0, 1) 65%),
            #000000;
        }

        * {
          box-sizing: border-box;
        }

        code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }

        /* Slides: fullscreen + subtle story-like transitions */
        .fw-slide {
          opacity: 0.22;
          transform: translateY(16px) scale(0.992);
          transition: opacity 360ms ease,
            transform 520ms cubic-bezier(0.2, 0.9, 0.2, 1);
          will-change: transform, opacity;
        }

        .fw-slide[data-active="true"] {
          opacity: 1;
          transform: translateY(0px) scale(1);
        }

        .fw-slideScreen {
          min-height: calc(100vh - 7rem);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        /* Non-hero wrapper: center everything like the purple reference */
        .fw-content {
          width: 100%;
          max-width: 920px;
          margin: 0 auto;
          text-align: center;
          padding: 12px 8px;
        }

        /* Make SlideRenderer content match the title font */
        .fw-content,
        .fw-content * {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.01em;
        }

        /* Remove list bullets/dots produced by SlideRenderer */
        .fw-content ul,
        .fw-content ol {
          list-style: none;
          padding-left: 0;
          margin: 0 auto;
        }

        .fw-content li {
          list-style: none;
          margin: 6px 0;
        }

        .fw-content li::marker {
          content: "";
        }

        /* Hero slide styling (HALŌ minimalist vibe) */
        .fw-hero {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
          text-align: center;
          padding: 18px 10px;
          position: relative;
          isolation: isolate;
        }

        .fw-hero-kicker {
          font-size: 11px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          opacity: 0.5;
          margin-bottom: 28px;
          font-weight: 400;
        }

        .fw-hero-title {
          font-size: clamp(64px, 9vw, 112px);
          line-height: 0.92;
          margin: 0 0 24px 0;
          font-weight: 700;
          letter-spacing: -0.06em;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #ffffff;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }

        .fw-hero-big {
          font-size: clamp(16px, 1.9vw, 24px);
          font-weight: 400;
          opacity: 0.65;
          margin-bottom: 0px;
          letter-spacing: 0.02em;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .fw-heroHalo {
          padding-top: 60px;
          padding-bottom: 60px;
        }

        .fw-hero-decor {
          position: absolute;
          inset: -60px;
          pointer-events: none;
          z-index: -1;
          overflow: visible;
        }

        .fw-haloRing {
          position: absolute;
          left: 50%;
          top: 46%;
          width: min(560px, 78vw);
          height: min(560px, 78vw);
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.03) inset,
            0 0 40px rgba(59, 130, 246, 0.12),
            0 0 70px rgba(30, 64, 175, 0.08);
          background:
            radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0) 55%),
            conic-gradient(from 180deg, rgba(30, 64, 175, 0.12), rgba(59, 130, 246, 0.06), rgba(30, 64, 175, 0.12));
          animation: fw-ring-rotate 20s linear infinite;
          opacity: 0.6;
        }

        .fw-haloBlob {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(820px, 110vw);
          height: min(820px, 110vw);
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: radial-gradient(circle at 50% 50%, rgba(30, 64, 175, 0.15), rgba(0, 0, 0, 0) 60%);
          filter: blur(28px);
          opacity: 0.35;
        }

        .fw-haloGrain {
          position: absolute;
          inset: -40px;
          opacity: 0.08;
          background-image:
            radial-gradient(circle at 10% 20%, rgba(255,255,255,0.06) 0.5px, rgba(0,0,0,0) 0.6px),
            radial-gradient(circle at 80% 30%, rgba(255,255,255,0.05) 0.5px, rgba(0,0,0,0) 0.6px),
            radial-gradient(circle at 30% 80%, rgba(255,255,255,0.04) 0.5px, rgba(0,0,0,0) 0.6px);
          background-size: 200px 200px;
          mix-blend-mode: overlay;
        }

        .fw-halo-letter {
          display: inline-block;
          position: relative;
          padding: 0 0.02em;
          margin: 0 -0.01em;
        }

        .fw-halo-letter::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 56%;
          width: 0.85em;
          height: 0.85em;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 1px solid rgba(147, 197, 253, 0.25);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.04) inset,
            0 0 32px rgba(96, 165, 250, 0.4),
            0 0 48px rgba(59, 130, 246, 0.25);
          background: radial-gradient(circle at 50% 50%, rgba(96, 165, 250, 0.18), rgba(0, 0, 0, 0) 65%);
          pointer-events: none;
        }

        @keyframes fw-ring-rotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }

        .fw-hero-sub {
          font-size: clamp(16px, 1.4vw, 20px);
          opacity: 0.78;
          margin-bottom: 26px;
        }

        .fw-hero-hint {
          font-size: 14px;
          opacity: 0.55;
        }

        /* Stat slides (big number pages) */
        .fw-stat {
          width: 100%;
          text-align: center;
          padding: 12px 8px;
        }

        .fw-stat-value {
          font-size: clamp(56px, 7vw, 92px);
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 10px;

          background: linear-gradient(
            90deg,
            #fb923c 0%,
            #f97316 35%,
            #fbbf24 70%,
            #fde68a 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;

          text-shadow:
            0 0 18px rgba(251, 146, 60, 0.35),
            0 0 32px rgba(249, 115, 22, 0.25);
        }

        /* Match stat typography to hero title font */
        .fw-stat-value,
        .fw-stat-title {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.04em;
        }

        .fw-stat-value {
          font-weight: 800;
        }

        .fw-stat-title {
          font-size: clamp(18px, 2.2vw, 28px);
          font-weight: 700;
          opacity: 0.92;
          margin-bottom: 18px;
        }

        .fw-stat-title {
          font-weight: 700;
        }

        .fw-stat-sub {
          font-size: clamp(14px, 1.6vw, 18px);
          opacity: 0.7;
          line-height: 1.5;
        }

        /* Recovery callout (sleep slides) */
        .fw-recoveryText {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 10px auto 0 auto;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset,
            0 0 26px rgba(59, 130, 246, 0.16);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);

          font-size: clamp(12px, 1.6vw, 16px);
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.88);

          text-shadow:
            0 0 14px rgba(96, 165, 250, 0.22),
            0 0 28px rgba(59, 130, 246, 0.12);
        }

        .fw-recoveryText::before {
          content: "⚡";
          display: inline-block;
          font-size: 0.95em;
          opacity: 0.9;
          transform: translateY(-0.5px);
        }

        /* Pace slide (rounded boxes) */
        .fw-paceGrid {
          width: min(760px, 92vw);
          margin: 14px auto 6px auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .fw-paceBox {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          padding: 16px 16px 14px 16px;
          text-align: left;
        }

        .fw-paceLabel {
          font-size: 12px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          opacity: 0.6;
          margin-bottom: 8px;
          font-weight: 700;
        }

        .fw-paceValue {
          font-size: clamp(22px, 3.2vw, 34px);
          font-weight: 900;
          letter-spacing: -0.03em;
          opacity: 0.95;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        @media (max-width: 820px) {
          .fw-paceGrid {
            grid-template-columns: 1fr;
          }
          .fw-paceBox {
            text-align: center;
          }
        }

        /* Orange shine/glow utility */
        .fw-orangeGlow {
          text-shadow:
            0 0 14px rgba(251, 146, 60, 0.28),
            0 0 26px rgba(249, 115, 22, 0.20),
            0 0 46px rgba(251, 191, 36, 0.14);
        }

        /* Orange gradient text (match Total Steps number style) */
        .fw-orangeGradientText {
          background: linear-gradient(
            90deg,
            #fb923c 0%,
            #f97316 35%,
            #fbbf24 70%,
            #fde68a 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow:
            0 0 18px rgba(251, 146, 60, 0.35),
            0 0 32px rgba(249, 115, 22, 0.25);
        }

        /* Biggest Day slide (custom layout) */
        .fw-bigday {
          width: 100%;
          text-align: center;
          padding: 18px 8px;
        }

        .fw-bigday-title {
          font-size: clamp(22px, 2.8vw, 36px);
          font-weight: 800;
          margin-bottom: 18px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.04em;
          text-shadow:
            0 0 14px rgba(251, 146, 60, 0.22),
            0 0 26px rgba(249, 115, 22, 0.16);
        }

        .fw-bigday-line {
          font-size: clamp(18px, 2.2vw, 28px);
          font-weight: 600;
          opacity: 0.85;
          margin-bottom: 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.02em;
          text-shadow:
            0 0 12px rgba(251, 146, 60, 0.20),
            0 0 22px rgba(249, 115, 22, 0.14);
        }

        .fw-bigday-steps {
          font-size: clamp(54px, 6.5vw, 88px);
          font-weight: 850;
          letter-spacing: -0.03em;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          opacity: 0.98;

          background: linear-gradient(
            90deg,
            #fb923c 0%,
            #f97316 35%,
            #fbbf24 70%,
            #fde68a 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;

          text-shadow:
            0 0 18px rgba(251, 146, 60, 0.35),
            0 0 32px rgba(249, 115, 22, 0.25);
        }

        /* Top Step Months slide (custom layout) */
        .fw-topmonths {
          width: 100%;
          text-align: center;
          padding: 18px 8px;
        }

        .fw-topmonths-title {
          font-size: clamp(22px, 2.8vw, 36px);
          font-weight: 800;
          margin-bottom: 18px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.04em;
          opacity: 0.98;
        }

        .fw-topmonths-card {
          width: min(640px, 92vw);
          margin: 0 auto;
          padding: 18px 18px 14px 18px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .fw-topmonths-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: stretch;
          justify-content: center;
          margin-top: 6px;
        }

        .fw-topmonths-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(0, 0, 0, 0.10);
        }

        .fw-topmonths-itemLeft {
          display: flex;
          align-items: baseline;
          gap: 10px;
          min-width: 0;
        }

        .fw-topmonths-rank {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          letter-spacing: -0.02em;
          color: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.10), rgba(0,0,0,0.12));
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.10);
          flex: 0 0 auto;
        }

        .fw-topmonths-month {
          font-size: clamp(18px, 2.2vw, 26px);
          font-weight: 750;
          opacity: 0.95;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fw-topmonths-steps {
          font-size: clamp(18px, 2.2vw, 26px);
          font-weight: 900;
          letter-spacing: -0.03em;
          margin-left: 10px;

          background: linear-gradient(
            90deg,
            #fb923c 0%,
            #f97316 35%,
            #fbbf24 70%,
            #fde68a 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow:
            0 0 18px rgba(251, 146, 60, 0.28),
            0 0 34px rgba(249, 115, 22, 0.20);
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .fw-topmonths-subtle {
          margin-top: 12px;
          font-size: 13px;
          opacity: 0.55;
        }

        .fw-topmonths-divider {
          margin: 16px auto 6px auto;
          width: min(520px, 78vw);
          height: 1px;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.18) 30%,
            rgba(59,130,246,0.18) 55%,
            rgba(255,255,255,0.18) 70%,
            rgba(255,255,255,0) 100%
          );
          opacity: 0.85;
        }

        /* Walking animation (Top Step Months) */
        .fw-walkWrap {
          margin-top: 26px;
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .fw-walkTrack {
          position: relative;
          width: min(520px, 78vw);
          height: 64px;
          overflow: hidden;
        }

        .fw-walker {
          position: absolute;
          left: -80px;
          top: 8px;
          width: 64px;
          height: 64px;
          animation: fw-walk-move 4.2s linear infinite;
          filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.35));
          opacity: 0.9;
        }

        .fw-walker svg {
          width: 64px;
          height: 64px;
        }

        .fw-walk-leg {
          transform-origin: 32px 42px;
          animation: fw-walk-leg 520ms ease-in-out infinite;
        }

        .fw-walk-leg.fw-walk-leg--alt {
          animation-delay: 260ms;
        }

        .fw-walk-arm {
          transform-origin: 32px 30px;
          animation: fw-walk-arm 520ms ease-in-out infinite;
        }

        .fw-walk-arm.fw-walk-arm--alt {
          animation-delay: 260ms;
        }

        .fw-walk-ground {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 12px;
          height: 1px;
          background: rgba(255, 255, 255, 0.18);
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.10);
        }

        @keyframes fw-walk-move {
          0% { transform: translateX(0) scale(0.98); opacity: 0.0; }
          10% { opacity: 0.95; }
          90% { opacity: 0.95; }
          100% { transform: translateX(calc(100% + 160px)) scale(0.98); opacity: 0.0; }
        }

        @keyframes fw-walk-leg {
          0%   { transform: rotate(22deg); }
          50%  { transform: rotate(-22deg); }
          100% { transform: rotate(22deg); }
        }

        @keyframes fw-walk-arm {
          0%   { transform: rotate(-16deg); }
          50%  { transform: rotate(16deg); }
          100% { transform: rotate(-16deg); }
        }

        .fw-cnTower {
          margin-top: 18px;
          display: flex;
          justify-content: center;
          opacity: 0.85;
        }

        .fw-cnTower svg {
          width: min(220px, 60vw);
          height: auto;
          overflow: visible;
          filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.35));
        }

        .fw-cnTower .tower-stroke {
          stroke: rgba(147, 197, 253, 0.75);
          stroke-width: 2;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
        }

        .fw-slide[data-active="true"] .fw-cnTower .tower-stroke {
          animation: fw-draw 1100ms ease forwards;
        }

        .fw-cnTower .tower-fill {
          fill: rgba(147, 197, 253, 0.12);
          stroke: rgba(147, 197, 253, 0.28);
          stroke-width: 1;
        }

        .fw-cnTower .tower-glow {
          fill: rgba(96, 165, 250, 0.28);
          filter: blur(8px);
          opacity: 0.7;
          transform-origin: center;
        }

        .fw-slide[data-active="true"] .fw-cnTower .tower-glow {
          animation: fw-glow 1400ms ease-in-out infinite;
        }

        @keyframes fw-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes fw-glow {
          0%, 100% {
            opacity: 0.45;
            transform: translateY(0px) scale(1);
          }
          50% {
            opacity: 0.85;
            transform: translateY(-3px) scale(1.03);
          }
        }


        /* Route map (Strava-style) */
        .fw-routeWrap {
          width: min(640px, 92vw);
          margin: 14px auto 6px auto;
          padding: 14px 14px 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .fw-routeSvg {
          width: 100%;
          height: 220px;
          display: block;
          overflow: visible;
        }

        .fw-routePath {
          fill: none;
          stroke: rgba(147, 197, 253, 0.92);
          stroke-width: 3.25;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 10px rgba(96, 165, 250, 0.45))
                  drop-shadow(0 0 24px rgba(59, 130, 246, 0.22));
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
        }

        .fw-routePathGlow {
          fill: none;
          stroke: rgba(96, 165, 250, 0.38);
          stroke-width: 7;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: blur(1.6px);
          opacity: 0.55;
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
        }

        .fw-slide[data-active="true"] .fw-routePath,
        .fw-slide[data-active="true"] .fw-routePathGlow {
          animation: fw-route-draw 3400ms ease forwards;
        }

        @keyframes fw-route-draw {
          to { stroke-dashoffset: 0; }
        }

        /* Recharge slide battery (static) */
        .fw-batteryWrap {
          margin-top: 26px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .fw-battery {
          position: relative;
          width: 170px;
          height: 74px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.45));
          opacity: 0.95;
        }

        .fw-battery-cap {
          position: absolute;
          right: -12px;
          width: 12px;
          height: 34px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.18);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.10) inset,
            0 0 18px rgba(96, 165, 250, 0.12);
        }

        .fw-battery-body {
          width: 160px;
          height: 68px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.04);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.03) inset,
            0 0 34px rgba(59, 130, 246, 0.10);
          overflow: hidden;
          padding: 8px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .fw-battery-level {
          height: 100%;
          width: 12%;
          border-radius: 14px;
          background: linear-gradient(
            90deg,
            rgba(34, 197, 94, 0.35) 0%,
            rgba(34, 197, 94, 0.78) 55%,
            rgba(34, 197, 94, 0.50) 100%
          );
          box-shadow:
            0 0 18px rgba(34, 197, 94, 0.18),
            0 0 38px rgba(34, 197, 94, 0.10);
          position: relative;
          overflow: hidden;
        }

        /* shimmer to make the fill feel “alive” */
        .fw-battery-level::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.18) 45%,
            rgba(255,255,255,0) 85%
          );
          transform: translateX(-120%);
          opacity: 0.55;
        }

        /* Animate only on the active slide */
        .fw-slide[data-active="true"] .fw-battery-level {
          animation: fw-battery-charge 3.6s ease-in-out infinite;
        }

        .fw-slide[data-active="true"] .fw-battery-level::after {
          animation: fw-battery-shimmer 1.25s ease-in-out infinite;
        }

        @keyframes fw-battery-charge {
          0% {
            width: 12%;
            box-shadow:
              0 0 14px rgba(34, 197, 94, 0.14),
              0 0 30px rgba(34, 197, 94, 0.08);
            opacity: 0.72;
          }
          55% {
            width: 96%;
            box-shadow:
              0 0 26px rgba(34, 197, 94, 0.28),
              0 0 62px rgba(34, 197, 94, 0.16);
            opacity: 0.98;
          }
          72% {
            width: 96%;
            opacity: 0.98;
          }
          100% {
            width: 12%;
            box-shadow:
              0 0 14px rgba(34, 197, 94, 0.14),
              0 0 30px rgba(34, 197, 94, 0.08);
            opacity: 0.72;
          }
        }

        @keyframes fw-battery-shimmer {
          0% { transform: translateX(-140%); opacity: 0.0; }
          20% { opacity: 0.55; }
          50% { transform: translateX(0%); opacity: 0.35; }
          100% { transform: translateX(140%); opacity: 0.0; }
        }

        /* Welcome slide should be clean white (no gradient number styling) */
        .fw-welcome .fw-stat-value {
          background: none;
          -webkit-background-clip: initial;
          background-clip: initial;
          color: #ffffff;
          text-shadow: 0 0 28px rgba(255, 255, 255, 0.18);
        }

        /* Welcome slide health animation */
        .fw-welcomeAnim {
          margin-top: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
        }

        .fw-heart {
          width: 44px;
          height: 44px;
          filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.35));
          animation: fw-heartbeat 900ms ease-in-out infinite;
          transform-origin: 50% 60%;
        }

        .fw-ecg {
          width: min(420px, 70vw);
          height: 54px;
          opacity: 0.9;
          filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.35));
        }

        .fw-ecg path {
          stroke: rgba(255, 255, 255, 0.82);
          stroke-width: 3;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
          animation: fw-ecg-draw 1400ms ease-in-out infinite;
        }

        .fw-ecg .fw-ecgGlow {
          stroke: rgba(96, 165, 250, 0.55);
          stroke-width: 6;
          filter: blur(2px);
          opacity: 0.55;
        }

        @keyframes fw-heartbeat {
          0% { transform: scale(1); opacity: 0.92; }
          25% { transform: scale(1.08); opacity: 1; }
          50% { transform: scale(0.98); opacity: 0.95; }
          75% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 0.92; }
        }

        @keyframes fw-ecg-draw {
          0% { stroke-dashoffset: 520; opacity: 0.25; }
          15% { opacity: 0.9; }
          55% { stroke-dashoffset: 0; opacity: 0.95; }
          75% { opacity: 0.35; }
          100% { stroke-dashoffset: -520; opacity: 0.25; }
        }

        /* Routes intro slide (runner + bike) */
        .fw-routesIntro .fw-hero-title {
          margin-bottom: 10px !important;
        }

        .fw-routesAnim {
          margin-top: 22px;
          display: grid;
          gap: 14px;
          align-items: center;
          justify-content: center;
        }

        .fw-routesTrack {
          position: relative;
          width: min(520px, 78vw);
          height: 56px;
          overflow: hidden;
          border-radius: 999px;

          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .fw-routesLine {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          transform: translateY(-50%);
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.18) 25%,
            rgba(96,165,250,0.22) 50%,
            rgba(255,255,255,0.18) 75%,
            rgba(255,255,255,0) 100%
          );
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.10);
          opacity: 0.9;
        }

        .fw-routesRunner,
        .fw-routesBike {
          position: absolute;
          top: 50%;
          width: 56px;
          height: 56px;
          transform: translateY(-50%);
          filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.35));
          opacity: 0.92;
        }

        .fw-routesRunner svg,
        .fw-routesBike svg {
          width: 56px;
          height: 56px;
          display: block;
        }

        /* Runner goes left -> right */
        .fw-routesRunner {
          left: -72px;
        }

        .fw-slide[data-active="true"] .fw-routesRunner {
          animation: fw-run-move 3.8s linear infinite;
        }

        /* Bike goes right -> left (second track) */
        .fw-routesTrack--bike .fw-routesBike {
          right: -72px;
          transform: translateY(-50%) scaleX(-1);
        }

        .fw-slide[data-active="true"] .fw-routesTrack--bike .fw-routesBike {
          animation: fw-bike-move 4.6s linear infinite;
        }

        /* Subtle bob so it feels alive */
        .fw-slide[data-active="true"] .fw-routesRunner svg,
        .fw-slide[data-active="true"] .fw-routesBike svg {
          animation: fw-route-bob 650ms ease-in-out infinite;
        }

        .fw-slide[data-active="true"] .fw-routesTrack--bike .fw-routesBike svg {
          animation-delay: 160ms;
        }

        /* Runner limb swing */
        .fw-slide[data-active="true"] .fw-routesRunner .fw-run-arm {
          transform-origin: 34px 26px;
          animation: fw-run-swing 420ms ease-in-out infinite;
        }
        .fw-slide[data-active="true"] .fw-routesRunner .fw-run-arm.fw-run-arm--alt {
          animation-delay: 210ms;
        }
        .fw-slide[data-active="true"] .fw-routesRunner .fw-run-leg {
          transform-origin: 34px 38px;
          animation: fw-run-swing 420ms ease-in-out infinite;
        }
        .fw-slide[data-active="true"] .fw-routesRunner .fw-run-leg.fw-run-leg--alt {
          animation-delay: 210ms;
        }

        /* Bike wheel spin */
        .fw-slide[data-active="true"] .fw-routesBike .fw-bike-wheel {
          transform-origin: 18px 46px;
          animation: fw-wheel-spin 520ms linear infinite;
        }
        .fw-slide[data-active="true"] .fw-routesBike .fw-bike-wheel.fw-bike-wheel--rear {
          transform-origin: 48px 46px;
        }

        @keyframes fw-run-swing {
          0%   { transform: rotate(18deg); }
          50%  { transform: rotate(-18deg); }
          100% { transform: rotate(18deg); }
        }

        @keyframes fw-wheel-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        @keyframes fw-run-move {
          0%   { transform: translate(-0px, -50%); opacity: 0; }
          10%  { opacity: 0.95; }
          90%  { opacity: 0.95; }
          100% { transform: translate(calc(100% + 160px), -50%); opacity: 0; }
        }

        @keyframes fw-bike-move {
          0%   { transform: translate(0px, -50%) scaleX(-1); opacity: 0; }
          10%  { opacity: 0.95; }
          90%  { opacity: 0.95; }
          100% { transform: translate(calc(-100% - 160px), -50%) scaleX(-1); opacity: 0; }
        }

        @keyframes fw-route-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }

        @keyframes fw-pop {
          from {
            transform: translateY(10px) scale(0.98);
            opacity: 0;
          }
          to {
            transform: translateY(0px) scale(1);
            opacity: 1;
          }
        }

        .fw-slide[data-active="true"] .fw-hero-title,
        .fw-slide[data-active="true"] .fw-hero-big,
        .fw-slide[data-active="true"] .fw-hero-sub,
        .fw-slide[data-active="true"] .fw-hero-kicker {
          animation: fw-pop 620ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }

        .fw-slide[data-active="true"] .fw-hero-big {
          animation-duration: 720ms;
        }

        .fw-slide[data-active="true"] .fw-hero-sub {
          animation-duration: 820ms;
        }

        .fw-slide[data-active="true"] .fw-stat-value,
        .fw-slide[data-active="true"] .fw-stat-title,
        .fw-slide[data-active="true"] .fw-stat-sub {
          animation: fw-pop 720ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }
      `}</style>

      {/* Body */}
      {!data ? (
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 24,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
              Fitness Wrapped
            </div>
            <div style={{ marginTop: 8, opacity: 0.75, lineHeight: 1.4 }}>
              {isFetching ? status : ""}
            </div>

            <div
              style={{
                marginTop: 18,
                height: 10,
                width: "100%",
                background: "rgba(255,255,255,0.10)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 10,
                  width: isFetching ? "55%" : "0%",
                  background: "#fff",
                  borderRadius: 999,
                  transition: "width 400ms ease",
                  opacity: 0.65,
                }}
              />
            </div>

            {error ? (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.92)",
                  background: "rgba(255, 80, 80, 0.12)",
                  border: "1px solid rgba(255, 80, 80, 0.25)",
                  padding: 12,
                  borderRadius: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65 }}>
              Tip: keep FastAPI running on <code style={{ opacity: 0.9 }}>127.0.0.1:8000</code>.
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          style={{ height: "100vh", overflowY: "auto", scrollSnapType: "y mandatory" }}
        >
          {slides.map((slide, i) => (
            <section
              key={i}
              className="fw-slide fw-slideScreen"
              data-active={i === activeIdx}
              style={{ scrollSnapAlign: "start" }}
            >
              <div style={{ width: "100%", margin: "0 auto" }}>
                {slide.type === "hero" ? (
                  <div className="fw-hero fw-heroHalo">
                    <div className="fw-hero-decor" aria-hidden="true">
                      <div className="fw-haloRing" />
                      <div className="fw-haloBlob" />
                      <div className="fw-haloGrain" />
                    </div>

                    <div className="fw-hero-kicker">Fitness Wrapped</div>
                    <h1 className="fw-hero-title">
                      {renderHaloTitle(titleCase(String((slide as any).title ?? "")))}
                    </h1>
                    <div className="fw-hero-big">{(slide as any).bigNumber}</div>
                  </div>
                ) : (slide as any).type === "summary" ? (
                  (() => {
                    const s: any = slide as any;
                    const title: string = titleCase(s.title ?? "");
                    const subtitle: string = String(s.subtitle ?? "");
                    const items: Array<{ label: string; value: string; icon: string }> = Array.isArray(s.items)
                      ? s.items
                      : [];

                    return (
                      <div className="fw-summary">
                        <div className="fw-summaryTitle fw-orangeGlow">{title}</div>
                        {subtitle ? <div className="fw-summarySub">{subtitle}</div> : null}

                        <div className="fw-summaryGrid" aria-label="Year summary">
                          {items.map((it, idx) => (
                            <div key={idx} className="fw-summaryCard">
                              <div className="fw-summaryTop">
                                <div className="fw-summaryLabel">{it.label}</div>
                                <div className="fw-summaryIcon" aria-hidden="true">{it.icon}</div>
                              </div>
                              <div className="fw-summaryValue fw-orangeGradientText">{it.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : (slide as any).type === "stat" ||
                  ["Total Steps", "Distance Covered", "Flights Climbed"].includes((slide as any).title) ? (
                  (() => {
                    const s: any = slide as any;
                    const title: string = titleCase(s.title ?? "");
                    const value: string = String(s.value ?? s.bigNumber ?? "");
                    const subtitle: string = String(s.subtitle ?? s.caption ?? "");

                    const isWelcome = !title || title.trim().length === 0;

                    const lower = title.toLowerCase();
                    const variant = lower.includes("step")
                      ? "steps"
                      : lower.includes("distance")
                        ? "distance"
                        : lower.includes("flight")
                          ? "flights"
                          : "";

                    if (isWelcome) {
                      const isRoutesIntro = value.toLowerCase().includes("longest routes");
                      const isRechargeIntro = value.toLowerCase().includes("recharged throughout the year");

                      return (
                        <div className={`fw-stat fw-welcome ${isRoutesIntro ? "fw-routesIntro" : ""}`}>
                          <h1 className="fw-hero-title" style={{ margin: 0 }}>
                            {value}
                          </h1>
                          {isRechargeIntro ? (
                            <div className="fw-batteryWrap" aria-hidden="true">
                              <div className="fw-battery">
                                <div className="fw-battery-cap" />
                                <div className="fw-battery-body">
                                  <div className="fw-battery-level" />
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {isRoutesIntro ? (
                            <div className="fw-routesAnim" aria-hidden="true">
                              <div className="fw-routesTrack">
                                <div className="fw-routesLine" />
                                <div className="fw-routesRunner" aria-hidden="true">
                                  <svg viewBox="0 0 64 64" role="img" aria-label="Runner">
                                    {/* trail */}
                                    <path d="M6 34 L18 34" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeLinecap="round" fill="none" />
                                    <path d="M6 26 L16 26" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeLinecap="round" fill="none" />

                                    {/* glow */}
                                    <circle cx="34" cy="34" r="22" fill="rgba(96,165,250,0.10)" />

                                    {/* head */}
                                    <circle cx="42" cy="14" r="6" fill="rgba(255,255,255,0.92)" />

                                    {/* torso */}
                                    <path
                                      d="M40 20 L33 33"
                                      stroke="rgba(255,255,255,0.90)"
                                      strokeWidth="4.2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      fill="none"
                                    />

                                    {/* arms (animated) */}
                                    <g className="fw-run-arm">
                                      <path d="M38 22 L50 24" stroke="rgba(255,255,255,0.82)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                    </g>
                                    <g className="fw-run-arm fw-run-arm--alt">
                                      <path d="M36 25 L26 20" stroke="rgba(255,255,255,0.78)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                    </g>

                                    {/* hips */}
                                    <circle cx="33" cy="33" r="2.3" fill="rgba(255,255,255,0.90)" />

                                    {/* legs (animated) */}
                                    <g className="fw-run-leg">
                                      {/* thigh */}
                                      <path
                                        d="M33 33 L45 39"
                                        stroke="rgba(255,255,255,0.92)"
                                        strokeWidth="4.3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        fill="none"
                                      />
                                      {/* shin + foot (single clean line, no extra branch) */}
                                      <path
                                        d="M45 39 L54 52"
                                        stroke="rgba(255,255,255,0.92)"
                                        strokeWidth="4.3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        fill="none"
                                      />
                                    </g>
                                    <g className="fw-run-leg fw-run-leg--alt">
                                      <path d="M33 33 L22 44" stroke="rgba(255,255,255,0.86)" strokeWidth="4.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                      <path d="M22 44 L14 52" stroke="rgba(255,255,255,0.86)" strokeWidth="4.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                    </g>
                                  </svg>
                                </div>
                              </div>

                              <div className="fw-routesTrack fw-routesTrack--bike">
                                <div className="fw-routesLine" />
                                <div className="fw-routesBike" aria-hidden="true">
                                  <svg viewBox="0 0 64 64" role="img" aria-label="Bike">
                                    {/* glow */}
                                    <circle cx="34" cy="34" r="22" fill="rgba(96,165,250,0.10)" />

                                    {/* wheels (spin) */}
                                    <g className="fw-bike-wheel">
                                      <circle cx="18" cy="46" r="10" stroke="rgba(255,255,255,0.86)" strokeWidth="3" fill="none" />
                                      <path d="M18 36 L18 56" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" fill="none" />
                                      <path d="M8 46 L28 46" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" fill="none" />
                                    </g>
                                    <g className="fw-bike-wheel fw-bike-wheel--rear">
                                      <circle cx="48" cy="46" r="10" stroke="rgba(255,255,255,0.86)" strokeWidth="3" fill="none" />
                                      <path d="M48 36 L48 56" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" fill="none" />
                                      <path d="M38 46 L58 46" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" fill="none" />
                                    </g>

                                    {/* frame */}
                                    <path
                                      d="M18 46 L28 30 L40 30 L48 46"
                                      stroke="rgba(255,255,255,0.92)"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      fill="none"
                                    />
                                    <path d="M28 30 L22 30" stroke="rgba(255,255,255,0.78)" strokeWidth="3" strokeLinecap="round" fill="none" />
                                    <path d="M40 30 L46 24" stroke="rgba(255,255,255,0.78)" strokeWidth="3" strokeLinecap="round" fill="none" />
                                    <circle cx="28" cy="30" r="2" fill="rgba(255,255,255,0.92)" />
                                    <circle cx="40" cy="30" r="2" fill="rgba(255,255,255,0.92)" />

                                    {/* rider */}
                                    <circle cx="34" cy="16" r="5" fill="rgba(255,255,255,0.92)" />
                                    <path d="M34 21 L32 30" stroke="rgba(255,255,255,0.86)" strokeWidth="3.6" strokeLinecap="round" fill="none" />
                                    <path d="M32 26 L42 30" stroke="rgba(255,255,255,0.80)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                                    <path d="M32 30 L28 38" stroke="rgba(255,255,255,0.84)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                                    <path d="M30 36 L40 34" stroke="rgba(255,255,255,0.78)" strokeWidth="3" strokeLinecap="round" fill="none" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ) : !isRechargeIntro ? (
                            <div className="fw-welcomeAnim" aria-hidden="true">
                              {/* Heart */}
                              <svg className="fw-heart" viewBox="0 0 64 64" role="img" aria-label="Heart">
                                <path
                                  d="M32 56 C32 56, 10 42, 10 26 C10 17, 17 10, 26 10 C30 10, 34 12, 36 16 C38 12, 42 10, 46 10 C55 10, 62 17, 62 26 C62 42, 32 56, 32 56 Z"
                                  fill="rgba(255,255,255,0.90)"
                                />
                                <path
                                  d="M32 56 C32 56, 10 42, 10 26 C10 17, 17 10, 26 10 C30 10, 34 12, 36 16 C38 12, 42 10, 46 10 C55 10, 62 17, 62 26 C62 42, 32 56, 32 56 Z"
                                  fill="rgba(96,165,250,0.12)"
                                />
                              </svg>

                              {/* ECG */}
                              <svg className="fw-ecg" viewBox="0 0 520 54" role="img" aria-label="ECG line">
                                <path
                                  className="fw-ecgGlow"
                                  d="M2 28 L90 28 L112 28 L124 10 L142 46 L156 28 L190 28 L210 28 L228 18 L246 40 L262 28 L360 28 L382 28 L396 14 L414 46 L430 28 L518 28"
                                />
                                <path
                                  d="M2 28 L90 28 L112 28 L124 10 L142 46 L156 28 L190 28 L210 28 L228 18 L246 40 L262 28 L360 28 L382 28 L396 14 L414 46 L430 28 L518 28"
                                />
                              </svg>
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <div className={`fw-stat ${variant ? `fw-stat-${variant}` : ""}`}>
                        {(s as any).paceLayout ? (
                          <div className="fw-paceGrid" aria-label="Pace, time, and distance">
                            <div className="fw-paceBox">
                              <div className="fw-paceLabel">Distance</div>
                              <div className="fw-paceValue">
                                {typeof (s as any).distanceKm === "number" ? `${(s as any).distanceKm.toFixed(2)} km` : "—"}
                              </div>
                            </div>
                            <div className="fw-paceBox">
                              <div className="fw-paceLabel">Pace</div>
                              <div className="fw-paceValue fw-orangeGradientText">{value}</div>
                            </div>
                            <div className="fw-paceBox">
                              <div className="fw-paceLabel">Time</div>
                              <div className="fw-paceValue">
                                {String(subtitle || "").replace(/^Time:\s*/i, "") || "—"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="fw-stat-value">{value}</div>
                        )}
                        <div className="fw-stat-title">{title}</div>
                        {title.toLowerCase().includes("total sleep") ? (
                          <div className="fw-recoveryText">Recovery Matters Too</div>
                        ) : null}
                        {((title.toLowerCase().includes("longest run") && !title.toLowerCase().includes("pace")) ||
                        title.toLowerCase().includes("longest ride") ||
                        title.toLowerCase().includes("longest bike ride")) ? (
                          <div className="fw-routeWrap" aria-hidden="true">
                            <RouteMap
                              polyline={String((s as any).routePolyline ?? "")}
                              bounds={(s as any).routeBounds ?? null}
                            />
                          </div>
                        ) : null}

                        {variant === "flights" ? (
                          <div className="fw-cnTower" aria-hidden="true">
                            <svg viewBox="0 0 240 520" role="img" aria-label="CN Tower Illustration">
                              {/* ground glow */}
                              <ellipse className="tower-glow" cx="120" cy="470" rx="70" ry="22" />

                              {/* antenna */}
                              <path className="tower-stroke" d="M120 20 L120 120" />

                              {/* antenna tip */}
                              <circle className="tower-stroke" cx="120" cy="120" r="6" />

                              {/* upper mast */}
                              <path className="tower-stroke" d="M114 120 L126 120 L130 160 L110 160 Z" />

                              {/* SkyPod (main ring) */}
                              <path
                                className="tower-stroke"
                                d="
                                  M70 170
                                  C85 140, 155 140, 170 170
                                  C155 205, 85 205, 70 170
                                  Z
                                "
                              />

                              {/* SkyPod inner detail */}
                              <path
                                className="tower-stroke"
                                d="
                                  M85 178
                                  C95 158, 145 158, 155 178
                                  C145 195, 95 195, 85 178
                                  Z
                                "
                              />

                              {/* lower pod taper */}
                              <path className="tower-stroke" d="M95 205 L120 240 L145 205" />

                              {/* shaft */}
                              <path
                                className="tower-stroke"
                                d="
                                  M112 240
                                  L128 240
                                  L138 470
                                  L102 470
                                  Z
                                "
                              />

                              {/* center seam */}
                              <path className="tower-stroke" d="M120 240 L120 470" />
                            </svg>
                          </div>
                        ) : null}

                        {(s as any).paceLayout ? null : (subtitle ? <div className="fw-stat-sub">{subtitle}</div> : null)}
                      </div>
                    );
                  })()
                ) : String((slide as any)?.title ?? "").toLowerCase() === "your biggest day" ? (
                  (() => {
                    const info = extractBiggestDay(slide);
                    const prettyDate = formatIsoDate(info.date);
                    const stepsText = info.steps ? new Intl.NumberFormat("en-US").format(Number(String(info.steps).replace(/,/g, ""))) : "";

                    return (
                      <div className="fw-bigday">
                        <div className="fw-bigday-title fw-orangeGlow">Your Biggest Day</div>
                        <div className="fw-bigday-line fw-orangeGlow">
                          You Had The Most Steps On {prettyDate || "That Day"}
                        </div>
                        <div className="fw-bigday-steps">{stepsText || info.steps || ""}</div>
                      </div>
                    );
                  })()
                ) : String((slide as any)?.title ?? "").toLowerCase() === "top step months" ? (
                  (() => {
                    const items = extractTopStepMonths(slide);
                    return (
                      <div className="fw-topmonths">
                        <div className="fw-topmonths-title fw-orangeGlow">Top Step Months</div>

                        <div className="fw-topmonths-card">
                          <div className="fw-topmonths-list">
                            {items.map((it, idx) => (
                              <div key={idx} className="fw-topmonths-item">
                                <div className="fw-topmonths-itemLeft">
                                  <span className="fw-topmonths-rank">{idx + 1}</span>
                                  <span className="fw-topmonths-month fw-orangeGlow">{it.month}</span>
                                </div>
                                <span className="fw-topmonths-steps">{it.steps}</span>
                              </div>
                            ))}
                          </div>
                         
                        </div>

                        <div className="fw-topmonths-divider" aria-hidden="true" />

                        <div className="fw-walkWrap" aria-hidden="true">
                          <div className="fw-walkTrack">
                            <div className="fw-walk-ground" />
                            <div className="fw-walker">
                              <svg viewBox="0 0 64 64" role="img" aria-label="Walking icon">
                                {/* head */}
                                <circle cx="32" cy="14" r="6" fill="rgba(255,255,255,0.88)" />

                                {/* torso */}
                                <path
                                  d="M32 20 L32 36"
                                  stroke="rgba(255,255,255,0.88)"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />

                                {/* arms */}
                                <g className="fw-walk-arm">
                                  <path
                                    d="M32 26 L22 34"
                                    stroke="rgba(255,255,255,0.78)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                  />
                                </g>
                                <g className="fw-walk-arm fw-walk-arm--alt">
                                  <path
                                    d="M32 26 L42 34"
                                    stroke="rgba(255,255,255,0.78)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                  />
                                </g>

                                {/* legs */}
                                <g className="fw-walk-leg">
                                  <path
                                    d="M32 36 L22 52"
                                    stroke="rgba(255,255,255,0.88)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                  />
                                </g>
                                <g className="fw-walk-leg fw-walk-leg--alt">
                                  <path
                                    d="M32 36 L42 52"
                                    stroke="rgba(255,255,255,0.88)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                  />
                                </g>

                                {/* subtle glow */}
                                <circle cx="32" cy="34" r="22" fill="rgba(249, 115, 22, 0.10)" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="fw-content">
                    <SlideRenderer slide={slide} />
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

const extractTopStepMonths = (slide: any): Array<{ month: string; steps: string }> => {
  try {
    const blob = JSON.stringify(slide ?? {});

    // Match patterns like "September: 214,970" or "September 214,970" (optionally followed by "steps")
    const re = /(January|February|March|April|May|June|July|August|September|October|November|December)\s*:?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,9})\s*(?:steps)?/gi;
    const found: Array<{ month: string; steps: string }> = [];

    let m: RegExpExecArray | null;
    while ((m = re.exec(blob)) !== null) {
      const month = m[1];
      const stepsNum = new Intl.NumberFormat("en-US").format(
        Number(String(m[2]).replace(/,/g, ""))
      );
      found.push({ month, steps: `${stepsNum} Steps` });
    }

    // De-dup by month and keep the first occurrence
    const seen = new Set<string>();
    const unique = found.filter((x) => {
      const key = x.month.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, 3);
  } catch {
    return [];
  }
};

const extractBiggestDay = (slide: any): { date: string | null; steps: string | null } => {
  try {
    const blob = JSON.stringify(slide ?? {});

    const dateMatch = blob.match(/\b20\d{2}-\d{2}-\d{2}\b/);
    const dateIso = dateMatch ? dateMatch[0] : null;

    // Prefer a number that appears near "Most steps" if possible
    let steps: string | null = null;
    const nearMostSteps = blob.match(
      /most\s*steps[^\d]{0,40}([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,8})/i
    );
    if (nearMostSteps && nearMostSteps[1]) steps = nearMostSteps[1];

    // Fallback: the largest integer-looking value in the slide
    if (!steps) {
      const nums = Array.from(
        blob.matchAll(/\b[0-9]{1,3}(?:,[0-9]{3})+\b|\b[0-9]{4,8}\b/g)
      ).map((m) => m[0]);

      if (nums.length) {
        const norm = (s: string) => Number(String(s).replace(/,/g, ""));
        steps = nums.sort((a, b) => norm(b) - norm(a))[0];
      }
    }

    return { date: dateIso, steps };
  } catch {
    return { date: null, steps: null };
  }
};

const formatIsoDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
};
// Hoisted helper for extracting biggest efforts from a slide
function extractBiggestEfforts(
  slide: any
): {
  longestRunKm: number | null;
  longestRunDate: string | null;
  longestRideKm: number | null;
  longestRideDate: string | null;
  biggestWeekKm: number | null;
  biggestWeekLabel: string | null;
} {
  try {
    const blob = JSON.stringify(slide ?? {});

    const runMatch = blob.match(
      /longest\s*run[^0-9]{0,30}([0-9]+(?:\.[0-9]+)?)\s*km[^\d]{0,30}(20\d{2}-\d{2}-\d{2})/i
    );

    const rideMatch = blob.match(
      /longest\s*ride[^0-9]{0,30}([0-9]+(?:\.[0-9]+)?)\s*km[^\d]{0,30}(20\d{2}-\d{2}-\d{2})/i
    );

    const weekMatch = blob.match(
      /biggest\s*week[^0-9]{0,30}([0-9]+(?:\.[0-9]+)?)\s*km[^()]{0,40}\(([^)]+)\)/i
    );

    return {
      longestRunKm: runMatch?.[1] ? Number(runMatch[1]) : null,
      longestRunDate: runMatch?.[2] ?? null,
      longestRideKm: rideMatch?.[1] ? Number(rideMatch[1]) : null,
      longestRideDate: rideMatch?.[2] ?? null,
      biggestWeekKm: weekMatch?.[1] ? Number(weekMatch[1]) : null,
      biggestWeekLabel: weekMatch?.[2]?.trim() ?? null,
    };
  } catch {
    return {
      longestRunKm: null,
      longestRunDate: null,
      longestRideKm: null,
      longestRideDate: null,
      biggestWeekKm: null,
      biggestWeekLabel: null,
    };
  }
}

function decodePolyline(polyline: string): Array<{ lat: number; lon: number }> {
  let index = 0;
  const len = polyline.length;
  let lat = 0;
  let lon = 0;
  const coords: Array<{ lat: number; lon: number }> = [];

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += dlon;

    coords.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }

  return coords;
}

function computeBounds(points: Array<{ lat: number; lon: number }>): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} | null {
  if (!points.length) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLon = points[0].lon;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

function RouteMap({ polyline, bounds }: { polyline: string; bounds: any | null }) {
  // Strava polylines should be ASCII-ish. If the backend output got encoding-mangled,
  // strip any non-printable chars so decodePolyline doesn't fail.
  const safePolyline = String(polyline ?? "").replace(/[^\x20-\x7E]/g, "");

  let pts: Array<{ lat: number; lon: number }> = [];
  try {
    pts = decodePolyline(safePolyline);
  } catch (e) {
    // Helpful debug in dev
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("RouteMap: failed to decode polyline", {
        originalLen: String(polyline ?? "").length,
        safeLen: safePolyline.length,
        sample: safePolyline.slice(0, 32),
        err: e,
      });
    }
    pts = [];
  }

  const b =
    bounds && typeof (bounds as any).minLat === "number"
      ? (bounds as { minLat: number; maxLat: number; minLon: number; maxLon: number })
      : computeBounds(pts);

  if (!pts.length || !b) {
    return (
      <svg className="fw-routeSvg" viewBox="0 0 640 220" role="img" aria-label="Route map unavailable">
        <rect x="0" y="0" width="640" height="220" rx="18" ry="18" fill="rgba(0,0,0,0.12)" />
        <text
          x="320"
          y="114"
          textAnchor="middle"
          fontSize="16"
          fill="rgba(255,255,255,0.72)"
          fontFamily='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        >
          Route map unavailable
        </text>
      </svg>
    );
  }

  const pad = 12;
  const W = 640;
  const H = 220;

  const lonSpan = Math.max(1e-9, b.maxLon - b.minLon);
  const latSpan = Math.max(1e-9, b.maxLat - b.minLat);

  // Use the same scale for X and Y to preserve aspect ratio
  const sx = (W - pad * 2) / lonSpan;
  const sy = (H - pad * 2) / latSpan;
  const s = Math.min(sx, sy);

  const x0 = pad + (W - pad * 2 - lonSpan * s) / 2;
  const y0 = pad + (H - pad * 2 - latSpan * s) / 2;

  const toX = (lon: number) => x0 + (lon - b.minLon) * s;
  const toY = (lat: number) => y0 + (b.maxLat - lat) * s;

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.lon).toFixed(2)} ${toY(p.lat).toFixed(2)}`)
    .join(" ");

  return (
    <svg className="fw-routeSvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Route map">
      <path className="fw-routePathGlow" d={d} />
      <path className="fw-routePath" d={d} />
    </svg>
  );
}
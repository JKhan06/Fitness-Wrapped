import React from "react";
import { Slide } from "@/types/wrapped";
import HeroSlide from "@/components/slides/HeroSlide";
import InsightSlide from "@/components/slides/InsightSlide";
import ChartSlide from "@/components/slides/ChartSlide";

export default function SlideRenderer({ slide }: { slide: Slide }) {
  if (slide.type === "hero") return <HeroSlide slide={slide} />;
  if (slide.type === "insight") return <InsightSlide slide={slide} />;
  if (slide.type === "chart") return <ChartSlide slide={slide} />;

  // map reserved for later
  return (
    <div className="h-full w-full flex items-center justify-center">
      <p className="opacity-70">Unsupported slide type: {(slide as any).type}</p>
    </div>
  );
}
import React from "react";
import { InsightSlide as InsightSlideType } from "@/types/wrapped";

export default function InsightSlide({ slide }: { slide: InsightSlideType }) {
  return (
    <div className="h-full w-full flex flex-col justify-center gap-6">
      <h2 className="text-3xl md:text-5xl font-bold">{slide.title}</h2>
      <ul className="space-y-3 text-lg md:text-2xl">
        {slide.bullets.map((b, i) => (
          <li key={i} className="opacity-90">• {b}</li>
        ))}
      </ul>
    </div>
  );
}
import React from "react";
import { HeroSlide as HeroSlideType } from "@/types/wrapped";

export default function HeroSlide({ slide }: { slide: HeroSlideType }) {
  return (
    <div className="h-full w-full flex flex-col justify-center gap-6">
      <h1 className="text-4xl md:text-6xl font-bold">{slide.title}</h1>
      <div className="text-3xl md:text-5xl font-semibold">{slide.bigNumber}</div>
      <p className="text-lg md:text-xl opacity-80">{slide.subtitle}</p>
    </div>
  );
}
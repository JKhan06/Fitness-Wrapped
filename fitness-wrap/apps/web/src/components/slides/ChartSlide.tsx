import React from "react";
import { ChartSlide as ChartSlideType } from "@/types/wrapped";
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip,
} from "recharts";

export default function ChartSlide({ slide }: { slide: ChartSlideType }) {
  const common = (
    <>
      <XAxis dataKey={slide.xKey} />
      <YAxis />
      <Tooltip />
    </>
  );

  return (
    <div className="h-full w-full flex flex-col justify-center gap-6">
      <h2 className="text-3xl md:text-5xl font-bold">{slide.title}</h2>
      <div className="w-full h-[320px] md:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          {slide.chartType === "bar" ? (
            <BarChart data={slide.data}>
              {common}
              <Bar dataKey={slide.yKey} />
            </BarChart>
          ) : (
            <LineChart data={slide.data}>
              {common}
              <Line type="monotone" dataKey={slide.yKey} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
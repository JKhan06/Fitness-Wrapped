export type Slide =
  | HeroSlide
  | InsightSlide
  | ChartSlide
  | MapSlide; // reserved for later

export type HeroSlide = {
  type: "hero";
  title: string;
  bigNumber: string;
  subtitle: string;
};

export type InsightSlide = {
  type: "insight";
  title: string;
  bullets: string[];
};

export type ChartSlide = {
  type: "chart";
  title: string;
  chartType: "bar" | "line";
  data: Array<Record<string, number | string | null>>;
  xKey: string;
  yKey: string;
};

export type MapSlide = {
  type: "map";
  title: string;
  routes: any;
};

export type WrappedResponse = {
  year: number;
  headline: string;
  stats: any;
  slides: Slide[];
};
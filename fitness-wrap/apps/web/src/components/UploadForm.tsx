"use client";

import React, { useState } from "react";
import type { WrappedResponse } from "@/types/wrapped";

type Props = {
  onData: (data: WrappedResponse) => void;
};

export default function UploadForm({ onData }: Props) {
  const [year, setYear] = useState<number>(2025);
  const [appleZip, setAppleZip] = useState<File | null>(null);
  const [stravaZip, setStravaZip] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!appleZip) {
      setError("Please upload your Apple Health export zip (Health-Data.zip).");
      return;
    }

    const fd = new FormData();
    fd.append("apple_health_zip", appleZip);
    if (stravaZip) fd.append("strava_file", stravaZip);

    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/wrapped?year=${year}`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as WrappedResponse;
      onData(data);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong calling the API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm opacity-80 w-16">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value || "2025", 10))}
            className="w-32 rounded bg-black/40 border border-white/10 px-3 py-2"
            min={2000}
            max={2100}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm opacity-80">Apple Health export zip (required)</label>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setAppleZip(e.target.files?.[0] ?? null)}
            className="block"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm opacity-80">Strava export zip (optional)</label>
          <input
            type="file"
            accept=".zip,.csv"
            onChange={(e) => setStravaZip(e.target.files?.[0] ?? null)}
            className="block"
          />
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center rounded bg-white text-black px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Wrapped"}
        </button>

        <p className="text-xs opacity-60">
          Tip: Keep FastAPI running on <code>127.0.0.1:8000</code>.
        </p>
      </div>
    </form>
  );
}
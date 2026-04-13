"use client";

import { scoreColor, gradeColor } from "@/lib/utils";
import { ATSScore } from "@/lib/types";

interface ScoreRingProps {
  score: ATSScore;
  size?: number;
}

export function ScoreRing({ score, size = 140 }: ScoreRingProps) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score.overall));
  const offset = circumference - (pct / 100) * circumference;
  const color = scoreColor(pct);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#1f2937" strokeWidth={10} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold leading-none" style={{ color }}>
            {Math.round(pct)}
          </span>
          <span className="text-xs text-gray-400 mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${gradeColor(score.grade)}`}>
        Grade {score.grade}
      </span>
    </div>
  );
}

export function ScoreRingCompact({ score, size = 80 }: ScoreRingProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score.overall));
  const offset = circumference - (pct / 100) * circumference;
  const color = scoreColor(pct);
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="absolute -rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={6}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-base font-bold leading-none" style={{ color }}>
          {Math.round(pct)}
        </span>
        <span className="text-[9px] text-gray-500">ATS</span>
      </div>
    </div>
  );
}

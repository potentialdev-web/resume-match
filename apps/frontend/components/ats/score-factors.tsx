"use client";

import { ATSScoreFactor } from "@/lib/types";
import { scoreColor } from "@/lib/utils";
import {
  User,
  LayoutList,
  Hash,
  AlignLeft,
  Zap,
  BarChart2,
} from "lucide-react";

const FACTOR_ICONS: Record<string, React.ReactNode> = {
  "Contact Information": <User className="w-4 h-4" />,
  "Required Sections": <LayoutList className="w-4 h-4" />,
  "Keyword Match": <Hash className="w-4 h-4" />,
  "Formatting": <AlignLeft className="w-4 h-4" />,
  "Action Verbs": <Zap className="w-4 h-4" />,
  "Quantified Achievements": <BarChart2 className="w-4 h-4" />,
};

interface ScoreFactorsProps {
  factors: ATSScoreFactor[];
}

export function ScoreFactors({ factors }: ScoreFactorsProps) {
  return (
    <div className="space-y-3">
      {factors.map((factor) => {
        const color = scoreColor(factor.score);
        return (
          <div key={factor.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="text-gray-500">
                  {FACTOR_ICONS[factor.name] ?? <BarChart2 className="w-4 h-4" />}
                </span>
                <span className="font-medium">{factor.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{factor.description}</span>
                <span
                  className="font-bold text-xs min-w-[30px] text-right"
                  style={{ color }}
                >
                  {factor.earned.toFixed(0)}/{factor.max_score}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${factor.score}%`,
                  backgroundColor: color,
                }}
              />
            </div>

            {/* Improvement tip */}
            {factor.tip && (
              <p className="text-xs text-yellow-400/80 pl-6">{factor.tip}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

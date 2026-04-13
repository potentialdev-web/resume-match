"use client";

import { ATSScore } from "@/lib/types";
import { scoreColor, scoreLabel } from "@/lib/utils";
import { ScoreFactors } from "./score-factors";
import { KeywordChips } from "./keyword-chips";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { useState } from "react";

interface ATSScorePanelProps {
  score: ATSScore;
  baseScore?: ATSScore | null;
  className?: string;
}

export function ATSScorePanel({ score, baseScore, className = "" }: ATSScorePanelProps) {
  const [keywordsOpen, setKeywordsOpen] = useState(true);
  const color = scoreColor(score.overall);
  const improvement = baseScore ? score.overall - baseScore.overall : null;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header with ring */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">ATS Score</h3>
          {improvement !== null && improvement > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 rounded-full px-2 py-0.5">
              <TrendingUp className="w-3 h-3" />
              +{improvement.toFixed(0)} pts
            </span>
          )}
        </div>

        {/* Large score display */}
        <div className="flex items-center gap-5">
          {/* Circular indicator */}
          <div className="relative flex-shrink-0" style={{ width: 88, height: 88 }}>
            <svg width={88} height={88} className="-rotate-90 absolute inset-0">
              <circle cx={44} cy={44} r={36} fill="none" stroke="#1f2937" strokeWidth={8} />
              <circle
                cx={44}
                cy={44}
                r={36}
                fill="none"
                stroke={color}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 * (1 - score.overall / 100)}
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold leading-none" style={{ color }}>
                {Math.round(score.overall)}
              </span>
              <span className="text-[10px] text-gray-500 mt-0.5">/ 100</span>
            </div>
          </div>

          {/* Score details */}
          <div className="flex-1">
            <p className="text-lg font-bold" style={{ color }}>
              Grade {score.grade}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{scoreLabel(score.overall)}</p>
            {baseScore && (
              <p className="text-xs text-gray-500 mt-2">
                Base score: {Math.round(baseScore.overall)}/100
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Score Breakdown
        </h4>
        <ScoreFactors factors={score.factors} />
      </div>

      {/* Keyword analysis */}
      {score.total_keywords > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <button
            onClick={() => setKeywordsOpen(!keywordsOpen)}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4"
          >
            <span>Keywords ({score.keyword_match_pct.toFixed(0)}% match)</span>
            {keywordsOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {keywordsOpen && (
            <KeywordChips
              matched={score.matched_keywords}
              missing={score.missing_keywords}
            />
          )}
        </div>
      )}
    </div>
  );
}

"use client";

interface KeywordChipsProps {
  matched: string[];
  missing: string[];
}

export function KeywordChips({ matched, missing }: KeywordChipsProps) {
  const all = [
    ...matched.map((k) => ({ keyword: k, matched: true })),
    ...missing.map((k) => ({ keyword: k, matched: false })),
  ];

  if (all.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No keywords extracted. Upload a job description to see keyword matching.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {matched.length} matched
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          {missing.length} missing
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {all.map(({ keyword, matched: isMatched }) => (
          <span
            key={keyword}
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              isMatched
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}

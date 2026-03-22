"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

export type SearchResult =
  | {
      type: "student";
      id: string;
      name: string;
      email: string;
    }
  | {
      type: "application";
      id: string;
      studentName: string;
      universityName: string;
    }
  | {
      type: "lead";
      id: string;
      name: string;
      email: string;
    }
  | {
      type: "university";
      id: string;
      name: string;
      country: string;
    };

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // close on outside click or escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // fire search 400ms after user stops typing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setOpen(true);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      }
    }, 400);
  }, [query]);

  const renderResult = (r: SearchResult) => {
    switch (r.type) {
      case "student":
        return (
          <span>
            {r.name} <span className="text-xs text-gray-500">({r.email}, ID: {r.id})</span>
          </span>
        );
      case "application":
        return (
          <span>
            {r.id} &middot; {r.studentName} - {r.universityName}
          </span>
        );
      case "lead":
        return (
          <span>
            {r.name} <span className="text-xs text-gray-500">({r.email})</span>
          </span>
        );
      case "university":
        return (
          <span>
            {r.name} <span className="text-xs text-gray-500">({r.country})</span>
          </span>
        );
    }
  };

  const getHref = (r: SearchResult) => {
    switch (r.type) {
      case "student":
        return `/dashboard/students/${r.id}`;
      case "application":
        return `/dashboard/applications/${r.id}`;
      case "lead":
        return `/dashboard/leads`;
      case "university":
        return `/dashboard/universities`;
    }
  };

  return (
    <div ref={containerRef} className="relative w-64">
      <input
        type="text"
        className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && setOpen(true)}
      />
      {open && (
        <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-60 overflow-auto">
          {results.length === 0 ? (
            <div className="p-2 text-sm text-gray-500">No results found</div>
          ) : (
            results.map((r, idx) => (
              <Link
                key={`${r.type}-${r.id}-${idx}`}
                href={getHref(r) || "/"}
                className="block px-3 py-2 text-sm hover:bg-gray-100"
                onClick={() => setOpen(false)}
              >
                {renderResult(r)}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

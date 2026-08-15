"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import type { City } from "./types";

interface CityAutocompleteProps {
  city: City | null;
  onChange: (city: City | null) => void;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
  };
}

export default function CityAutocomplete({ city, onChange }: CityAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function startEditing() {
    if (!city) return;
    setQuery(city.name);
    setIsEditing(true);
    setIsOpen(true);
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({
          format: "json",
          q: trimmed,
          featuretype: "settlement",
          addressdetails: "1",
          limit: "6",
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const data: NominatimResult[] = await res.json();

        const mapped: City[] = data.map((item) => {
          const short =
            item.address?.city || item.address?.town || item.address?.village || item.display_name.split(",")[0];
          const country = item.address?.country;
          return {
            id: String(item.place_id),
            name: short,
            label: country ? `${short}, ${country}` : item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          };
        });

        const seenLabels = new Set<string>();
        const deduped = mapped.filter((result) => {
          const key = result.label.toLowerCase();
          if (seenLabels.has(key)) return false;
          seenLabels.add(key);
          return true;
        });

        setResults(deduped);
        setHighlightedIndex(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  function selectCity(selected: City) {
    onChange(selected);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setIsEditing(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setIsEditing(false);
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex >= 0) selectCity(results[highlightedIndex]);
    }
  }

  if (city && !isEditing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={startEditing}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
        className="flex h-[46px] w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white px-4 transition hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-500/50"
      >
        <MapPin className="size-4.5 shrink-0 text-violet-600 dark:text-violet-400" strokeWidth={2.25} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {city.label}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
          aria-label={`Retirer ${city.name}`}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher une ville (ex : Lisbonne, Kyoto...)"
          className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-500 dark:focus:ring-violet-500/10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3.5 top-1/2 size-4.5 -translate-y-1/2 animate-spin text-violet-500" />
        )}
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-black/5 dark:border-zinc-700 dark:bg-zinc-900">
          {results.length === 0 && !isLoading && (
            <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">Aucune ville trouvée</p>
          )}
          {results.map((result, index) => (
            <button
              key={result.id}
              type="button"
              onClick={() => selectCity(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition ${
                index === highlightedIndex
                  ? "bg-violet-50 dark:bg-violet-500/10"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }`}
            >
              <MapPin className="size-4 shrink-0 text-violet-500" />
              <span className="truncate text-zinc-700 dark:text-zinc-200">{result.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

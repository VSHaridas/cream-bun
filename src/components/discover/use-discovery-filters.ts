"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  type DiscoveryFilters,
  type SortId,
} from "@/lib/search/engine";
import type { AspectRatioId, Availability, ContentType, SignalKind } from "@/lib/domain/types";

type ListKey = keyof Pick<
  DiscoveryFilters,
  | "skills"
  | "specializations"
  | "tools"
  | "contentTypes"
  | "aspectRatios"
  | "verification"
  | "availability"
  | "regions"
  | "languages"
>;

export function useDiscoveryFilters(): {
  filters: DiscoveryFilters;
  set: (patch: Partial<DiscoveryFilters>) => void;
  toggle: (key: ListKey, value: string) => void;
  toggleList: (key: ListKey, value: string) => void;
  clear: (key?: ListKey) => void;
  resetAll: () => void;
  isActive: (key: ListKey, value: string) => boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = React.useMemo<DiscoveryFilters>(() => {
    const read = (key: ListKey) => params.get(key)?.split(",").filter(Boolean) ?? [];
    return {
      q: params.get("q") ?? "",
      skills: read("skills"),
      specializations: read("specializations"),
      tools: read("tools"),
      contentTypes: read("contentTypes") as ContentType[],
      aspectRatios: read("aspectRatios") as AspectRatioId[],
      verification: read("verification") as SignalKind[],
      availability: read("availability") as Availability[],
      regions: read("regions"),
      languages: read("languages"),
      maxDayRate: params.get("rate") ? Number(params.get("rate")) : null,
      maxTurnaround: params.get("turnaround") ? Number(params.get("turnaround")) : null,
      minRating: params.get("rating") ? Number(params.get("rating")) : 0,
      onlyVerifiedTools: params.get("vt") === "1",
      sort: (params.get("sort") as SortId) ?? "relevance",
    };
  }, [params]);

  const commit = React.useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const write = React.useCallback(
    (patch: Partial<DiscoveryFilters>) => {
      const next = new URLSearchParams(params.toString());
      const put = (key: string, value: string | null) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      };
      for (const [key, value] of Object.entries(patch)) {
        if (Array.isArray(value)) put(key, value.join(","));
        else if (value === null) put(key, null);
        else put(key, String(value));
      }
      commit(next);
    },
    [params, commit],
  );

  return {
    filters,
    set: write,
    toggle: (key, value) => {
      const current = (filters[key] as string[]) ?? [];
      write({
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      } as Partial<DiscoveryFilters>);
    },
    toggleList: (key, value) => {
      const current = (filters[key] as string[]) ?? [];
      write({
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      } as Partial<DiscoveryFilters>);
    },
    isActive: (key, value) => ((filters[key] as string[]) ?? []).includes(value),
    clear: (key) => {
      if (!key) {
        commit(new URLSearchParams());
        return;
      }
      const next = new URLSearchParams(params.toString());
      next.delete(key);
      commit(next);
    },
    resetAll: () => commit(new URLSearchParams()),
  };
}

export { EMPTY_FILTERS, SORT_OPTIONS };
export type { ListKey };
import { Shimmer } from "@/components/ui/primitives";

export function Skimmer() {
  return (
    <div className="container-x pb-24 pt-16">
      <div className="mb-10 max-w-3xl space-y-4">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-12 w-full max-w-xl" />
        <Shimmer className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[268px_1fr] lg:gap-12">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-80 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
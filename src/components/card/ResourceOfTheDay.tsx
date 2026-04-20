/**
 * Resource of the Day — surfaces one nearby/relevant community partner.
 *
 * Picks deterministically based on the day-of-year so the same resource shows
 * for the whole day. Reads from `community_partners` (approved + available).
 * Lightweight standalone query — not in the clinical summary because it's
 * not participant-specific data.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ChevronRight, MapPin } from "lucide-react";

const ResourceOfTheDay = () => {
  const { data: partner, isLoading } = useQuery({
    queryKey: ["resource-of-the-day", new Date().toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_partners")
        .select("id, name, type, description, city, state, services_offered")
        .eq("is_approved", true)
        .order("name", { ascending: true });
      if (!data || data.length === 0) return null;
      // Day-of-year deterministic index → same resource all day
      const start = new Date(new Date().getFullYear(), 0, 0);
      const diff = Number(new Date()) - Number(start);
      const day = Math.floor(diff / (1000 * 60 * 60 * 24));
      return data[day % data.length];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading || !partner) {
    return null;
  }

  const location = [partner.city, partner.state].filter(Boolean).join(", ");

  return (
    <Link
      to={`/resources/${partner.id}`}
      className="block bg-card border border-border rounded-xl p-4 space-y-2 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        <p className="text-xs font-semibold text-accent uppercase tracking-wide">
          Resource of the Day
        </p>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-foreground truncate">{partner.name}</p>
          {partner.type && (
            <p className="text-xs text-muted-foreground capitalize">
              {partner.type.replace(/_/g, " ")}
            </p>
          )}
          {location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {location}
            </p>
          )}
          {partner.description && (
            <p className="text-sm text-foreground mt-2 line-clamp-2">
              {partner.description}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" aria-hidden />
      </div>
    </Link>
  );
};

export default ResourceOfTheDay;

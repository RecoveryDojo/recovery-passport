import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Globe, MapPin, AlertTriangle } from "lucide-react";
import { differenceInDays, format } from "date-fns";

const TYPE_COLORS: Record<string, string> = {
  housing: "bg-blue-100 text-blue-700",
  food: "bg-green-100 text-green-700",
  employment: "bg-purple-100 text-purple-700",
  legal: "bg-amber-100 text-amber-700",
  mental_health: "bg-pink-100 text-pink-700",
  medical: "bg-red-100 text-red-700",
  transportation: "bg-cyan-100 text-cyan-700",
  education: "bg-indigo-100 text-indigo-700",
  benefits: "bg-orange-100 text-orange-700",
  other: "bg-muted text-muted-foreground",
};

const ResourceDetailPage = () => {
  const { resourceId } = useParams<{ resourceId: string }>();

  const { data: resource, isLoading } = useQuery({
    queryKey: ["community-partner", resourceId],
    enabled: !!resourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_partners")
        .select("*")
        .eq("id", resourceId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>;
  }

  if (!resource) {
    return (
      <div className="px-4 pt-6 max-w-lg mx-auto text-center">
        <p className="text-muted-foreground">Resource not found.</p>
        <Link to="/resources"><Button variant="link">← Back to Resources</Button></Link>
      </div>
    );
  }

  const typeColor = TYPE_COLORS[resource.type ?? "other"] ?? TYPE_COLORS.other;
  const typeLabel = (resource.type ?? "other").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const daysSinceUpdate = differenceInDays(new Date(), new Date(resource.last_updated_at));
  const isStale = daysSinceUpdate > 30;
  const fullAddress = [resource.address, resource.city, resource.state, resource.zip].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <Link to="/resources">
        <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Resources</Button>
      </Link>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {resource.logo_url && (
            <img src={resource.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{resource.name}</h1>
            <Badge className={`${typeColor} border-0 text-xs mt-1`}>{typeLabel}</Badge>
          </div>
        </div>

        {/* Services */}
        {resource.services_offered && resource.services_offered.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Services Offered</p>
            <div className="flex flex-wrap gap-1">
              {resource.services_offered.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Address */}
        {fullAddress && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm text-primary hover:underline">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
            {fullAddress}
          </a>
        )}

        {/* Phone */}
        {resource.phone && (
          <a href={`tel:${resource.phone}`} className="flex items-center gap-2 text-sm text-primary font-medium">
            <Phone className="h-4 w-4" /> {resource.phone}
          </a>
        )}

        {/* Website */}
        {resource.website && (
          <a href={resource.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Globe className="h-4 w-4" /> {resource.website}
          </a>
        )}

        {/* Description */}
        {resource.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">About</p>
            <p className="text-sm text-foreground whitespace-pre-line">{resource.description}</p>
          </div>
        )}

        {/* Availability */}
        {resource.availability_status && (
          <div className="bg-primary/5 rounded-lg p-3">
            <p className="text-sm text-foreground">{resource.availability_status}</p>
          </div>
        )}

        {/* Stale warning */}
        {isStale && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              ⚠️ This listing may be outdated (last updated {format(new Date(resource.last_updated_at), "MMM d, yyyy")}) — contact directly to confirm availability.
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Last updated: {format(new Date(resource.last_updated_at), "MMM d, yyyy")}
        </p>
      </div>
    </div>
  );
};

export default ResourceDetailPage;

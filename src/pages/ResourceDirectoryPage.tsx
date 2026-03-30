import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Phone, ChevronRight, MapPin, Send } from "lucide-react";
import { toast } from "sonner";

const TYPE_OPTIONS = [
  "All", "Housing", "Food", "Employment", "Legal", "Mental Health",
  "Medical", "Transportation", "Education", "Benefits", "Other",
];

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

const ResourceDirectoryPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [requestPartner, setRequestPartner] = useState<any>(null);
  const [requestNote, setRequestNote] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-participant-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("id, first_name, last_name, assigned_peer_id")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  const { data: peerProfile } = useQuery({
    queryKey: ["assigned-peer-name", profile?.assigned_peer_id],
    enabled: !!profile?.assigned_peer_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("first_name, last_name")
        .eq("user_id", profile!.assigned_peer_id!)
        .single();
      return data;
    },
  });

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["community-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_partners")
        .select("*")
        .eq("is_approved", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.assigned_peer_id || !requestPartner) throw new Error("No peer assigned");
      const participantName = `${profile.first_name} ${profile.last_name}`.trim();
      const body = `${participantName} is interested in ${requestPartner.name} as their next placement.${requestNote.trim() ? ` Note: "${requestNote.trim()}"` : ""}`;

      const { error } = await supabase.from("notifications").insert({
        user_id: profile.assigned_peer_id,
        type: "general" as any,
        title: `Transition Request from ${participantName}`,
        body,
        related_type: "community_partners",
        related_id: requestPartner.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRequestPartner(null);
      setRequestNote("");
      setShowConfirmation(true);
    },
    onError: () => toast.error("Failed to send request"),
  });

  const filtered = resources.filter((r) => {
    const matchesSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.services_offered?.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "All" || r.type === typeFilter.toLowerCase().replace(/ /g, "_");
    return matchesSearch && matchesType;
  });

  const peerName = peerProfile ? `${peerProfile.first_name} ${peerProfile.last_name}`.trim() : "your peer specialist";

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Resources</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search resources..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading resources…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">No resources match your search. Try a different category.</p>
        </div>
      ) : (
        filtered.map((r) => {
          const typeColor = TYPE_COLORS[r.type ?? "other"] ?? TYPE_COLORS.other;
          const typeLabel = (r.type ?? "other").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{r.name}</p>
                  <Badge className={`${typeColor} border-0 text-[10px] mt-1`}>{typeLabel}</Badge>
                </div>
              </div>

              {(r.address || r.city) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {[r.address, r.city, r.state, r.zip].filter(Boolean).join(", ")}
                </p>
              )}

              {r.phone && (
                <a href={`tel:${r.phone}`} className="text-xs text-primary font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {r.phone}
                </a>
              )}

              {r.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
              )}

              <div className="flex gap-2">
                <Link to={`/resources/${r.id}`}>
                  <Button variant="ghost" size="sm" className="text-primary px-0 h-auto text-xs">
                    View Details <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </Link>
                {profile?.assigned_peer_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1 ml-auto border-accent text-accent"
                    onClick={() => { setRequestPartner(r); setRequestNote(""); }}
                  >
                    <Send className="h-3 w-3 mr-1" /> Request as Next Placement
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Request dialog */}
      <Dialog open={!!requestPartner} onOpenChange={(open) => { if (!open) setRequestPartner(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Next Placement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              You're interested in <strong>{requestPartner?.name}</strong> as your next step. This will notify your peer specialist.
            </p>
            <Textarea
              placeholder="Add a note for your peer specialist (why this placement?)"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              rows={3}
            />
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={requestMutation.isPending}
              onClick={() => requestMutation.mutate()}
            >
              {requestMutation.isPending ? "Sending…" : "Send to My Peer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-3 py-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Request Sent!</h3>
            <p className="text-sm text-muted-foreground">
              Your request has been sent to {peerName}. They'll review and initiate the referral.
            </p>
            <Button onClick={() => setShowConfirmation(false)} className="bg-primary hover:bg-primary/90">
              Got It
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResourceDirectoryPage;

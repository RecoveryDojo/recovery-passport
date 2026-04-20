import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLogMood } from "@/hooks/use-log-mood";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MoodWidgetProps {
  participantId: string;
  participantUserId: string;
  participantName: string;
}

const MOODS = [
  { value: 1, emoji: "😣", label: "Crisis" },
  { value: 2, emoji: "😕", label: "Struggling" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Thriving" },
];

const MoodWidget = ({ participantId, participantUserId, participantName }: MoodWidgetProps) => {
  const [selected, setSelected] = useState<number | null>(null);

  // Last 7 days of mood entries — for streak dots
  const { data: recent = [] } = useQuery({
    queryKey: ["today-mood", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data } = await supabase
        .from("weekly_checkins")
        .select("mood_status, checkin_date")
        .eq("participant_id", participantId)
        .gte("checkin_date", sevenDaysAgo.toISOString().slice(0, 10))
        .order("checkin_date", { ascending: false });
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = recent.some((r) => r.checkin_date === today);

  const mutation = useLogMood({
    onSuccess: () => toast.success("Mood logged 💛"),
    onError: (err) => toast.error(err.message || "Failed to log mood"),
  });

  const handleTap = (value: number) => {
    if (loggedToday || mutation.isPending) return;
    setSelected(value);
    mutation.mutate({
      participantId,
      participantName,
      participantUserId,
      moodScore: value,
    });
  };

  // Build last-7-day strip (oldest → newest)
  const days: (number | null)[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const match = recent.find((r) => r.checkin_date === key);
    days.push(match?.mood_status ?? null);
  }

  const dotColor = (m: number | null) => {
    if (m == null) return "bg-muted";
    if (m <= 2) return "bg-red-500";
    if (m === 3) return "bg-amber-500";
    return "bg-green-600";
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">How are you today?</p>
        {loggedToday && (
          <span className="text-xs text-muted-foreground">Logged ✓</span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => handleTap(m.value)}
            disabled={loggedToday || mutation.isPending}
            aria-label={m.label}
            className={cn(
              "aspect-square rounded-lg flex items-center justify-center text-2xl transition-all",
              loggedToday
                ? "bg-muted/30 opacity-60 cursor-not-allowed"
                : "bg-muted hover:bg-accent/20 active:scale-95",
              selected === m.value && "ring-2 ring-accent"
            )}
          >
            {m.emoji}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 pt-1">
        <span className="text-[10px] text-muted-foreground mr-1">7d:</span>
        {days.map((m, i) => (
          <span
            key={i}
            className={cn("h-2 w-2 rounded-full", dotColor(m))}
            aria-label={m == null ? "no entry" : `mood ${m}`}
          />
        ))}
      </div>
    </div>
  );
};

export default MoodWidget;

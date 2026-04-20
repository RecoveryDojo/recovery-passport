import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Heart, AlertCircle, Share2, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import MoodWidget from "./MoodWidget";

interface QuickActionFabProps {
  participantId: string;
  participantUserId: string;
  participantName: string;
  hasPeer: boolean;
}

const QuickActionFab = ({
  participantId,
  participantUserId,
  participantName,
  hasPeer,
}: QuickActionFabProps) => {
  const [open, setOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col gap-2 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <ActionButton
              icon={<Heart className="h-4 w-4" />}
              label="Log how I feel"
              onClick={() => {
                setMoodOpen(true);
                setOpen(false);
              }}
            />
            <ActionLink
              icon={<AlertCircle className="h-4 w-4" />}
              label="Crisis resources"
              to="/resources"
              onClick={() => setOpen(false)}
            />
            <ActionLink
              icon={<Share2 className="h-4 w-4" />}
              label="Share my passport"
              to="/passport"
              onClick={() => setOpen(false)}
            />
            <ActionButton
              icon={<MessageCircle className="h-4 w-4" />}
              label={hasPeer ? "Message my peer (soon)" : "Find a peer"}
              disabled={hasPeer}
              onClick={() => {
                setOpen(false);
                if (!hasPeer) window.location.href = "/peers/browse";
              }}
            />
          </div>
        )}
        <button
          type="button"
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-xl flex items-center justify-center transition-transform",
            open && "rotate-45"
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      {/* Mood sheet */}
      <Sheet open={moodOpen} onOpenChange={setMoodOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Quick mood check</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <MoodWidget
              participantId={participantId}
              participantUserId={participantUserId}
              participantName={participantName}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const ActionButton = ({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-4 py-2 shadow-md text-sm font-medium text-foreground",
      disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-muted"
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const ActionLink = ({
  icon,
  label,
  to,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
  onClick?: () => void;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-4 py-2 shadow-md text-sm font-medium text-foreground hover:bg-muted"
  >
    {icon}
    <span>{label}</span>
  </Link>
);

export default QuickActionFab;

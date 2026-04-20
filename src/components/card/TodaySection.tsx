import MoodWidget from "./MoodWidget";
import TodayFocusCard from "./TodayFocusCard";
import NextMilestonePreview from "./NextMilestonePreview";

interface TodaySectionProps {
  participantId: string;
  participantUserId: string;
  participantName: string;
}

const TodaySection = ({
  participantId,
  participantUserId,
  participantName,
}: TodaySectionProps) => {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground px-1">Today</h2>
      <MoodWidget
        participantId={participantId}
        participantUserId={participantUserId}
        participantName={participantName}
      />
      <TodayFocusCard participantId={participantId} />
      <NextMilestonePreview participantId={participantId} />
    </section>
  );
};

export default TodaySection;

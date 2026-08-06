import { ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PacketSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible, read-only section of the intake packet.
 * Always expanded when printing (print:block on the body).
 */
export default function PacketSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: PacketSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="p-4 print:break-before-page print:shadow-none print:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between text-left gap-3"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="print:hidden text-muted-foreground mt-0.5">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      <div className={`${open ? "block" : "hidden"} print:block mt-3`}>{children}</div>
    </Card>
  );
}

export function Field({ label, value }: { label: string; value?: ReactNode }) {
  const empty =
    value === null || value === undefined || value === "" || value === false;
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">
        {empty ? <span className="text-muted-foreground">Not provided</span> : value}
      </div>
    </div>
  );
}

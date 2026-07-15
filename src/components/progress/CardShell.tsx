import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Shared visual wrapper for every progress card so cards focus on their
 * chart/content rather than chrome.
 */
const CardShell = ({ title, subtitle, children }: Props) => (
  <Card>
    <CardContent className="p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </CardContent>
  </Card>
);

export default CardShell;

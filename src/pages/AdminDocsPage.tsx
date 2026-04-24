import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, BookOpen, Network, ListChecks, Layers, Workflow, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// Bundle markdown source at build time
import taskPlaybookMd from "../../docs/task-playbook.md?raw";
import inventoryMd from "../../docs/training-coverage-inventory.md?raw";
import matrixMd from "../../docs/training-coverage-matrix.md?raw";
import systemEventMapMd from "../../docs/system-event-map.md?raw";
import interdepMd from "../../docs/interdependency-map.md?raw";
import roleSurfaceMd from "../../docs/role-surface-matrix.md?raw";
import ladderMd from "../../docs/recovery-capital-ladder.md?raw";

type DocEntry = {
  id: string;
  title: string;
  blurb: string;
  group: "Playbooks" | "Training" | "Reference";
  icon: React.ComponentType<{ className?: string }>;
  source: string;
};

const DOCS: DocEntry[] = [
  {
    id: "task-playbook",
    title: "Task Playbook",
    blurb: "Step-by-step staff training: one job per task, by role.",
    group: "Playbooks",
    icon: ClipboardList,
    source: taskPlaybookMd,
  },
  {
    id: "training-coverage-inventory",
    title: "Training Coverage Inventory",
    blurb: "Master list of every action, surface, and state per role.",
    group: "Training",
    icon: ListChecks,
    source: inventoryMd,
  },
  {
    id: "training-coverage-matrix",
    title: "Training Coverage Matrix",
    blurb: "4-layer gating checklist all training material must pass.",
    group: "Training",
    icon: Layers,
    source: matrixMd,
  },
  {
    id: "system-event-map",
    title: "System Event Map",
    blurb: "Engineering / audit reference — what fires when an event happens.",
    group: "Reference",
    icon: Workflow,
    source: systemEventMapMd,
  },
  {
    id: "role-surface-matrix",
    title: "Role / Surface Matrix",
    blurb: "Which screens belong to participants, peers, and admins.",
    group: "Reference",
    icon: BookOpen,
    source: roleSurfaceMd,
  },
  {
    id: "interdependency-map",
    title: "Interdependency Map",
    blurb: "Cross-role handoffs and how data flows between actors.",
    group: "Reference",
    icon: Network,
    source: interdepMd,
  },
  {
    id: "recovery-capital-ladder",
    title: "Recovery Capital Ladder",
    blurb: "Domain levels, scoring, and progression model.",
    group: "Reference",
    icon: FileText,
    source: ladderMd,
  },
];

export default function AdminDocsPage() {
  const [activeId, setActiveId] = useState<string>(DOCS[0].id);
  const active = useMemo(() => DOCS.find((d) => d.id === activeId)!, [activeId]);

  const handleDownload = () => {
    const blob = new Blob([active.source], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const grouped = DOCS.reduce<Record<string, DocEntry[]>>((acc, d) => {
    (acc[d.group] ||= []).push(d);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <header className="mb-6 print:hidden">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Documentation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Training coverage materials and platform reference docs.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="print:hidden">
            <Card className="overflow-hidden">
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <nav className="p-3">
                  {Object.entries(grouped).map(([group, items]) => (
                    <div key={group} className="mb-4 last:mb-0">
                      <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group}
                      </div>
                      <ul className="space-y-1">
                        {items.map((d) => {
                          const Icon = d.icon;
                          const isActive = d.id === activeId;
                          return (
                            <li key={d.id}>
                              <button
                                onClick={() => setActiveId(d.id)}
                                className={cn(
                                  "group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                                  isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground hover:bg-muted"
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "mt-0.5 h-4 w-4 shrink-0",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                  )}
                                />
                                <div className="min-w-0">
                                  <div className="truncate font-medium leading-tight">
                                    {d.title}
                                  </div>
                                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {d.blurb}
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </nav>
              </ScrollArea>
            </Card>
          </aside>

          {/* Content */}
          <main>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-6 py-4 print:hidden">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {active.group}
                  </div>
                  <h2 className="mt-0.5 text-xl font-semibold text-foreground">
                    {active.title}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    Print / Save PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    Download .md
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[calc(100vh-16rem)] print:h-auto">
                <article className="prose-doc px-6 py-8 lg:px-10">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {active.source}
                  </ReactMarkdown>
                </article>
              </ScrollArea>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}

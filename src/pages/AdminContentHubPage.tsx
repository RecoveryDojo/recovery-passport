import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trophy,
  MessageSquareQuote,
  ShieldAlert,
  FileText,
  ClipboardList,
  MapPin,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  Building2,
  LibraryBig,
} from "lucide-react";

const SECTIONS = [
  {
    title: "Programs",
    description: "Manage the programs (respite, sober living, treatment, outpatient) participants can be enrolled in.",
    to: "/admin/content/programs",
    icon: Building2,
  },
  {
    title: "Milestones",
    description: "Manage the milestones participants earn and how they map to card levels.",
    to: "/admin/content/milestones",
    icon: Trophy,
  },
  {
    title: "Assessment Rubric",
    description: "Manage the 10 recovery capital domains and their level descriptions.",
    to: "/admin/content/assessment",
    icon: ClipboardCheck,
  },
  {
    title: "MI Prompt Library",
    description: "Curate motivational interviewing prompts peers see during check-ins.",
    to: "/admin/content/mi-prompts",
    icon: MessageSquareQuote,
  },
  {
    title: "Recovery Plan Templates",
    description: "Manage the default and domain-triggered steps used to generate plans.",
    to: "/admin/content/plan-templates",
    icon: ClipboardList,
  },
  {
    title: "Note Templates",
    description: "Edit the guiding prompts peers see for each note type.",
    to: "/admin/content/note-templates",
    icon: FileText,
  },
  {
    title: "Crisis Protocol",
    description: "Edit the quick-reference crisis protocol shown to peers.",
    to: "/admin/content/crisis-protocol",
    icon: ShieldAlert,
  },
  {
    title: "Program Agreements",
    description: "Manage the program agreements participants review and acknowledge.",
    to: "/admin/content/agreements",
    icon: FileSignature,
  },
  {
    title: "Resource Listings",
    description: "Manage the community partner directory shown to participants and peers.",
    to: "/admin/content/resources",
    icon: MapPin,
  },
];

const AdminContentHubPage = () => {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Content Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the content participants and peers see across the app.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ title, description, to, icon: Icon }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full border-border hover:border-primary/40 hover:shadow-sm transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-base font-semibold text-foreground mt-3">
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminContentHubPage;

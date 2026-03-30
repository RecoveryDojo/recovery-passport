import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, ChevronDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const DemoControls = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const invoke = async (action: "seed" | "clear") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-seed", { body: { action } });
      if (error) throw error;
      toast({
        title: action === "seed" ? "Demo data loaded" : "Demo data cleared",
        description: data?.message || "Done",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-8">
      <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
        <Settings className="h-4 w-4" />
        <span>Demo Controls (admin only)</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 p-4 border border-border rounded-lg bg-muted/30 space-y-3">
        <p className="text-xs text-muted-foreground">
          Load realistic demo data for presentations. Creates 4 participants and 2 peer specialists with full history.
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => invoke("seed")}
            disabled={loading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Load Demo Data
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={loading}>Clear Demo Data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all demo participants, peer specialists, and their associated records. Structural data (programs, milestones, templates) will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => invoke("clear")}>Clear Demo Data</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default DemoControls;

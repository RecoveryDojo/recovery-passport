import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Check, Eraser, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SignatureCanvasProps {
  sessionId: string;
  formType: string;
  role: "participant" | "witness";
  label: string;
  onAccepted: (storagePath: string) => void;
  accepted?: boolean;
  acceptedPath?: string | null;
}

export function SignatureCanvas({
  sessionId,
  formType,
  role,
  label,
  onAccepted,
  accepted = false,
  acceptedPath = null,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1A4A4A";
  }, [accepted]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (accepted) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true;
      setHasStroke(true);
    }
  };

  const onPointerUp = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
    setHasStroke(false);
  };

  const accept = async () => {
    if (!hasStroke || uploading) return;
    setUploading(true);
    try {
      const canvas = canvasRef.current!;
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to render signature"))),
          "image/png"
        );
      });
      const path = `intake/${sessionId}/${formType}_${role}_${Date.now()}.png`;
      const { error } = await supabase.storage
        .from("signatures")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      onAccepted(path);
      toast.success("Signature saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save signature");
    } finally {
      setUploading(false);
    }
  };

  if (accepted) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="border border-border rounded-lg p-4 bg-muted/40 flex items-center gap-2 text-sm text-primary">
          <Check className="h-4 w-4" />
          Signature captured
          {acceptedPath ? (
            <span className="ml-auto text-xs text-muted-foreground truncate max-w-[50%]">
              {acceptedPath.split("/").pop()}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="border border-border rounded-lg bg-background">
        <canvas
          ref={canvasRef}
          className="w-full touch-none rounded-lg"
          style={{ height: 160 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={!hasStroke || uploading}
        >
          <Eraser className="h-4 w-4 mr-1" /> Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={accept}
          disabled={!hasStroke || uploading}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          Accept
        </Button>
      </div>
    </div>
  );
}

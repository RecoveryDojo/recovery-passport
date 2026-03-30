import { toast } from "@/hooks/use-toast";

/**
 * Wraps a Supabase mutation to handle offline scenarios gracefully.
 * If the device is offline, shows a toast and returns false.
 * Use before any form submission that writes to the database.
 */
export const guardOffline = (): boolean => {
  if (!navigator.onLine) {
    toast({
      title: "You're offline",
      description: "This action requires a connection. We'll retry when you're back online.",
      variant: "destructive",
    });
    return false; // caller should abort
  }
  return true;
};

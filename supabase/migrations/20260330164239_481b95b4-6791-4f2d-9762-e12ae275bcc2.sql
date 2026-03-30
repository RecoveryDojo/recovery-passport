-- Add 'cancelled' to peer_request_status enum
ALTER TYPE public.peer_request_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Allow participants to update their own pending requests (to cancel them)
CREATE POLICY "Peer requests: participant cancel own"
ON public.peer_requests
FOR UPDATE
TO public
USING (participant_id = get_participant_profile_id() AND status = 'pending'::peer_request_status)
WITH CHECK (participant_id = get_participant_profile_id());
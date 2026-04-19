-- Enum for how the peer contacted the participant during the check-in
CREATE TYPE public.checkin_contact_mode AS ENUM (
  'in_person',
  'phone',
  'text',
  'app_message',
  'no_contact'
);

-- Add the two new optional columns to weekly_checkins
ALTER TABLE public.weekly_checkins
  ADD COLUMN contact_mode public.checkin_contact_mode,
  ADD COLUMN discussed_plan boolean;
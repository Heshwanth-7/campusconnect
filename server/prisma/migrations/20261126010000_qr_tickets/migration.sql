BEGIN;
ALTER TABLE "Registration"
  ADD COLUMN "qrNonce" UUID,
  ADD COLUMN "checkedInAt" TIMESTAMPTZ(3);

UPDATE "Registration" SET "qrNonce" = gen_random_uuid() WHERE status = 'CONFIRMED';

-- Runs once per row, including each student in a bulk waitlist promotion.
CREATE FUNCTION registration_ticket_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW."qrNonce" := CASE WHEN NEW.status = 'CONFIRMED' THEN gen_random_uuid() END;
    NEW."checkedInAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER registration_ticket_transition
  BEFORE INSERT OR UPDATE OF status ON "Registration"
  FOR EACH ROW EXECUTE FUNCTION registration_ticket_transition();
COMMIT;

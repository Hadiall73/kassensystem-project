-- Reservierungen Tabelle
-- In Supabase SQL-Editor ausführen

CREATE TABLE IF NOT EXISTS pos_reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name   TEXT NOT NULL,
  guest_phone  TEXT,
  guest_count  INTEGER NOT NULL DEFAULT 2,
  table_id     UUID REFERENCES pos_tables(id) ON DELETE SET NULL,
  table_number INTEGER,
  date         DATE NOT NULL,
  time         TIME NOT NULL,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled', 'arrived')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_date ON pos_reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_table ON pos_reservations(table_id);

-- Außer Haus Spalte zu Bestellungen hinzufügen
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN DEFAULT FALSE;

-- RLS aktivieren
ALTER TABLE pos_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on reservations"
  ON pos_reservations FOR ALL
  TO service_role USING (true) WITH CHECK (true);

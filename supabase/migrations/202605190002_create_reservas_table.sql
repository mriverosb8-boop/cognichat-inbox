CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id),
  conversation_id UUID REFERENCES conversations(id),

  titular_nombre TEXT NOT NULL,
  cedula TEXT NOT NULL,
  correo TEXT NOT NULL,
  notas TEXT,

  status TEXT NOT NULL DEFAULT 'pendiente',
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  processed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_reservas_hotel_status
ON reservas(hotel_id, status);

CREATE INDEX IF NOT EXISTS idx_reservas_quote_request
ON reservas(quote_request_id);

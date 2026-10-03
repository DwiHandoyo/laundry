-- Invariant #4 dan #5 dari docs/03-data-model.md
-- Ditegakkan di lapisan database, bukan hanya di lapisan service.

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" >= 1);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_amounts_non_negative"
  CHECK ("unitPrice" >= 0 AND "subtotal" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_non_negative"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "paidAmount" >= 0);

-- Invariant #6: pembayaran tidak boleh melebihi total
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_paid_not_exceed_total" CHECK ("paidAmount" <= "total");

-- Invariant #5: diskon tidak boleh melebihi subtotal
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_discount_not_exceed_subtotal" CHECK ("discount" <= "subtotal");

-- Invariant #11: completedAt terisi jika dan hanya jika status = COMPLETED
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_completed_at_consistency"
  CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL));

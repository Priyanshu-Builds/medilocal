-- M1: delivery handoff OTP on orders + lookup indexes for payments/Rx/history.
-- Order table is empty pre-M1, so adding a NOT NULL column without default is safe.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryOtp" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Prescription_orderId_idx" ON "Prescription"("orderId");

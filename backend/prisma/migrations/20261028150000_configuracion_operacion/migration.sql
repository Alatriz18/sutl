-- AlterTable
ALTER TABLE "inventory_items" ALTER COLUMN "cantidad" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "purchase_order_receipts" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "cantidad" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "configuracion" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "perfilOperacion" TEXT NOT NULL DEFAULT 'general';

-- AddForeignKey
ALTER TABLE "purchase_order_receipts" ADD CONSTRAINT "purchase_order_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;


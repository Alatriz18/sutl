-- CreateTable
CREATE TABLE "shipment_purchase_order_lines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "consumoDiario" DOUBLE PRECISION NOT NULL,
    "stockSeguridad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadTimeDias" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mapeo" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_purchase_order_lines_tenantId_idx" ON "shipment_purchase_order_lines"("tenantId");

-- CreateIndex
CREATE INDEX "shipment_purchase_order_lines_purchaseOrderLineId_idx" ON "shipment_purchase_order_lines"("purchaseOrderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_purchase_order_lines_shipmentId_purchaseOrderLineI_key" ON "shipment_purchase_order_lines"("shipmentId", "purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "inventory_policies_tenantId_idx" ON "inventory_policies"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_policies_tenantId_sku_key" ON "inventory_policies"("tenantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "import_mappings_tenantId_tipo_key" ON "import_mappings"("tenantId", "tipo");

-- AddForeignKey
ALTER TABLE "shipment_purchase_order_lines" ADD CONSTRAINT "shipment_purchase_order_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_purchase_order_lines" ADD CONSTRAINT "shipment_purchase_order_lines_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_purchase_order_lines" ADD CONSTRAINT "shipment_purchase_order_lines_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "purchase_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_policies" ADD CONSTRAINT "inventory_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


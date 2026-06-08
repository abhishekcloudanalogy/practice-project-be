-- AlterTable
ALTER TABLE "PdfDocument" ADD COLUMN "contentHash" TEXT;

-- CreateTable
CREATE TABLE "ExtractedTable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pdfDocumentId" TEXT NOT NULL,
    "title" TEXT,
    "tableHash" TEXT NOT NULL,
    "schemaHash" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedRow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extractedTableId" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "rowData" JSONB NOT NULL,
    "rowIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractedTable_userId_idx" ON "ExtractedTable"("userId");
CREATE INDEX "ExtractedTable_pdfDocumentId_idx" ON "ExtractedTable"("pdfDocumentId");
CREATE INDEX "ExtractedTable_userId_schemaHash_idx" ON "ExtractedTable"("userId", "schemaHash");
CREATE UNIQUE INDEX "extracted_table_user_table_hash_unique" ON "ExtractedTable"("userId", "tableHash");

-- CreateIndex
CREATE INDEX "ExtractedRow_userId_idx" ON "ExtractedRow"("userId");
CREATE INDEX "ExtractedRow_extractedTableId_idx" ON "ExtractedRow"("extractedTableId");
CREATE UNIQUE INDEX "extracted_row_table_row_hash_unique" ON "ExtractedRow"("extractedTableId", "rowHash");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_document_user_content_hash_unique" ON "PdfDocument"("userId", "contentHash");

-- AddForeignKey
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_pdfDocumentId_fkey" FOREIGN KEY ("pdfDocumentId") REFERENCES "PdfDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_extractedTableId_fkey" FOREIGN KEY ("extractedTableId") REFERENCES "ExtractedTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

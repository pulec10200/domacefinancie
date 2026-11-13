export type ExtractionField = {
  id: string;
  documentId: string;
  field: string;
  value: unknown;
  source: string;
  method: string;
  confidence: number | null;
  page: number | null;
  confirmedValue: unknown;
};
export interface ExtractionApi {
  recordManualVerification(v: {
    documentId: string;
    result: "matched" | "not_found" | "mismatch";
  }): Promise<void>;
  extractions(): Promise<ExtractionField[]>;
  previewDocument(v: {
    documentId: string;
    page: number;
  }): Promise<{ image: string; pages: number }>;
  retryDocument(id: string): Promise<void>;
  cancelDocument(id: string): Promise<void>;
  receiptItems(documentId: string): Promise<ReceiptItemInput[]>;
  saveReceiptItems(v: {
    documentId: string;
    items: ReceiptItemInput[];
  }): Promise<void>;
}
export type ReceiptItemInput = {
  name: string;
  quantity: string | null;
  amountCents: number | null;
};

export interface ExtractedCandidateRecord {
  name: string;
  type: string; // PERSON, PHONE, IMEI, ACCOUNT, VEHICLE, LOCATION, ORGANIZATION, CASE, EVENT
  phone?: string;
  identifiers?: Record<string, string>;
  context?: Record<string, any>;
}

export interface ExtractedRelationshipRecord {
  source_name: string;
  target_name: string;
  type: string; // CALLED, TRANSFERRED_MONEY, USED, VISITED, MET_AT, LINKED_TO
  properties?: Record<string, any>;
}

export interface ExtractedEventRecord {
  name: string;
  event_time?: string;
  properties?: Record<string, any>;
}

export interface ExtractedMetadata {
  raw_text?: string;
  records: ExtractedCandidateRecord[]; // entities
  relationships?: ExtractedRelationshipRecord[];
  events?: ExtractedEventRecord[];
  source_spans?: Array<{ type: string; value: string; index: number; length: number }>;
}

export interface IExtractionWorker {
  extract(sourceType: string, content: string | Buffer): Promise<ExtractedMetadata>;
}

/**
 * Developer 2 Extraction Service — Pure Extraction Orchestration Boundary
 * 
 * Developer 2 owns extraction worker invocation and candidate metadata persistence.
 * Developer 2 does NOT implement document extraction algorithms, FIR text parsing,
 * CSV entity extraction, JSON parsing, OCR, LLM, or NLP extraction models.
 */
export class ExtractionService {
  private static worker: IExtractionWorker | null = null;

  /**
   * Registers an external extraction worker contract implementation.
   */
  public static registerWorker(worker: IExtractionWorker | null): void {
    this.worker = worker;
  }

  public static getWorker(): IExtractionWorker | null {
    return this.worker;
  }

  /**
   * Orchestrates extraction worker invocation:
   * 1. Receive normalized payload from ingestion pipeline.
   * 2. Invoke extraction worker via IExtractionWorker service contract if registered.
   * 3. Return candidates metadata to ingestion pipeline for candidate persistence.
   */
  public static async processExtractionWorker(
    sourceType: string,
    content: string | Buffer
  ): Promise<ExtractedMetadata> {
    if (this.worker) {
      return await this.worker.extract(sourceType, content);
    }

    // Clean service interface boundary when no external extraction worker is connected
    const textContent = typeof content === 'string' ? content : content.toString('utf-8');
    return {
      raw_text: textContent,
      records: []
    };
  }
}

export interface NormalizedField<T = string> {
  original: T;
  normalized: T;
}

export class NormalizationService {
  /**
   * Normalizes a date string while preserving original value.
   */
  public static normalizeDate(originalDate: string): NormalizedField<string> {
    if (!originalDate || typeof originalDate !== 'string') {
      return { original: originalDate || '', normalized: '' };
    }

    const trimmed = originalDate.trim();
    const parsedTimestamp = Date.parse(trimmed);

    if (isNaN(parsedTimestamp)) {
      return { original: trimmed, normalized: trimmed.toLowerCase() };
    }

    const isoDate = new Date(parsedTimestamp).toISOString();
    return {
      original: trimmed,
      normalized: isoDate
    };
  }

  /**
   * Normalizes a phone number while preserving original value.
   */
  public static normalizePhone(originalPhone: string): NormalizedField<string> {
    if (!originalPhone || typeof originalPhone !== 'string') {
      return { original: originalPhone || '', normalized: '' };
    }

    const trimmed = originalPhone.trim();
    // Country-neutral phone normalization preserving original value
    // Keep digits and leading plus sign if present
    const digitsOnly = trimmed.replace(/[^\d+]/g, '');

    return {
      original: trimmed,
      normalized: digitsOnly
    };
  }

  /**
   * Normalizes an identifier (e.g. account, vehicle, device ID) preserving original value.
   */
  public static normalizeIdentifier(originalId: string): NormalizedField<string> {
    if (!originalId || typeof originalId !== 'string') {
      return { original: originalId || '', normalized: '' };
    }

    const trimmed = originalId.trim();
    const canonical = trimmed.toUpperCase().replace(/[\s\-_]/g, '');

    return {
      original: trimmed,
      normalized: canonical
    };
  }

  /**
   * Normalizes source references (e.g. FIR-001, fir-001, FIR 001) for consistent reference matching (Issue 34).
   */
  public static normalizeSourceRef(originalRef: string): NormalizedField<string> {
    if (!originalRef || typeof originalRef !== 'string') {
      return { original: originalRef || '', normalized: '' };
    }

    const trimmed = originalRef.trim();
    const canonical = trimmed.toUpperCase().replace(/[\s\-_]+/g, '-');

    return {
      original: trimmed,
      normalized: canonical
    };
  }
}

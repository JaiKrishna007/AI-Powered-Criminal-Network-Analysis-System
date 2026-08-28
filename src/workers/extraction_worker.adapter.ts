import { IExtractionWorker, ExtractedMetadata } from '../services/extraction.service';
const pdf = require('pdf-parse');

export class DefaultExtractionWorker implements IExtractionWorker {
  async extract(sourceType: string, content: string | Buffer): Promise<ExtractedMetadata> {
    const type = sourceType.toUpperCase();
    
    if (type === 'PDF') {
      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      const data = await pdf(buffer);
      
      // Basic mock regex for entity extraction from text
      const names = data.text.match(/Name:\s*([A-Za-z\s]+)/g) || [];
      const phones = data.text.match(/Phone:\s*([\d\-\+\s]+)/g) || [];

      const records = names.map((nameStr: string, idx: number) => {
        const name = nameStr.replace('Name:', '').trim();
        const phone = phones[idx] ? phones[idx].replace('Phone:', '').trim() : undefined;
        return { name, phone };
      });

      return {
        raw_text: data.text,
        records
      };
    }

    if (type === 'CSV') {
      // Mock CSV parsing
      const text = content.toString('utf-8');
      const lines = text.split('\n');
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 2) {
          records.push({ name: parts[0].trim(), phone: parts[1].trim() });
        }
      }
      return { raw_text: text, records };
    }

    if (type === 'JSON') {
      const parsed = JSON.parse(content.toString('utf-8'));
      const records = Array.isArray(parsed) ? parsed : [parsed];
      return {
        raw_text: content.toString('utf-8'),
        records: records.map(r => ({ name: r.name, phone: r.phone }))
      };
    }

    return { raw_text: content.toString('utf-8'), records: [] };
  }
}

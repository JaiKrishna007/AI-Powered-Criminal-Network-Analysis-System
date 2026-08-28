import { IExtractionWorker, ExtractedMetadata, ExtractedCandidateRecord, ExtractedRelationshipRecord, ExtractedEventRecord } from '../services/extraction.service';
const pdf = require('pdf-parse');
import { parse } from 'csv-parse/sync';

export class DefaultExtractionWorker implements IExtractionWorker {
  async extract(sourceType: string, content: string | Buffer): Promise<ExtractedMetadata> {
    const type = sourceType.toUpperCase();
    
    if (type === 'PDF' || type === 'TEXT') {
      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      let rawText = '';
      if (type === 'PDF') {
        const data = await pdf(buffer);
        rawText = data.text;
      } else {
        rawText = buffer.toString('utf-8');
      }
      
      const records: ExtractedCandidateRecord[] = [];
      const relationships: ExtractedRelationshipRecord[] = [];
      const events: ExtractedEventRecord[] = [];
      const source_spans: any[] = [];

      // Expanded extraction heuristics
      const nameMatches = rawText.match(/(?:Name|Accused|Person|Suspect|Target):\s*([A-Za-z\s]+)/gi) || [];
      const phoneMatches = rawText.match(/(?:Phone|Mobile|Call):\s*([\d\-\+\s]+)/gi) || [];
      const imeiMatches = rawText.match(/IMEI:\s*(\d{15})/gi) || [];
      const locationMatches = rawText.match(/(?:Location|Address|Place|Visited):\s*([A-Za-z0-9\s,\.]+)/gi) || [];
      
      const mainPersons = [];
      
      for (let i = 0; i < nameMatches.length; i++) {
        const name = nameMatches[i].split(':')[1].trim();
        const phone = phoneMatches[i] ? phoneMatches[i].split(':')[1].trim() : undefined;
        records.push({ name, phone, type: 'PERSON' });
        mainPersons.push(name);
        
        if (phone) {
          records.push({ name: phone, type: 'PHONE' });
          relationships.push({ source_name: name, target_name: phone, type: 'USED' });
        }
      }

      for (const locStr of locationMatches) {
        const loc = locStr.split(':')[1].trim();
        records.push({ name: loc, type: 'LOCATION' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: loc, type: 'VISITED' });
        }
      }

      for (const imeiStr of imeiMatches) {
        const imei = imeiStr.split(':')[1].trim();
        records.push({ name: imei, type: 'IMEI' });
      }
      
      const eventMatches = rawText.match(/(?:Event|Incident):\s*([A-Za-z0-9\s]+)/gi) || [];
      for (const evStr of eventMatches) {
        const ev = evStr.split(':')[1].trim();
        events.push({ name: ev });
        records.push({ name: ev, type: 'EVENT' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: ev, type: 'LINKED_TO' });
        }
      }

      // Add basic spans (prototype level)
      source_spans.push({ type: 'DOCUMENT_START', value: 'START', index: 0, length: 0 });

      return {
        raw_text: rawText,
        records,
        relationships,
        events,
        source_spans
      };
    }

    if (type === 'CSV') {
      const text = content.toString('utf-8');
      const records: ExtractedCandidateRecord[] = [];
      try {
        const parsedRows = parse(text, {
          columns: true,
          skip_empty_lines: true
        });

        for (const r of parsedRows) {
          const row = r as any;
          const name = row.Name || row.name || row.Person || row.Accused;
          const phone = row.Phone || row.phone || row.Mobile;
          const location = row.Location || row.location;
          
          if (name) {
            records.push({ name: name.trim(), phone: phone ? phone.trim() : undefined, type: 'PERSON' });
          }
          if (location) {
             records.push({ name: location.trim(), type: 'LOCATION' });
          }
        }
      } catch (err) {
        throw new Error('MALFORMED_INPUT');
      }
      
      return { raw_text: text, records, relationships: [], events: [], source_spans: [] };
    }

    if (type === 'JSON') {
      let parsed;
      try {
        parsed = JSON.parse(content.toString('utf-8'));
      } catch (err) {
        throw new Error('MALFORMED_INPUT');
      }
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const records = arr.map(r => ({ 
        name: r.name, 
        phone: r.phone, 
        type: r.type || 'PERSON',
        identifiers: r.identifiers,
        context: r.context
      }));
      return {
        raw_text: content.toString('utf-8'),
        records,
        relationships: arr.flatMap(r => r.relationships || []),
        events: arr.flatMap(r => r.events || []),
        source_spans: []
      };
    }

    return { raw_text: content.toString('utf-8'), records: [], relationships: [], events: [], source_spans: [] };
  }
}

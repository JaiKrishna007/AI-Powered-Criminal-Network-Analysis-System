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

      // Expanded extraction heuristics for the 9 core domain entities
      const nameMatches = rawText.match(/(?:Name|Accused|Person|Suspect|Target):\s*([A-Za-z\s]+)/gi) || [];
      const phoneMatches = rawText.match(/(?:Phone|Mobile|Call|Telephone):\s*([\d\-\+\s]+)/gi) || [];
      const imeiMatches = rawText.match(/(?:IMEI|Device|Handset):\s*(\d{15})/gi) || [];
      const accountMatches = rawText.match(/(?:Account|Bank|BankAccount|AccNo):\s*([A-Za-z0-9\-]+)/gi) || [];
      const vehicleMatches = rawText.match(/(?:Vehicle|Car|Plate|RegNo):\s*([A-Za-z0-9\s\-]+)/gi) || [];
      const locationMatches = rawText.match(/(?:Location|Address|Place|Visited|Destination):\s*([A-Za-z0-9\s,\.]+)/gi) || [];
      const orgMatches = rawText.match(/(?:Organization|Company|Org|Gang|Syndicate):\s*([A-Za-z0-9\s]+)/gi) || [];
      const caseMatches = rawText.match(/(?:Case|CaseId|FIR|CrimeNo):\s*([A-Za-z0-9\-]+)/gi) || [];
      const eventMatches = rawText.match(/(?:Event|Incident|Meeting|Transaction):\s*([A-Za-z0-9\s]+)/gi) || [];
      
      const mainPersons: string[] = [];
      
      // 1. PERSON & PHONE
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

      // Standalone phones
      if (phoneMatches.length > nameMatches.length) {
        for (let i = nameMatches.length; i < phoneMatches.length; i++) {
          const phone = phoneMatches[i].split(':')[1].trim();
          records.push({ name: phone, type: 'PHONE' });
        }
      }

      // 2. IMEI
      for (const imeiStr of imeiMatches) {
        const imei = imeiStr.split(':')[1].trim();
        records.push({ name: imei, type: 'IMEI' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: imei, type: 'USED_DEVICE' });
        }
      }

      // 3. ACCOUNT
      for (const accStr of accountMatches) {
        const acc = accStr.split(':')[1].trim();
        records.push({ name: acc, type: 'ACCOUNT' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: acc, type: 'OWNS_ACCOUNT' });
        }
      }

      // 4. VEHICLE
      for (const vehStr of vehicleMatches) {
        const veh = vehStr.split(':')[1].trim();
        records.push({ name: veh, type: 'VEHICLE' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: veh, type: 'OPERATES' });
        }
      }

      // 5. LOCATION
      for (const locStr of locationMatches) {
        const loc = locStr.split(':')[1].trim();
        records.push({ name: loc, type: 'LOCATION' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: loc, type: 'VISITED' });
        }
      }

      // 6. ORGANIZATION
      for (const orgStr of orgMatches) {
        const org = orgStr.split(':')[1].trim();
        records.push({ name: org, type: 'ORGANIZATION' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: org, type: 'MEMBER_OF' });
        }
      }

      // 7. CASE
      for (const caseStr of caseMatches) {
        const cRef = caseStr.split(':')[1].trim();
        records.push({ name: cRef, type: 'CASE' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: cRef, type: 'INVOLVED_IN' });
        }
      }
      
      // 8. EVENT
      for (const evStr of eventMatches) {
        const ev = evStr.split(':')[1].trim();
        events.push({ name: ev });
        records.push({ name: ev, type: 'EVENT' });
        if (mainPersons.length > 0) {
          relationships.push({ source_name: mainPersons[0], target_name: ev, type: 'LINKED_TO' });
        }
      }

      // Document tracking spans
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
      const relationships: ExtractedRelationshipRecord[] = [];
      const events: ExtractedEventRecord[] = [];

      try {
        const parsedRows = parse(text, {
          columns: true,
          skip_empty_lines: true
        });

        for (const r of parsedRows) {
          const row = r as any;
          const name = row.Name || row.name || row.Person || row.person || row.Accused || row.Suspect || row.Target;
          const phone = row.Phone || row.phone || row.Mobile || row.mobile || row.Telephone;
          const imei = row.IMEI || row.imei || row.Device || row.Handset;
          const account = row.Account || row.account || row.BankAccount || row.AccNo || row.AccountNumber;
          const vehicle = row.Vehicle || row.vehicle || row.Car || row.Plate || row.RegNo;
          const location = row.Location || row.location || row.Address || row.Place;
          const organization = row.Organization || row.organization || row.Company || row.Gang || row.Syndicate;
          const caseRef = row.Case || row.case || row.CaseId || row.FIR || row.CrimeNo;
          const event = row.Event || row.event || row.Incident || row.Transaction;
          
          if (name) {
            records.push({ name: name.trim(), phone: phone ? phone.trim() : undefined, type: 'PERSON' });
          }
          if (phone) {
            records.push({ name: phone.trim(), type: 'PHONE' });
            if (name) relationships.push({ source_name: name.trim(), target_name: phone.trim(), type: 'USED' });
          }
          if (imei) {
            records.push({ name: imei.trim(), type: 'IMEI' });
            if (name) relationships.push({ source_name: name.trim(), target_name: imei.trim(), type: 'USED_DEVICE' });
          }
          if (account) {
            records.push({ name: account.trim(), type: 'ACCOUNT' });
            if (name) relationships.push({ source_name: name.trim(), target_name: account.trim(), type: 'OWNS_ACCOUNT' });
          }
          if (vehicle) {
            records.push({ name: vehicle.trim(), type: 'VEHICLE' });
            if (name) relationships.push({ source_name: name.trim(), target_name: vehicle.trim(), type: 'OPERATES' });
          }
          if (location) {
            records.push({ name: location.trim(), type: 'LOCATION' });
            if (name) relationships.push({ source_name: name.trim(), target_name: location.trim(), type: 'VISITED' });
          }
          if (organization) {
            records.push({ name: organization.trim(), type: 'ORGANIZATION' });
            if (name) relationships.push({ source_name: name.trim(), target_name: organization.trim(), type: 'MEMBER_OF' });
          }
          if (caseRef) {
            records.push({ name: caseRef.trim(), type: 'CASE' });
            if (name) relationships.push({ source_name: name.trim(), target_name: caseRef.trim(), type: 'INVOLVED_IN' });
          }
          if (event) {
            events.push({ name: event.trim() });
            records.push({ name: event.trim(), type: 'EVENT' });
            if (name) relationships.push({ source_name: name.trim(), target_name: event.trim(), type: 'LINKED_TO' });
          }
        }
      } catch (err) {
        throw new Error('MALFORMED_INPUT');
      }
      
      return { raw_text: text, records, relationships, events, source_spans: [] };
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
        identifiers: r.identifiers || {},
        context: r.context || {}
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


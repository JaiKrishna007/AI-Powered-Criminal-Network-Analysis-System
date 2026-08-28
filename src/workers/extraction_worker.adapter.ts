import { IExtractionWorker, ExtractedMetadata, ExtractedCandidateRecord, ExtractedRelationshipRecord, ExtractedEventRecord, SourceSpan } from '../services/extraction.service';
const pdf = require('pdf-parse');
import { parse } from 'csv-parse/sync';

export class DefaultExtractionWorker implements IExtractionWorker {
  async extract(sourceType: string, content: string | Buffer): Promise<ExtractedMetadata> {
    const type = sourceType.toUpperCase();
    
    if (type === 'PDF' || type === 'TEXT') {
      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      let rawText = '';
      let pageNumber = 1;

      if (type === 'PDF') {
        const data = await pdf(buffer);
        rawText = data.text;
        pageNumber = data.numpages || 1;
      } else {
        rawText = buffer.toString('utf-8');
      }
      
      const records: ExtractedCandidateRecord[] = [];
      const relationships: ExtractedRelationshipRecord[] = [];
      const events: ExtractedEventRecord[] = [];
      const source_spans: any[] = [];

      // Helper to find span offsets
      const findSpan = (textSnippet: string, page: number = 1): SourceSpan => {
        const idx = rawText.indexOf(textSnippet);
        return {
          page,
          start: idx >= 0 ? idx : 0,
          end: idx >= 0 ? idx + textSnippet.length : textSnippet.length,
          text: textSnippet
        };
      };

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
        const fullMatch = nameMatches[i];
        const name = fullMatch.split(':')[1].trim();
        const phoneMatch = phoneMatches[i];
        const phone = phoneMatch ? phoneMatch.split(':')[1].trim() : undefined;
        const span = findSpan(fullMatch, 1);
        
        records.push({ name, phone, type: 'PERSON', page: 1, source_span: span });
        source_spans.push({ type: 'PERSON', value: name, ...span });
        mainPersons.push(name);
        
        if (phone) {
          const pSpan = phoneMatch ? findSpan(phoneMatch, 1) : span;
          records.push({ name: phone, type: 'PHONE', page: 1, source_span: pSpan });
          source_spans.push({ type: 'PHONE', value: phone, ...pSpan });
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: name,
            target_name: phone,
            type: 'USED',
            page: 1,
            source_span: span
          });
        }
      }

      // Standalone phones
      if (phoneMatches.length > nameMatches.length) {
        for (let i = nameMatches.length; i < phoneMatches.length; i++) {
          const fullMatch = phoneMatches[i];
          const phone = fullMatch.split(':')[1].trim();
          const pSpan = findSpan(fullMatch, 1);
          records.push({ name: phone, type: 'PHONE', page: 1, source_span: pSpan });
          source_spans.push({ type: 'PHONE', value: phone, ...pSpan });
        }
      }

      // 2. IMEI
      for (const imeiStr of imeiMatches) {
        const imei = imeiStr.split(':')[1].trim();
        const span = findSpan(imeiStr, 1);
        records.push({ name: imei, type: 'IMEI', page: 1, source_span: span });
        source_spans.push({ type: 'IMEI', value: imei, ...span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: imei,
            type: 'USED_DEVICE',
            page: 1,
            source_span: span
          });
        }
      }

      // 3. ACCOUNT
      for (const accStr of accountMatches) {
        const acc = accStr.split(':')[1].trim();
        const span = findSpan(accStr, 1);
        records.push({ name: acc, type: 'ACCOUNT', page: 1, source_span: span });
        source_spans.push({ type: 'ACCOUNT', value: acc, ...span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: acc,
            type: 'OWNS_ACCOUNT',
            page: 1,
            source_span: span
          });
        }
      }

      // 4. VEHICLE
      for (const vehStr of vehicleMatches) {
        const veh = vehStr.split(':')[1].trim();
        const span = findSpan(vehStr, 1);
        records.push({ name: veh, type: 'VEHICLE', page: 1, source_span: span });
        source_spans.push({ type: 'VEHICLE', value: veh, ...span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: veh,
            type: 'OPERATES',
            page: 1,
            source_span: span
          });
        }
      }

      // 5. LOCATION
      for (const locStr of locationMatches) {
        const loc = locStr.split(':')[1].trim();
        const span = findSpan(locStr, 1);
        records.push({ name: loc, type: 'LOCATION', page: 1, source_span: span });
        source_spans.push({ type: 'LOCATION', value: loc, ...span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: loc,
            type: 'VISITED',
            page: 1,
            source_span: span
          });
        }
      }

      // 6. ORGANIZATION
      for (const orgStr of orgMatches) {
        const org = orgStr.split(':')[1].trim();
        const span = findSpan(orgStr, 1);
        records.push({ name: org, type: 'ORGANIZATION', page: 1, source_span: span });
        source_spans.push({ type: 'ORGANIZATION', value: org, ...span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: org,
            type: 'MEMBER_OF',
            page: 1,
            source_span: span
          });
        }
      }

      // 7. CASE
      for (const caseStr of caseMatches) {
        const cRef = caseStr.split(':')[1].trim();
        const span = findSpan(caseStr, 1);
        records.push({ name: cRef, type: 'CASE', page: 1, source_span: span });
        source_spans.push({ type: 'CASE', value: cRef, ...span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: cRef,
            type: 'INVOLVED_IN',
            page: 1,
            source_span: span
          });
        }
      }
      
      // 8. EVENT
      for (const evStr of eventMatches) {
        const ev = evStr.split(':')[1].trim();
        const span = findSpan(evStr, 1);
        events.push({ name: ev, page: 1, source_span: span });
        records.push({ name: ev, type: 'EVENT', page: 1, source_span: span });
        source_spans.push({ type: 'EVENT', value: ev, ...span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: ev,
            type: 'LINKED_TO',
            page: 1,
            source_span: span
          });
        }
      }

      // Explicit relationship regexes
      const calledMatches = rawText.match(/(?:Called|CallTo|Dialed):\s*([\d\-\+\s]+)/gi) || [];
      const transferMatches = rawText.match(/(?:TransferredMoney|TransferTo|AmountTo):\s*([A-Za-z0-9\-]+)/gi) || [];
      const metAtMatches = rawText.match(/(?:MetAt|MeetingAt):\s*([A-Za-z0-9\s,\.]+)/gi) || [];

      for (const callStr of calledMatches) {
        const targetPhone = callStr.split(':')[1].trim();
        const span = findSpan(callStr, 1);
        records.push({ name: targetPhone, type: 'PHONE', page: 1, source_span: span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: targetPhone,
            type: 'CALLED',
            page: 1,
            source_span: span
          });
        }
      }

      for (const tStr of transferMatches) {
        const targetAcc = tStr.split(':')[1].trim();
        const span = findSpan(tStr, 1);
        records.push({ name: targetAcc, type: 'ACCOUNT', page: 1, source_span: span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: targetAcc,
            type: 'TRANSFERRED_MONEY',
            page: 1,
            source_span: span
          });
        }
      }

      for (const mStr of metAtMatches) {
        const loc = mStr.split(':')[1].trim();
        const span = findSpan(mStr, 1);
        records.push({ name: loc, type: 'LOCATION', page: 1, source_span: span });
        if (mainPersons.length > 0) {
          relationships.push({
            id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            source_name: mainPersons[0],
            target_name: loc,
            type: 'MET_AT',
            page: 1,
            source_span: span
          });
        }
      }

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
      const source_spans: any[] = [];

      try {
        const parsedRows = parse(text, {
          columns: true,
          skip_empty_lines: true
        });

        let rowIndex = 1;
        for (const r of parsedRows) {
          rowIndex++;
          const row = r as any;
          const name = row.Name || row.name || row.Person || row.person || row.Accused || row.Suspect || row.Target;
          const phone = row.Phone || row.phone || row.Mobile || row.mobile || row.Telephone;
          const calledPhone = row.Called || row.called || row.Callee || row.Dialed;
          const imei = row.IMEI || row.imei || row.Device || row.Handset;
          const account = row.Account || row.account || row.BankAccount || row.AccNo || row.AccountNumber;
          const transferTo = row.TransferTo || row.transfer_to || row.TransferredMoney;
          const vehicle = row.Vehicle || row.vehicle || row.Car || row.Plate || row.RegNo;
          const location = row.Location || row.location || row.Address || row.Place;
          const metAt = row.MetAt || row.met_at || row.MeetingLocation;
          const organization = row.Organization || row.organization || row.Company || row.Gang || row.Syndicate;
          const caseRef = row.Case || row.case || row.CaseId || row.FIR || row.CrimeNo;
          const event = row.Event || row.event || row.Incident || row.Transaction;
          
          const primaryName = name ? name.trim() : undefined;

          if (primaryName) {
            const span: SourceSpan = { row: rowIndex, column: 'Name', text: primaryName };
            records.push({ name: primaryName, phone: phone ? phone.trim() : undefined, type: 'PERSON', source_span: span });
            source_spans.push({ type: 'PERSON', value: primaryName, ...span });
          }
          if (phone) {
            const span: SourceSpan = { row: rowIndex, column: 'Phone', text: phone.trim() };
            records.push({ name: phone.trim(), type: 'PHONE', source_span: span });
            source_spans.push({ type: 'PHONE', value: phone.trim(), ...span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: phone.trim(),
                type: 'USED',
                source_span: span
              });
            }
          }
          if (calledPhone) {
            const span: SourceSpan = { row: rowIndex, column: 'Called', text: calledPhone.trim() };
            records.push({ name: calledPhone.trim(), type: 'PHONE', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: calledPhone.trim(),
                type: 'CALLED',
                source_span: span
              });
            } else if (phone) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: phone.trim(),
                target_name: calledPhone.trim(),
                type: 'CALLED',
                source_span: span
              });
            }
          }
          if (imei) {
            const span: SourceSpan = { row: rowIndex, column: 'IMEI', text: imei.trim() };
            records.push({ name: imei.trim(), type: 'IMEI', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: imei.trim(),
                type: 'USED_DEVICE',
                source_span: span
              });
            }
          }
          if (account) {
            const span: SourceSpan = { row: rowIndex, column: 'Account', text: account.trim() };
            records.push({ name: account.trim(), type: 'ACCOUNT', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: account.trim(),
                type: 'OWNS_ACCOUNT',
                source_span: span
              });
            }
          }
          if (transferTo) {
            const span: SourceSpan = { row: rowIndex, column: 'TransferTo', text: transferTo.trim() };
            records.push({ name: transferTo.trim(), type: 'ACCOUNT', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: transferTo.trim(),
                type: 'TRANSFERRED_MONEY',
                source_span: span
              });
            } else if (account) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: account.trim(),
                target_name: transferTo.trim(),
                type: 'TRANSFERRED_MONEY',
                source_span: span
              });
            }
          }
          if (vehicle) {
            const span: SourceSpan = { row: rowIndex, column: 'Vehicle', text: vehicle.trim() };
            records.push({ name: vehicle.trim(), type: 'VEHICLE', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: vehicle.trim(),
                type: 'OPERATES',
                source_span: span
              });
            }
          }
          if (location) {
            const span: SourceSpan = { row: rowIndex, column: 'Location', text: location.trim() };
            records.push({ name: location.trim(), type: 'LOCATION', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: location.trim(),
                type: 'VISITED',
                source_span: span
              });
            }
          }
          if (metAt) {
            const span: SourceSpan = { row: rowIndex, column: 'MetAt', text: metAt.trim() };
            records.push({ name: metAt.trim(), type: 'LOCATION', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: metAt.trim(),
                type: 'MET_AT',
                source_span: span
              });
            }
          }
          if (organization) {
            const span: SourceSpan = { row: rowIndex, column: 'Organization', text: organization.trim() };
            records.push({ name: organization.trim(), type: 'ORGANIZATION', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: organization.trim(),
                type: 'MEMBER_OF',
                source_span: span
              });
            }
          }
          if (caseRef) {
            const span: SourceSpan = { row: rowIndex, column: 'Case', text: caseRef.trim() };
            records.push({ name: caseRef.trim(), type: 'CASE', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: caseRef.trim(),
                type: 'INVOLVED_IN',
                source_span: span
              });
            }
          }
          if (event) {
            const span: SourceSpan = { row: rowIndex, column: 'Event', text: event.trim() };
            events.push({ name: event.trim(), source_span: span });
            records.push({ name: event.trim(), type: 'EVENT', source_span: span });
            if (primaryName) {
              relationships.push({
                id: `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                source_name: primaryName,
                target_name: event.trim(),
                type: 'LINKED_TO',
                source_span: span
              });
            }
          }
        }
      } catch (err) {
        throw new Error('MALFORMED_INPUT');
      }
      
      return { raw_text: text, records, relationships, events, source_spans };
    }

    if (type === 'JSON') {
      let parsed;
      try {
        parsed = JSON.parse(content.toString('utf-8'));
      } catch (err) {
        throw new Error('MALFORMED_INPUT');
      }
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const records = arr.map((r, idx) => ({ 
        name: r.name, 
        phone: r.phone, 
        type: r.type || 'PERSON',
        identifiers: r.identifiers || {},
        context: r.context || {},
        source_span: { json_path: `$[${idx}]`, text: r.name }
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

import { Case, Entity, Relationship, Evidence, Insight, Lead, Report, CopilotMessage } from './contracts';

// In-Memory Database State for Mock APIs
export interface MockDB {
  cases: Case[];
  entities: Entity[];
  relationships: Relationship[];
  evidence: Evidence[];
  insights: Insight[];
  leads: Lead[];
  copilotSessions: Record<string, CopilotMessage[]>;
  reports: Record<string, Report>;
  entityResolutions: {
    id: string;
    case_id: string;
    original: Entity;
    candidate: Entity;
    confidence: number;
    status: 'CANDIDATE' | 'ACCEPTED' | 'REJECTED' | 'DEFERRED';
    reasons: string[];
  }[];
}

export const mockDB: MockDB = {
  cases: [
    {
      id: 'CASE-1042',
      title: 'Case 1042: Financial Fraud & Network Infiltration',
      status: 'ACTIVE',
      owner_id: 'USR-201',
      classification: 'CASE_RESTRICTED',
      description: 'Investigating Rohan Mehta for suspected cross-border financial fraud, offshore shell account connections, and coordination with telecommunication spoofing actors.',
      created_at: '2026-08-01T12:00:00Z',
      evidence_count: 10,
      entity_count: 12,
      relationship_count: 14
    },
    {
      id: 'CASE-1088',
      title: 'Case 1088: Telecom Impersonation Syndicate',
      status: 'ACTIVE',
      owner_id: 'USR-201',
      classification: 'CONFIDENTIAL',
      description: 'Coordinated campaign utilizing fake telecom SIM cards and spoofed call centers to target public infrastructure funds.',
      created_at: '2026-08-15T08:30:00Z',
      evidence_count: 4,
      entity_count: 6,
      relationship_count: 5
    }
  ],
  entities: [
    { id: 'P001', type: 'PERSON', canonical_name: 'Rohan Mehta', aliases: ['R. Mehta'], confidence: 1.0 },
    { id: 'P002', type: 'PERSON', canonical_name: 'Vikram Malhotra', aliases: ['V. Malhotra'], confidence: 0.95 },
    { id: 'P003', type: 'PERSON', canonical_name: 'Aarti Shah', aliases: ['A. Shah'], confidence: 0.90 },
    { id: 'P004', type: 'PERSON', canonical_name: 'Mohd. Rizwan', aliases: ['Md. Rizwan'], confidence: 0.88 },
    { id: 'P005', type: 'PERSON', canonical_name: 'David Miller', aliases: ['D. Miller'], confidence: 0.92 },
    { id: 'P006', type: 'PERSON', canonical_name: 'Elena Rostova', aliases: ['E. Rostova'], confidence: 0.85 },
    { id: 'PH001', type: 'PHONE', canonical_name: '+91 98765 43210', aliases: [], confidence: 1.0, phone_value: '+919876543210' },
    { id: 'PH002', type: 'PHONE', canonical_name: '+91 98765 01234', aliases: [], confidence: 1.0, phone_value: '+919876501234' },
    { id: 'BA001', type: 'BANK_ACCOUNT', canonical_name: 'HDFC A-402', aliases: [], confidence: 1.0, account_number: 'HDFC-48991029402' },
    { id: 'BA002', type: 'BANK_ACCOUNT', canonical_name: 'ICICI A-908', aliases: [], confidence: 1.0, account_number: 'ICICI-3819280908' },
    { id: 'BA003', type: 'BANK_ACCOUNT', canonical_name: 'Swiss Credit A-112', aliases: [], confidence: 0.94, account_number: 'SCB-8819002112' },
    { id: 'V001', type: 'VEHICLE', canonical_name: 'MH-02-CD-4567', aliases: [], confidence: 1.0, plate_number: 'MH02CD4567' },
    { id: 'L001', type: 'LOCATION', canonical_name: 'Sector 15, Mumbai', aliases: [], confidence: 1.0, address_label: 'Sector 15, Navi Mumbai, MH' },
    { id: 'L002', type: 'LOCATION', canonical_name: 'Hotel Regal, Pune', aliases: [], confidence: 1.0, address_label: 'Hotel Regal, Deccan Gymkhana, Pune, MH' }
  ],
  relationships: [
    { id: 'REL-001', source: 'P001', type: 'CALLED', target: 'PH001', timestamp: '2026-08-10T10:14:00Z', evidence_ids: ['CDR-101'], confidence: 0.95 },
    { id: 'REL-002', source: 'PH001', type: 'CALLED', target: 'P004', timestamp: '2026-08-12T23:14:00Z', evidence_ids: ['CDR-102'], confidence: 0.94 },
    { id: 'REL-003', source: 'P001', type: 'OWNED', target: 'BA001', evidence_ids: ['DIR-101'], confidence: 1.0 },
    { id: 'REL-004', source: 'P002', type: 'OWNED', target: 'BA002', evidence_ids: ['DIR-102'], confidence: 1.0 },
    { id: 'REL-005', source: 'P001', type: 'TRANSFERRED_MONEY', target: 'BA002', amount: 500000, timestamp: '2026-08-12T15:20:00Z', evidence_ids: ['TXN-8819'], confidence: 0.98 },
    { id: 'REL-006', source: 'P001', type: 'USED', target: 'V001', valid_from: '2026-08-01T00:00:00Z', evidence_ids: ['SURV-101'], confidence: 0.95 },
    { id: 'REL-007', source: 'V001', type: 'VISITED', target: 'L002', timestamp: '2026-08-14T20:00:00Z', evidence_ids: ['SURV-102'], confidence: 0.90 },
    { id: 'REL-008', source: 'P004', type: 'TRANSFERRED_MONEY', target: 'BA003', amount: 1200000, timestamp: '2026-08-15T11:05:00Z', evidence_ids: ['TXN-9021'], confidence: 0.97 },
    { id: 'REL-009', source: 'P005', type: 'OWNED', target: 'BA003', evidence_ids: ['DIR-103'], confidence: 0.94 },
    { id: 'REL-010', source: 'P005', type: 'CALLED', target: 'PH002', timestamp: '2026-08-16T12:00:00Z', evidence_ids: ['CDR-102'], confidence: 0.90 },
    { id: 'REL-011', source: 'PH002', type: 'CALLED', target: 'P006', timestamp: '2026-08-16T12:15:00Z', evidence_ids: ['CDR-102'], confidence: 0.88 },
    { id: 'REL-012', source: 'P002', type: 'MET_AT', target: 'P004', timestamp: '2026-08-11T18:00:00Z', valid_from: 'L001', evidence_ids: ['SURV-103'], confidence: 0.85 },
    { id: 'REL-013', source: 'P001', type: 'ASSOCIATED_WITH', target: 'P002', evidence_ids: ['CDR-101', 'TXN-8819'], confidence: 0.96 },
    { id: 'REL-014', source: 'P004', type: 'ASSOCIATED_WITH', target: 'P005', evidence_ids: ['TXN-9021'], confidence: 0.91 }
  ],
  evidence: [
    { id: 'CDR-101', case_id: 'CASE-1042', source_type: 'CDR', source_ref: 'cdr_aug.csv:1042', sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', classification: 'CASE_RESTRICTED', integrity_status: 'VERIFIED', content: 'Caller: Rohan Mehta (+91 98765 43210), Call Duration: 145s, Cell tower: Worli-492B' },
    { id: 'CDR-102', case_id: 'CASE-1042', source_type: 'CDR', source_ref: 'cdr_aug.csv:1043', sha256: 'f8e7d6c5b4a3928170b1a2c3d4e5f607f8e7d6c5b4a3928170b1a2c3d4e5f607', classification: 'CASE_RESTRICTED', integrity_status: 'VERIFIED', content: 'Caller: +91 98765 43210, Receiver: Mohd. Rizwan, Time: 2026-08-12 23:14:00' },
    { id: 'TXN-8819', case_id: 'CASE-1042', source_type: 'BANK_TRANSACTION', source_ref: 'bank_hdfc_aug.csv:8819', sha256: '9b04d152845ec0a378394002c96821bd9b04d152845ec0a378394002c96821bd', classification: 'CASE_RESTRICTED', integrity_status: 'VERIFIED', content: 'Transfer: Rohan Mehta (Acc HDFC-48991029402) -> Vikram Malhotra (Acc ICICI-3819280908), Amount: INR 500,000, Remarks: Consultancy' },
    { id: 'TXN-9021', case_id: 'CASE-1042', source_type: 'BANK_TRANSACTION', source_ref: 'bank_icici_aug.csv:9021', sha256: 'e80b5017098950fc58aad83c8c14978ee80b5017098950fc58aad83c8c14978e', classification: 'CASE_RESTRICTED', integrity_status: 'VERIFIED', content: 'Transfer: Mohd. Rizwan -> Swiss Credit Acc SCB-8819002112, Amount: INR 1,200,000, Remarks: Investment offshore' },
    { id: 'SURV-101', case_id: 'CASE-1042', source_type: 'SURVEILLANCE', source_ref: 'surv_report_rohan.pdf:1', sha256: 'd1c2b3a4d5e6f7a8b9c0d1e2f3a4b5c6d1c2b3a4d5e6f7a8b9c0d1e2f3a4b5c6', classification: 'CONFIDENTIAL', integrity_status: 'VERIFIED', content: 'Suspect Rohan Mehta seen entering black SUV registration MH-02-CD-4567.' },
    { id: 'SURV-102', case_id: 'CASE-1042', source_type: 'SURVEILLANCE', source_ref: 'toll_pune.csv:119', sha256: '3819208398109283019283091283019238192083981092830192830912830192', classification: 'PUBLIC', integrity_status: 'VERIFIED', content: 'Toll Camera detected SUV MH-02-CD-4567 crossing Pune-Mumbai Expressway at 20:00Z.' },
    { id: 'SURV-103', case_id: 'CASE-1042', source_type: 'SURVEILLANCE', source_ref: 'cctv_log_regal.pdf:15', sha256: '7283192083192039281039218239120372831920831920392810392182391203', classification: 'CASE_RESTRICTED', integrity_status: 'VERIFIED', content: 'Meeting confirmed: Vikram Malhotra and Mohd. Rizwan spotted in lobby of Hotel Regal from 18:00 to 19:30 UTC.' },
    { id: 'DIR-101', case_id: 'CASE-1042', source_type: 'INTEL_REPORT', source_ref: 'mca_records:9920', sha256: '4928301928301923810928301928301949283019283019238109283019283019', classification: 'PUBLIC', integrity_status: 'VERIFIED', content: 'HDFC A-402 is registered in MCA records to Rohan Mehta, resident of Sector 15, Mumbai.' },
    { id: 'DIR-102', case_id: 'CASE-1042', source_type: 'INTEL_REPORT', source_ref: 'mca_records:9921', sha256: '8392039281039218239120372831920883920392810392182391203728319208', classification: 'PUBLIC', integrity_status: 'VERIFIED', content: 'ICICI A-908 is registered in MCA records to Vikram Malhotra.' },
    { id: 'DIR-103', case_id: 'CASE-1042', source_type: 'INTEL_REPORT', source_ref: 'swiss_corp:412', sha256: '2830192830192381092830192830194928301928301923810928301928301949', classification: 'SECRET', integrity_status: 'VERIFIED', content: 'Swiss Credit A-112 is registered to shell company Delta Logistics Inc., whose primary beneficiary is identified as David Miller.' }
  ],
  insights: [
    {
      id: 'INS-001',
      case_id: 'CASE-1042',
      type: 'POTENTIAL_BRIDGE',
      entity_id: 'P004',
      confidence: 0.91,
      reasons: [
        'Mohd. Rizwan acts as a structural connector between the primary suspect cluster (Rohan Mehta) and the offshore fund cluster (David Miller).',
        'Receives communication link from Rohan\'s phone proxy (PH001).',
        'Directly triggers financial transfer of INR 1.2M to Swiss Account BA003 linked to offshore beneficiary David Miller.'
      ],
      evidence_ids: ['CDR-102', 'TXN-9021', 'DIR-103']
    },
    {
      id: 'INS-002',
      case_id: 'CASE-1042',
      type: 'FINANCIAL_PATH',
      entity_id: 'P001',
      confidence: 0.96,
      reasons: [
        'Identified high-velocity transaction trail.',
        'Rohan Mehta transferred 500,000 INR to Vikram Malhotra (BA002) within 24 hours of call activity.',
        'Suspicious offshore transaction of 1,200,000 INR routed via Mohd. Rizwan within the same 72-hour window.'
      ],
      evidence_ids: ['TXN-8819', 'TXN-9021']
    },
    {
      id: 'INS-003',
      case_id: 'CASE-1042',
      type: 'CO_LOCATION',
      entity_id: 'P002',
      confidence: 0.85,
      reasons: [
        'Vikram Malhotra and Mohd. Rizwan physically present at the same location (Hotel Regal, Pune) on 2026-08-11T18:00:00Z.',
        'Corresponds to surveillance reports and CCTV footage logs.'
      ],
      evidence_ids: ['SURV-103']
    }
  ],
  leads: [
    {
      id: 'LD-001',
      case_id: 'CASE-1042',
      title: 'Verify entity resolution candidate: Mohd. Rizwan vs. Mohammed Rizwan',
      rationale: 'A candidate match for Mohd. Rizwan exists in Case 1088. Approving this will connect Case 1042 to the broader Telecom Impersonation Syndicate.',
      priority: 'HIGH',
      status: 'PENDING_REVIEW',
      relevance_score: 0.94,
      evidence_ids: ['CDR-102', 'TXN-9021']
    },
    {
      id: 'LD-002',
      case_id: 'CASE-1042',
      title: 'Subpoena offshore account registration details for Swiss Credit A-112',
      rationale: 'Confirm if David Miller is the sole owner or if Rohan Mehta holds beneficial ownership in Delta Logistics Inc.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      relevance_score: 0.88,
      evidence_ids: ['DIR-103']
    },
    {
      id: 'LD-003',
      case_id: 'CASE-1042',
      title: 'Verify call logs from +91 98765 01234 to Elena Rostova',
      rationale: 'Inspect cell tower logs around Aug 16 to confirm location overlap with known telephone fraudsters.',
      priority: 'MEDIUM',
      status: 'PENDING_REVIEW',
      relevance_score: 0.76,
      evidence_ids: ['CDR-102']
    }
  ],
  copilotSessions: {
    'CASE-1042': [
      {
        id: 'COP-MSG-001',
        role: 'assistant',
        content: 'I have loaded the workspace for **Case 1042 (Financial Fraud & Network Infiltration)**. I have indexed 10 evidence items (including CDR logs, bank transfers, surveillance records) and resolved 14 entities. \n\nHow can I assist you with this investigation? You can search for entities, ask for connection paths, or analyze network bridges.',
        timestamp: '2026-08-27T09:00:00Z'
      }
    ]
  },
  reports: {
    'CASE-1042': {
      id: 'RPT-1042',
      case_id: 'CASE-1042',
      version: 1,
      status: 'DRAFT',
      created_by: 'Investigator Arash',
      created_at: '2026-08-27T12:00:00Z',
      sections: {
        summary: 'This report compiles the structural and financial analysis findings for Case 1042, focusing on Rohan Mehta. Network analytics suggest a complex path originating from Rohan Mehta, utilizing local intermediaries (Vikram Malhotra and Mohd. Rizwan) to route funds and communication towards offshore entity David Miller.',
        findings: [
          'Financial evidence (TXN-8819) shows INR 500,000 transfer from Rohan Mehta to Vikram Malhotra.',
          'Call records show a bridge path: Rohan Mehta -> PH001 -> Mohd. Rizwan.',
          'Mohd. Rizwan transferred INR 1,200,000 to David Miller\'s offshore Swiss account (BA003).'
        ],
        limitations: [
          'Offshore accounts have restricted visibility. Ultimate beneficial owner data is based on single intelligence reports (DIR-103).',
          'CDR data for PH001 only covers a 7-day period.'
        ]
      }
    }
  },
  entityResolutions: [
    {
      id: 'RES-001',
      case_id: 'CASE-1042',
      original: { id: 'P004', type: 'PERSON', canonical_name: 'Mohd. Rizwan', aliases: ['Md. Rizwan'], confidence: 0.88 },
      candidate: { id: 'P004-cand', type: 'PERSON', canonical_name: 'Mohammed Rizwan', aliases: ['R. Rizwan'], confidence: 0.85 },
      confidence: 0.89,
      status: 'CANDIDATE',
      reasons: [
        'Name similarity (Jaro-Winkler) is 0.92.',
        'Phonetic similarity match (Double Metaphone) verified.',
        'Common phone proxy connection (+91 98765 43210) observed in active hours.'
      ]
    }
  ]
};

import { getQdrantClient, initQdrantCollection } from '../src/lib/db/qdrant';
import { generateEmbedding } from '../src/lib/ai/ollama';
import { v4 as uuidv4 } from 'uuid';

async function runQdrantAuthTest() {
  console.log("Starting Qdrant Auth Filter Test...");
  try {
    const collectionName = 'test_evidence_auth';
    const qdrant = getQdrantClient();
    try {
        await qdrant.deleteCollection(collectionName);
    } catch (e) {}

    await initQdrantCollection(collectionName);

    // 2. Generate embeddings for dummy evidence (MOCK embeddings for this Qdrant filter test)
    console.log("Generating embeddings for test cases...");
    const text1 = "This is a dummy document for CASE-001.";
    const emb1 = Array.from({ length: 384 }, () => Math.random());
    
    const text2 = "This is a dummy document for CASE-002.";
    const emb2 = Array.from({ length: 384 }, () => Math.random());

    // 3. Upsert evidence into Qdrant
    console.log("Upserting test data into Qdrant...");
    await qdrant.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: uuidv4(),
          vector: emb1,
          payload: {
            case_id: 'CASE-001',
            source_ref: 'EVD-001',
            text: text1
          }
        },
        {
          id: uuidv4(),
          vector: emb2,
          payload: {
            case_id: 'CASE-002',
            source_ref: 'EVD-002',
            text: text2
          }
        }
      ]
    });

    console.log("Test data upserted successfully. Now testing filters...");

    // 4. Test Query with Auth Filter (Simulating allowed_case_ids = ['CASE-001'])
    // We want to verify that when querying with a vector that might match CASE-002's content, 
    // it will ONLY return CASE-001 if the filter correctly restricts it.
    
    // We'll query with emb2 (which strongly matches CASE-002)
    // But we restrict it to CASE-001
    const allowed_case_ids = ['CASE-001'];

    const searchResults = await qdrant.search(collectionName, {
      vector: emb2, // Searching for text2
      limit: 5,
      filter: {
        must: [
          {
            key: 'case_id',
            match: { any: allowed_case_ids }
          }
        ]
      },
      with_payload: true,
    });

    console.log(`\nFound ${searchResults.length} results.`);
    let passed = true;
    for (const res of searchResults) {
      console.log(`- Score: ${res.score}, Case: ${res.payload?.case_id}, Source: ${res.payload?.source_ref}`);
      if (res.payload?.case_id !== 'CASE-001') {
        console.error(`[FAIL] Found unauthorized case_id: ${res.payload?.case_id}`);
        passed = false;
      }
    }

    if (searchResults.length === 0) {
        console.log("No results returned. The semantic match was low, or filter blocked everything.");
        // Let's do a general search just for emb1 to ensure we CAN retrieve CASE-001
        const fallbackResults = await qdrant.search(collectionName, {
            vector: emb1,
            limit: 5,
            filter: {
                must: [{ key: 'case_id', match: { any: allowed_case_ids } }]
            },
            with_payload: true,
        });
        if (fallbackResults.length > 0 && fallbackResults.every(r => r.payload?.case_id === 'CASE-001')) {
            console.log(`[PASS] Fallback query returned ${fallbackResults.length} result(s) exclusively for CASE-001.`);
        } else {
            console.error("[FAIL] Fallback query failed to return CASE-001.");
            passed = false;
        }
    } else if (passed) {
        console.log("[PASS] Qdrant Authorization Filter successfully restricted results to allowed cases.");
    }

    // Clean up
    console.log("\nTest complete.");
    process.exit(passed ? 0 : 1);

  } catch (error) {
    console.error("Qdrant Auth Test Failed with error:", error);
    process.exit(1);
  }
}

runQdrantAuthTest();

import { GraphContextClient } from '../src/lib/graph/client';

async function runTests() {
  console.log("=== D3->D4 INTEGRATION TESTS (REAL/MOCKED: MOCKED) ===");
  console.log("Testing D3 to D4 Graph Context Fetch...");

  // Mocking fetch globally
  (global as any).fetch = async (url: string, options: any) => {
    if (url.includes('/graph/focused')) {
      return {
        ok: true,
        json: async () => ({ nodes: [{ id: '1', type: 'Person' }], edges: [] })
      };
    }
    return { ok: false };
  };

  try {
    const subgraph = await GraphContextClient.getFocusedGraph("mock-auth", "mock-sig", "ENTITY-1", 1);
    if (subgraph && subgraph.nodes && subgraph.nodes.length > 0) {
      console.log("✅ D3 successfully parsed mocked D4 response");
    } else {
      console.error("❌ Failed to parse D4 response");
    }
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }

  console.log("\\nAll D3->D4 Integration Tests Completed.");
}

runTests().catch(console.error);

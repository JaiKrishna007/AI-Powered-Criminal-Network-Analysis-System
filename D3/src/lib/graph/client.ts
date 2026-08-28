import { AuthContext, GRAPH_v1 } from '../../../../../shared-contracts';
import { signAuthContext } from '../auth/auth_signer'; // I'll need to create this for D3 to reconstruct signatures if it passes them on, but wait... D3 M2M receives a signature.

const getD4Url = () => process.env.D4_SERVICE_URL || 'http://localhost:8003';

export class GraphContextClient {
  static async fetchD4(endpoint: string, context: AuthContext, payload: any, authSignature: string) {
    const url = `${getD4Url()}${endpoint}`;
    
    // We must forward the original AuthContext JSON string and Signature that was verified
    // But since D3 receives the headers, we can just pass the raw headers or the parsed context.
    // Actually, D3 needs to sign it if it doesn't have the raw headers. But wait, if D3 receives an M2M call from D2, it can just forward the headers. 
    // Wait, the user said: "DO NOT reconstruct a new AuthContext in D3. D2's authorization context must remain the source identity. Preferred flow: D2 -> signed AuthContext -> D3 -> verify -> forward the appropriate signed authorization context -> D4"
    
    // So D3 receives `X-Authorization-Context` and `X-Authorization-Signature` from D2.
    // It verifies them. Then it forwards them verbatim to D4.
    
    const contextJson = Buffer.from(JSON.stringify(context)).toString('base64');
    // If D3 just passes the authSignature it received from D2, it should work as long as the context object hasn't changed.
    // Let's expect D3 to receive the raw signature or we can re-sign it if D3 knows the secret? No, D3 shouldn't re-sign if it forwards.
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Authorization-Context': contextJson, // We could just pass the original raw header string
      'X-Authorization-Signature': authSignature
    };

    if (context.correlation_id) {
      headers['X-Correlation-ID'] = context.correlation_id;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`D4 Graph Error [${response.status}]: ${text}`);
      throw new Error(`D4 Graph Error: ${response.statusText}`);
    }

    return response.json();
  }

  static async getFocusedGraph(context: AuthContext, signature: string, entityId: string, hops: number = 2): Promise<GRAPH_v1> {
    return this.fetchD4('/graph/focused', context, { entityId, hops }, signature);
  }
}

import neo4j, { Driver, Session } from 'neo4j-driver';

const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'adminpassword';

// Singleton instance to prevent multiple driver instances
let driver: Driver;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export async function closeNeo4jDriver() {
  if (driver) {
    await driver.close();
  }
}

/**
 * Run a Cypher query against the Neo4j database
 */
export async function runCypherQuery(cypher: string, params: Record<string, any> = {}) {
  const session: Session = getNeo4jDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result;
  } finally {
    await session.close();
  }
}

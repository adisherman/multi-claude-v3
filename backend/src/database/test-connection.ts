/**
 * Database Connection Test Script
 * Tests database connectivity and basic operations
 */

import { db, SessionsRepository, EventsRepository, DecisionsRepository } from './index.js';

async function testConnection() {
  console.log('🧪 Testing database connection...\n');

  try {
    // Test 1: Connect to database
    console.log('Test 1: Connecting to database...');
    await db.connect();
    console.log('✓ Connection successful\n');

    // Test 2: Query database info
    console.log('Test 2: Querying database info...');
    const result = await db.query(`
      SELECT
        current_database() as database,
        current_user as user,
        version() as version
    `);
    console.log('Database:', result.rows[0].database);
    console.log('User:', result.rows[0].user);
    console.log('✓ Database info retrieved\n');

    // Test 3: Check tables
    console.log('Test 3: Checking tables...');
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log(`Found ${tables.rows.length} tables:`);
    tables.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });
    console.log('✓ Tables verified\n');

    // Test 4: Test SessionsRepository
    console.log('Test 4: Testing SessionsRepository...');
    const sessionsRepo = new SessionsRepository();
    const session = await sessionsRepo.create({
      agent_name: 'TestAgent',
      agent_type: 'test',
      metadata: { test: true },
    });
    console.log('Created session:', session.session_id);
    console.log('✓ Session created successfully\n');

    // Test 5: Test EventsRepository
    console.log('Test 5: Testing EventsRepository...');
    const eventsRepo = new EventsRepository();
    const event = await eventsRepo.create({
      session_id: session.session_id,
      event_type: 'test_event',
      payload: { message: 'Hello from test!' },
    });
    console.log('Created event:', event.event_id);
    console.log('✓ Event created successfully\n');

    // Test 6: Test DecisionsRepository
    console.log('Test 6: Testing DecisionsRepository...');
    const decisionsRepo = new DecisionsRepository();
    const decision = await decisionsRepo.create({
      event_id: event.event_id,
      session_id: session.session_id,
      decision_type: 'run_validation',
      context: { test: true },
      rationale: 'Test decision',
      actions: [{ action: 'test', params: {} }],
      confidence_score: 0.95,
    });
    console.log('Created decision:', decision.decision_id);
    console.log('✓ Decision created successfully\n');

    // Test 7: Test views
    console.log('Test 7: Testing views...');
    const activeSessions = await sessionsRepo.getActiveSessions();
    console.log(`Active sessions: ${activeSessions.length}`);
    console.log('✓ Views working\n');

    // Test 8: Test transaction
    console.log('Test 8: Testing transaction (rollback)...');
    await db.transaction(async (client) => {
      await client.query(
        'INSERT INTO agent_sessions (agent_name, agent_type) VALUES ($1, $2)',
        ['TransactionTest', 'test']
      );
      throw new Error('Test rollback');
    }).catch(() => {
      console.log('✓ Transaction rolled back successfully\n');
    });

    // Test 9: Clean up test data
    console.log('Test 9: Cleaning up test data...');
    await db.query('DELETE FROM agent_sessions WHERE session_id = $1', [
      session.session_id,
    ]);
    console.log('✓ Test data cleaned up\n');

    // Test 10: Pool statistics
    console.log('Test 10: Pool statistics...');
    const stats = db.getStats();
    console.log('Pool stats:', stats);
    console.log('✓ Statistics retrieved\n');

    console.log('🎉 All tests passed!\n');

    // Close connection
    await db.close();
    console.log('✓ Connection closed\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    await db.close();
    process.exit(1);
  }
}

// Run tests
testConnection();

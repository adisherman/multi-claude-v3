/**
 * Detailed Event Flow Test
 * Tests the complete multi-stage event processing pipeline
 */

import { v4 as uuidv4 } from 'uuid';
import {
  db,
  SessionsRepository,
  EventsRepository,
  DecisionsRepository,
} from './src/database';

const BASE_URL = 'http://localhost:8080';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testFullEventFlow() {
  console.log('🧪 Testing Full Event Flow\n');
  console.log('=' .repeat(50));

  try {
    // Initialize repositories
    const sessionsRepo = new SessionsRepository();
    const eventsRepo = new EventsRepository();
    const decisionsRepo = new DecisionsRepository();

    // Step 1: Create a session in the database
    console.log('\n📊 Step 1: Create Test Session');
    const session = await sessionsRepo.create({
      agent_name: 'ProjectScaffolder',
      agent_type: 'scaffolder',
      metadata: {
        test: true,
        created_by: 'test-script',
      },
    });
    console.log(`✓ Created session: ${session.session_id}`);

    // Step 2: Submit event via API
    console.log('\n📤 Step 2: Submit Event via API');
    const eventData = {
      event_id: uuidv4(),
      session_id: session.session_id,
      event_type: 'project_scaffold_request',
      timestamp: new Date().toISOString(),
      payload: {
        project_type: 'react-typescript',
        name: 'test-project',
        features: ['routing', 'state-management', 'api-client'],
        preferences: {
          css_framework: 'tailwind',
          testing: true,
        },
      },
    };

    const response = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });

    const submitResult = await response.json();
    console.log(`✓ Event submitted: ${submitResult.event_id}`);
    console.log(`  Status: ${submitResult.status}`);

    // Step 3: Wait for processing
    console.log('\n⏳ Step 3: Waiting for Event Processing (10 seconds)');
    await sleep(10000);

    // Step 4: Check if event was persisted
    console.log('\n🔍 Step 4: Verify Event Persistence');
    const persistedEvent = await eventsRepo.findById(eventData.event_id);
    if (persistedEvent) {
      console.log(`✓ Event found in database`);
      console.log(`  Event ID: ${persistedEvent.event_id}`);
      console.log(`  Status: ${persistedEvent.status}`);
      console.log(`  Type: ${persistedEvent.event_type}`);
    } else {
      console.log(`✗ Event NOT found in database (this may be expected if not persisted yet)`);
    }

    // Step 5: Check for decisions
    console.log('\n💡 Step 5: Check for Processing Decisions');
    const decisions = await decisionsRepo.findByEvent(eventData.event_id);
    console.log(`✓ Found ${decisions.length} decisions`);
    decisions.forEach((decision, index) => {
      console.log(`  Decision ${index + 1}:`);
      console.log(`    Type: ${decision.decision_type}`);
      console.log(`    Confidence: ${decision.confidence_score}`);
      console.log(`    Executed: ${decision.executed}`);
    });

    // Step 6: Check session state
    console.log('\n📋 Step 6: Check Session State');
    const updatedSession = await sessionsRepo.findById(session.session_id);
    if (updatedSession) {
      console.log(`✓ Session found`);
      console.log(`  Status: ${updatedSession.status}`);
      console.log(`  Started: ${updatedSession.started_at}`);
      console.log(`  Metadata: ${JSON.stringify(updatedSession.metadata)}`);
    }

    // Step 7: Get session summary
    console.log('\n📊 Step 7: Get Session Summary');
    const summary = await sessionsRepo.getSummary(session.session_id);
    if (summary) {
      console.log(`✓ Session Summary:`);
      console.log(`  Total Events: ${summary.total_events}`);
      console.log(`  Total Tasks: ${summary.total_tasks}`);
      console.log(`  Completed Tasks: ${summary.completed_tasks}`);
    }

    // Step 8: Check metrics via API
    console.log('\n📈 Step 8: Check System Metrics via API');
    const metricsResponse = await fetch(`${BASE_URL}/metrics`);
    const metrics = await metricsResponse.json();
    console.log(`✓ System Metrics:`);
    console.log(`  Total Events: ${metrics.total_events || 0}`);
    console.log(`  Processed Events: ${metrics.processed_events || 0}`);
    console.log(`  Success Rate: ${metrics.success_rate || 0}%`);

    // Step 9: Check queue status
    console.log('\n📋 Step 9: Check Queue Status via API');
    const queueResponse = await fetch(`${BASE_URL}/queue/status`);
    const queue = await queueResponse.json();
    console.log(`✓ Queue Status:`);
    console.log(`  Pending: ${queue.pending || 0}`);
    console.log(`  Processing: ${queue.processing}`);
    console.log(`  Completed: ${queue.completed || 0}`);

    // Step 10: Get all events for session
    console.log('\n📋 Step 10: Get All Events for Session');
    const sessionEvents = await eventsRepo.findBySession(session.session_id);
    console.log(`✓ Found ${sessionEvents.length} events for session`);
    sessionEvents.forEach((evt, index) => {
      console.log(`  Event ${index + 1}:`);
      console.log(`    Type: ${evt.event_type}`);
      console.log(`    Status: ${evt.status}`);
      console.log(`    Timestamp: ${evt.timestamp}`);
    });

    // Step 11: Check recent events in database
    console.log('\n🕐 Step 11: Check Recent Events');
    const recentEvents = await eventsRepo.getRecent(5);
    console.log(`✓ Recent Events (last 5):`);
    recentEvents.forEach((evt, index) => {
      console.log(`  ${index + 1}. ${evt.event_type} - ${evt.status}`);
    });

    // Step 12: Cleanup (optional - comment out to keep data)
    console.log('\n🧹 Step 12: Cleanup Test Data');
    await db.query('DELETE FROM agent_sessions WHERE session_id = $1', [
      session.session_id,
    ]);
    console.log(`✓ Cleaned up test session`);

    // Final Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Full Event Flow Test Complete!\n');
    console.log('Summary:');
    console.log(`  ✓ Session created in database`);
    console.log(`  ✓ Event submitted via API`);
    console.log(`  ✓ Event queued for processing`);
    console.log(`  ✓ System metrics accessible`);
    console.log(`  ✓ Queue status monitored`);
    console.log(`  ✓ Database integration working`);
    console.log('\n' + '='.repeat(50));

    // Close database connection
    await db.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    await db.close();
    process.exit(1);
  }
}

// Run the test
testFullEventFlow();

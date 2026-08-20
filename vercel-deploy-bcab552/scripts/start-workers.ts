/**
 * Start BullMQ workers for background job processing
 * Run this in a separate process: npx tsx scripts/start-workers.ts
 * 
 * In production, this should run as a separate service/container
 */

import { initializeQueues } from '../lib/queue/init';

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Starting BullMQ Workers');
  console.log('═══════════════════════════════════════\n');

  try {
    await initializeQueues();

    console.log('\n✅ Workers are running');
    console.log('📅 Daily deadline checks scheduled for 8:00 AM');
    console.log('👂 Listening for jobs...\n');
    console.log('Press Ctrl+C to stop workers\n');

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    console.error('❌ Failed to start workers:', error);
    process.exit(1);
  }
}

main();

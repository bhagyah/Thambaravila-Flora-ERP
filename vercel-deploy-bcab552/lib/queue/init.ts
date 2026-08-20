import {
  createPaymentNotificationsQueue,
  createPaymentNotificationsWorker,
  schedulePaymentDeadlineChecks,
} from './payment-notifications';
import { Queue, Worker } from 'bullmq';

/**
 * Queue and Worker initialization
 * Call this once at application startup
 */

let paymentQueue: Queue | null = null;
let paymentWorker: Worker | null = null;

export async function initializeQueues(): Promise<void> {
  console.log('🚀 Initializing BullMQ queues...');

  try {
    // Create queue
    paymentQueue = createPaymentNotificationsQueue();
    console.log('✅ Payment notifications queue created');

    // Create worker
    paymentWorker = createPaymentNotificationsWorker();
    console.log('✅ Payment notifications worker created');

    // Schedule recurring jobs
    await schedulePaymentDeadlineChecks(paymentQueue);
    
    console.log('✅ All queues initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize queues:', error);
    throw error;
  }
}

export function getPaymentQueue(): Queue {
  if (!paymentQueue) {
    throw new Error('Payment queue not initialized. Call initializeQueues() first.');
  }
  return paymentQueue;
}

export async function closeQueues(): Promise<void> {
  console.log('Closing queues and workers...');

  if (paymentWorker) {
    await paymentWorker.close();
    paymentWorker = null;
  }

  if (paymentQueue) {
    await paymentQueue.close();
    paymentQueue = null;
  }

  console.log('✅ Queues closed');
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(): Promise<void> {
  console.log('Initiating graceful shutdown...');
  
  await closeQueues();
  
  const { closeRedisConnection } = await import('./redis');
  await closeRedisConnection();
  
  console.log('✅ Graceful shutdown complete');
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received');
    await gracefulShutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received');
    await gracefulShutdown();
    process.exit(0);
  });
}

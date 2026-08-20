import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection } from './redis';
import { prisma } from '@/lib/prisma';
import { updatePaymentStatuses } from '@/lib/payment/deadline-engine';
import { getPendingPayments } from '@/lib/payment/payment-workflow';
import { getPaymentDeadlineRule } from '@/lib/payment/deadline-engine';
import { PaymentStageType } from '@prisma/client';

/**
 * BullMQ Queue and Worker for Payment Deadline Notifications
 * 
 * This background job runs daily to:
 * 1. Update payment statuses (PENDING → DUE_SOON → OVERDUE)
 * 2. Send notifications for payments due soon or overdue
 * 3. Notify: Sales Manager, Accountant, Owner
 */

const QUEUE_NAME = 'payment-notifications';

export interface PaymentNotificationJobData {
  type: 'check_deadlines' | 'send_notification';
  paymentStageId?: string;
  recipients?: string[]; // User IDs
}

export interface NotificationRecipient {
  userId: string;
  userName: string;
  userEmail: string;
  roleName: string;
}

export interface PaymentNotificationData {
  paymentStageId: string;
  enquiryId: string;
  customerId: string;
  customerName: string;
  stageType: PaymentStageType;
  amountDue: string;
  dueDate: Date;
  status: string;
  daysUntilDue: number;
  eventDate: Date | null;
  salesManagerName: string;
  salesManagerEmail: string;
}

/**
 * Create the payment notifications queue
 */
export function createPaymentNotificationsQueue(): Queue {
  const connection = getRedisConnection();
  
  return new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
        age: 24 * 3600, // Keep for 24 hours
      },
      removeOnFail: {
        count: 500, // Keep last 500 failed jobs for debugging
      },
    },
  });
}

/**
 * Schedule daily deadline check job
 * Called once at application startup
 */
export async function schedulePaymentDeadlineChecks(queue: Queue): Promise<void> {
  // Add a repeatable job that runs daily at 8:00 AM
  await queue.add(
    'check-deadlines',
    { type: 'check_deadlines' },
    {
      repeat: {
        pattern: '0 8 * * *', // Cron: 8:00 AM every day
      },
      jobId: 'daily-deadline-check', // Unique ID prevents duplicates
    }
  );

  console.log('✅ Scheduled daily payment deadline checks (8:00 AM)');
}

/**
 * Process payment notification jobs
 */
export function createPaymentNotificationsWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<PaymentNotificationJobData>) => {
      console.log(`Processing job: ${job.name} (${job.id})`);

      if (job.data.type === 'check_deadlines') {
        return await processDeadlineCheck(job);
      } else if (job.data.type === 'send_notification') {
        return await processSendNotification(job);
      }

      throw new Error(`Unknown job type: ${job.data.type}`);
    },
    {
      connection,
      concurrency: 5, // Process up to 5 jobs concurrently
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Process deadline check job
 */
async function processDeadlineCheck(job: Job): Promise<{ updated: number; notifications: number }> {
  console.log('🔍 Checking payment deadlines...');

  // Update payment statuses
  const updatedCount = await updatePaymentStatuses();
  console.log(`Updated ${updatedCount} payment statuses`);

  // Get all pending/overdue payments
  const pendingPayments = await getPendingPayments();
  console.log(`Found ${pendingPayments.length} payments requiring attention`);

  let notificationsSent = 0;

  // Check each payment and send notifications if needed
  for (const payment of pendingPayments) {
    const shouldNotify = await shouldSendNotification(payment);

    if (shouldNotify) {
      // Get recipients (Sales Manager, Accountant, Owner)
      const recipients = await getNotificationRecipients(payment);

      if (recipients.length > 0) {
        // Create notification data
        const notificationData = await createNotificationData(payment);

        // In production, this would send emails/in-app notifications
        // For now, we log and create audit records
        await sendNotifications(recipients, notificationData);
        notificationsSent++;

        // Mark as notified
        await prisma.paymentStage.update({
          where: { id: payment.id },
          data: { notificationSent: true },
        });
      }
    }
  }

  console.log(`✅ Sent ${notificationsSent} notifications`);

  return {
    updated: updatedCount,
    notifications: notificationsSent,
  };
}

/**
 * Determine if notification should be sent for a payment
 */
async function shouldSendNotification(payment: any): Promise<boolean> {
  // Don't notify if already sent
  if (payment.notificationSent) {
    return false;
  }

  // Don't notify for paid payments
  if (payment.status === 'PAID') {
    return false;
  }

  const rule = await getPaymentDeadlineRule(payment.stageType);
  if (!rule) {
    return false;
  }

  const now = new Date();
  const daysUntilDue = Math.ceil(
    (payment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Send notification if:
  // 1. Within notification window (e.g., 3 days before due)
  // 2. Or already overdue
  return daysUntilDue <= rule.daysBeforeDueToNotify || payment.status === 'OVERDUE';
}

/**
 * Get users who should receive payment notifications
 */
async function getNotificationRecipients(payment: any): Promise<NotificationRecipient[]> {
  const recipients: NotificationRecipient[] = [];

  // Get Sales Manager (enquiry creator)
  if (payment.enquiry.createdBy) {
    recipients.push({
      userId: payment.enquiry.createdBy.id,
      userName: payment.enquiry.createdBy.name,
      userEmail: payment.enquiry.createdBy.email,
      roleName: 'Sales Manager',
    });
  }

  // Get all Accountants
  const accountants = await prisma.user.findMany({
    where: {
      role: {
        name: 'Accountant',
      },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  recipients.push(
    ...accountants.map((acc) => ({
      userId: acc.id,
      userName: acc.name,
      userEmail: acc.email,
      roleName: acc.role.name,
    }))
  );

  // Get Owner
  const owner = await prisma.user.findFirst({
    where: {
      role: {
        name: 'Owner',
      },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (owner) {
    recipients.push({
      userId: owner.id,
      userName: owner.name,
      userEmail: owner.email,
      roleName: owner.role.name,
    });
  }

  return recipients;
}

/**
 * Create notification data payload
 */
async function createNotificationData(payment: any): Promise<PaymentNotificationData> {
  const now = new Date();
  const daysUntilDue = Math.ceil(
    (payment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    paymentStageId: payment.id,
    enquiryId: payment.enquiry.id,
    customerId: payment.enquiry.customer.id,
    customerName: payment.enquiry.customer.name,
    stageType: payment.stageType,
    amountDue: payment.amountDue.toString(),
    dueDate: payment.dueDate,
    status: payment.status,
    daysUntilDue,
    eventDate: payment.enquiry.eventDate,
    salesManagerName: payment.enquiry.createdBy?.name || 'Unknown',
    salesManagerEmail: payment.enquiry.createdBy?.email || '',
  };
}

/**
 * Send notifications to recipients
 * In production, this would integrate with email service and in-app notifications
 */
async function sendNotifications(
  recipients: NotificationRecipient[],
  notificationData: PaymentNotificationData
): Promise<void> {
  console.log('\n📧 Payment Notification:');
  console.log(`Customer: ${notificationData.customerName}`);
  console.log(`Payment: ${notificationData.stageType} - $${notificationData.amountDue}`);
  console.log(`Due Date: ${notificationData.dueDate.toLocaleDateString()}`);
  console.log(`Status: ${notificationData.status}`);
  console.log(`Days Until Due: ${notificationData.daysUntilDue}`);
  console.log(`Recipients: ${recipients.map((r) => r.userEmail).join(', ')}\n`);

  // Create audit log for the notification
  // In production, this is where you'd call email service, SMS, etc.
  for (const recipient of recipients) {
    await prisma.auditLog.create({
      data: {
        userId: recipient.userId,
        action: 'payment_notification_sent',
        entityType: 'payment_stage',
        entityId: notificationData.paymentStageId,
        details: {
          notificationType: 'payment_deadline',
          customerName: notificationData.customerName,
          stageType: notificationData.stageType,
          amountDue: notificationData.amountDue,
          dueDate: notificationData.dueDate,
          status: notificationData.status,
          daysUntilDue: notificationData.daysUntilDue,
        },
      },
    });
  }
}

/**
 * Process send notification job (for manual triggers)
 */
async function processSendNotification(job: Job): Promise<void> {
  // Implementation for manual notification triggers
  // Can be used for immediate notifications outside the daily schedule
  console.log('Processing manual notification job:', job.data);
}

/**
 * Manually trigger a deadline check (for testing or manual runs)
 */
export async function triggerManualDeadlineCheck(queue: Queue): Promise<void> {
  await queue.add('manual-check', { type: 'check_deadlines' });
  console.log('✅ Manually triggered deadline check');
}

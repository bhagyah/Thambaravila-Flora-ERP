import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting up database...');
  
  // Test connection
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
  } catch (e) {
    console.error('✗ Database connection failed:', e);
    process.exit(1);
  }

  // Check if roles exist
  const roleCount = await prisma.role.count();
  if (roleCount > 0) {
    console.log('✓ Database already seeded, skipping setup');
    process.exit(0);
  }

  console.log('Seeding database...');

  // Create roles
  const ownerRole = await prisma.role.create({
    data: {
      name: 'Owner',
      description: 'Business owner - full access',
      isSystem: true,
      canBeEdited: false,
    },
  });

  const itRole = await prisma.role.create({
    data: {
      name: 'IT/Admin',
      description: 'IT Administrator',
      isSystem: true,
      canBeEdited: true,
    },
  });

  const accountantRole = await prisma.role.create({
    data: {
      name: 'Accountant',
      description: 'Financial accounting and payment tracking',
      isSystem: true,
      canBeEdited: true,
    },
  });

  const salesManagerRole = await prisma.role.create({
    data: {
      name: 'Sales Manager',
      description: 'Sales management and targets',
      isSystem: true,
      canBeEdited: true,
    },
  });

  const coordinatorRole = await prisma.role.create({
    data: {
      name: 'Wedding Coordinator',
      description: 'Event coordination and planning',
      isSystem: true,
      canBeEdited: true,
    },
  });

  const socialRole = await prisma.role.create({
    data: {
      name: 'Social Media Manager',
      description: 'Social media and marketing',
      isSystem: true,
      canBeEdited: true,
    },
  });

  console.log('✓ Roles created');

  // Create permissions
  const permissions = [
    {
      name: 'view_financial_dashboard',
      description: 'View financial dashboard',
      category: 'financial',
    },
    {
      name: 'record_payment_status',
      description: 'Record payment confirmations',
      category: 'financial',
    },
    {
      name: 'view_audit_logs',
      description: 'View audit logs',
      category: 'system',
    },
    {
      name: 'manage_payment_rules',
      description: 'Manage payment deadline rules',
      category: 'financial',
    },
    {
      name: 'create_users',
      description: 'Create new users',
      category: 'system',
    },
    {
      name: 'manage_users',
      description: 'Manage user accounts and roles',
      category: 'system',
    },
    {
      name: 'view_sales_analytics',
      description: 'View sales analytics',
      category: 'sales',
    },
    {
      name: 'create_enquiries',
      description: 'Create new enquiries',
      category: 'sales',
    },
    {
      name: 'view_all_enquiries',
      description: 'View all enquiries',
      category: 'sales',
    },
    {
      name: 'manage_events',
      description: 'Manage event coordination',
      category: 'coordinator',
    },
    {
      name: 'manage_social_campaigns',
      description: 'Manage social media campaigns',
      category: 'social',
    },
    {
      name: 'view_dashboard',
      description: 'View general dashboard',
      category: 'general',
    },
    {
      name: 'manage_system_config',
      description: 'Manage system configuration',
      category: 'system',
    },
  ];

  const permissionRecords = await Promise.all(
    permissions.map((p) =>
      prisma.permission.create({
        data: p,
      })
    )
  );

  console.log('✓ Permissions created');

  // Map permissions to roles
  const rolePermissions = [
    { role: ownerRole, permissionNames: [...permissions.map((p) => p.name)] },
    {
      role: itRole,
      permissionNames: [
        'view_audit_logs',
        'manage_users',
        'manage_system_config',
        'view_dashboard',
      ],
    },
    {
      role: accountantRole,
      permissionNames: [
        'view_financial_dashboard',
        'record_payment_status',
        'view_all_enquiries',
        'view_dashboard',
      ],
    },
    {
      role: salesManagerRole,
      permissionNames: [
        'view_sales_analytics',
        'create_enquiries',
        'view_all_enquiries',
        'view_dashboard',
      ],
    },
    {
      role: coordinatorRole,
      permissionNames: [
        'manage_events',
        'view_all_enquiries',
        'view_dashboard',
      ],
    },
    {
      role: socialRole,
      permissionNames: [
        'manage_social_campaigns',
        'create_enquiries',
        'view_dashboard',
      ],
    },
  ];

  for (const { role, permissionNames } of rolePermissions) {
    for (const permName of permissionNames) {
      const perm = permissionRecords.find((p) => p.name === permName);
      if (perm) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }
  }

  console.log('✓ Role permissions mapped');

  // Create default Owner user
  const crypto = await import('crypto');
  const argon2 = await import('argon2');

  const defaultPassword = 'Admin@123';
  const passwordHash = await argon2.hash(defaultPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.user.create({
    data: {
      email: 'owner@thambaravila-flora.com',
      name: 'Owner',
      passwordHash,
      roleId: ownerRole.id,
      isActive: true,
    },
  });

  console.log('✓ Default Owner user created');

  // Create payment deadline rules
  await prisma.paymentDeadlineRule.create({
    data: {
      stageType: 'ADVANCE',
      daysBeforeDueToNotify: 3,
      defaultDaysFromEnquiry: 7,
    },
  });

  await prisma.paymentDeadlineRule.create({
    data: {
      stageType: 'FLOWER',
      daysBeforeDueToNotify: 7,
      defaultDaysBeforeEvent: 14,
    },
  });

  await prisma.paymentDeadlineRule.create({
    data: {
      stageType: 'FINAL',
      daysBeforeDueToNotify: 7,
      defaultDaysBeforeEvent: 3,
    },
  });

  console.log('✓ Payment deadline rules created');

  console.log('\n✅ Database setup complete!');
  console.log('\nDefault Login:');
  console.log('  Email: owner@thambaravila-flora.com');
  console.log('  Password: Admin@123');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

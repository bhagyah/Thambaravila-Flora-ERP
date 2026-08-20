import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const rolePermissionsMap: Record<string, string[]> = {
  'Owner': [
    'view_financial_dashboard', 'record_payment_status', 'create_edit_enquiries',
    'view_customer_full_history', 'view_customer_financial_only', 'view_customer_event_only',
    'manage_users_roles', 'manage_users_except_owner', 'set_payment_deadline_rules',
    'download_balance_sheets', 'view_owner_insights', 'internal_chat', 'print_lan'
  ],
  'Sales Manager': [
    'create_edit_enquiries', 'view_customer_full_history', 'view_customer_event_only',
    'internal_chat', 'print_lan'
  ],
  'Accountant': [
    'view_financial_dashboard', 'record_payment_status', 'download_balance_sheets',
    'view_customer_financial_only', 'internal_chat', 'print_lan'
  ],
  'Wedding Coordinator': [
    'create_edit_enquiries', 'view_customer_event_only', 'internal_chat', 'print_lan'
  ],
  'Floral Designer': [
    'create_edit_enquiries', 'view_customer_event_only', 'internal_chat', 'print_lan'
  ],
  'Social Media Manager': [
    'create_edit_enquiries', 'internal_chat'
  ],
  'IT/Admin': [
    'manage_users_roles', 'manage_users_except_owner', 'set_payment_deadline_rules',
    'internal_chat', 'print_lan'
  ]
};

async function main() {
  console.log('🌱 Linking permissions to roles...');

  for (const [roleName, permList] of Object.entries(rolePermissionsMap)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    for (const permName of permList) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (!perm) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id,
        },
      });
    }
    console.log(`✅ ${roleName}: linked ${permList.length} permissions`);
  }

  console.log('🎉 Role permissions setup complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

import Database from 'better-sqlite3';
import path from 'path';
import { hashPassword } from '../lib/auth/password';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function main() {
  console.log('Seeding database...');
  
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  
  try {
    // Create roles
    console.log('Creating roles...');
    const roleIds: Record<string, string> = {};
    const roles = [
      { name: 'Owner', description: 'Business owner - full access', isSystem: true, canBeEdited: false },
      { name: 'IT/Admin', description: 'IT Administrator', isSystem: true, canBeEdited: true },
      { name: 'Accountant', description: 'Financial accounting', isSystem: true, canBeEdited: true },
      { name: 'Sales Manager', description: 'Sales management', isSystem: true, canBeEdited: true },
      { name: 'Wedding Coordinator', description: 'Event coordination', isSystem: true, canBeEdited: true },
      { name: 'Social Media Manager', description: 'Social media and marketing', isSystem: true, canBeEdited: true },
    ];

    for (const role of roles) {
      const roleId = generateId();
      roleIds[role.name] = roleId;
      const stmt = db.prepare(`
        INSERT INTO roles (id, name, description, is_system, can_be_edited, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      stmt.run(roleId, role.name, role.description, role.isSystem ? 1 : 0, role.canBeEdited ? 1 : 0);
    }
    console.log('✓ Roles created');

    // Create permissions
    console.log('Creating permissions...');
    const permissionIds: Record<string, string> = {};
    const permissions = [
      { name: 'view_financial_dashboard', description: 'View financial dashboard', category: 'financial' },
      { name: 'record_payment_status', description: 'Record payment confirmations', category: 'financial' },
      { name: 'view_audit_logs', description: 'View audit logs', category: 'system' },
      { name: 'manage_payment_rules', description: 'Manage payment deadline rules', category: 'financial' },
      { name: 'create_users', description: 'Create new users', category: 'system' },
      { name: 'manage_users', description: 'Manage user accounts', category: 'system' },
      { name: 'view_sales_analytics', description: 'View sales analytics', category: 'sales' },
      { name: 'create_enquiries', description: 'Create enquiries', category: 'sales' },
      { name: 'view_all_enquiries', description: 'View all enquiries', category: 'sales' },
      { name: 'manage_events', description: 'Manage event coordination', category: 'coordinator' },
      { name: 'manage_social_campaigns', description: 'Manage social campaigns', category: 'social' },
      { name: 'view_dashboard', description: 'View general dashboard', category: 'general' },
      { name: 'manage_system_config', description: 'Manage system config', category: 'system' },
    ];

    for (const perm of permissions) {
      const permId = generateId();
      permissionIds[perm.name] = permId;
      const stmt = db.prepare(`
        INSERT INTO permissions (id, name, description, category, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);
      stmt.run(permId, perm.name, perm.description, perm.category);
    }
    console.log('✓ Permissions created');

    // Map permissions to roles
    console.log('Mapping permissions to roles...');
    const rolePermissions: Record<string, string[]> = {
      'Owner': Object.keys(permissionIds),
      'IT/Admin': ['view_audit_logs', 'manage_users', 'manage_system_config', 'view_dashboard'],
      'Accountant': ['view_financial_dashboard', 'record_payment_status', 'view_all_enquiries', 'view_dashboard'],
      'Sales Manager': ['view_sales_analytics', 'create_enquiries', 'view_all_enquiries', 'view_dashboard'],
      'Wedding Coordinator': ['manage_events', 'view_all_enquiries', 'view_dashboard'],
      'Social Media Manager': ['manage_social_campaigns', 'create_enquiries', 'view_dashboard'],
    };

    const rpStmt = db.prepare(`
      INSERT INTO role_permissions (id, role_id, permission_id, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    for (const [roleName, permNames] of Object.entries(rolePermissions)) {
      for (const permName of permNames) {
        rpStmt.run(generateId(), roleIds[roleName], permissionIds[permName]);
      }
    }
    console.log('✓ Role permissions mapped');

    // Create default Owner user
    console.log('Creating default Owner user...');
    const userId = generateId();
    const passwordHash = await hashPassword('Admin@123');
    const userStmt = db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    userStmt.run(userId, 'owner@thambaravila-flora.com', 'Owner', passwordHash, roleIds['Owner'], 1);
    console.log('✓ Default Owner user created');

    // Create payment deadline rules
    console.log('Creating payment deadline rules...');
    const ruleStmt = db.prepare(`
      INSERT INTO payment_deadline_rules (id, stage_type, days_before_due_to_notify, default_days_from_enquiry, default_days_before_event, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    ruleStmt.run(generateId(), 'ADVANCE', 3, 7, null);
    ruleStmt.run(generateId(), 'FLOWER', 7, null, 14);
    ruleStmt.run(generateId(), 'FINAL', 7, null, 3);
    console.log('✓ Payment deadline rules created');

    console.log('\n✅ Database seeding complete!');
    console.log('\nDefault Login:');
    console.log('  Email: owner@thambaravila-flora.com');
    console.log('  Password: Admin@123');

    db.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    db.close();
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

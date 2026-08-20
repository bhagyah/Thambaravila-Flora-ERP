import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

console.log(`Creating SQLite database at ${dbPath}...`);

try {
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  console.log('✓ Database created and initialized');
  
  // Create all tables
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      role_id TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      last_login DATETIME,
      failed_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(role_id) REFERENCES roles(id)
    );
    
    -- Roles table
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT 0,
      can_be_edited BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Permissions table
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Role permissions junction table
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE(role_id, permission_id)
    );
    
    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details JSON,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    
    -- Customers table
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      source TEXT DEFAULT 'OTHER',
      assigned_sales_manager_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assigned_sales_manager_id) REFERENCES users(id)
    );
    
    -- Enquiries table
    CREATE TABLE IF NOT EXISTS enquiries (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      event_date DATETIME,
      event_type TEXT DEFAULT 'OTHER',
      status TEXT DEFAULT 'NEW',
      total_quote_amount INTEGER DEFAULT 0,
      created_by_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(created_by_id) REFERENCES users(id)
    );
    
    -- Payment stages table
    CREATE TABLE IF NOT EXISTS payment_stages (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT NOT NULL,
      stage_type TEXT NOT NULL,
      amount_due INTEGER NOT NULL,
      due_date DATETIME NOT NULL,
      amount_paid INTEGER DEFAULT 0,
      paid_date DATETIME,
      paid_confirmed_by_id TEXT,
      status TEXT DEFAULT 'PENDING',
      notification_sent BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE,
      FOREIGN KEY(paid_confirmed_by_id) REFERENCES users(id)
    );
    
    -- Payment deadline rules table
    CREATE TABLE IF NOT EXISTS payment_deadline_rules (
      id TEXT PRIMARY KEY,
      stage_type TEXT UNIQUE NOT NULL,
      days_before_due_to_notify INTEGER NOT NULL,
      default_days_from_enquiry INTEGER,
      default_days_before_event INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Sales targets table
    CREATE TABLE IF NOT EXISTS sales_targets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_amount INTEGER NOT NULL,
      period TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    
    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date DATETIME NOT NULL,
      venue TEXT,
      coordinator_id TEXT,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(enquiry_id) REFERENCES enquiries(id)
    );
    
    -- Social campaigns table
    CREATE TABLE IF NOT EXISTS social_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      budget INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Chat messages table
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES users(id)
    );
    
    -- Work sessions table
    CREATE TABLE IF NOT EXISTS work_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_customers_id ON customers(customer_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON enquiries(customer_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
    CREATE INDEX IF NOT EXISTS idx_enquiries_event_date ON enquiries(event_date);
    CREATE INDEX IF NOT EXISTS idx_payment_stages_enquiry ON payment_stages(enquiry_id);
    CREATE INDEX IF NOT EXISTS idx_payment_stages_status ON payment_stages(status);
    CREATE INDEX IF NOT EXISTS idx_payment_stages_due_date ON payment_stages(due_date);
  `);
  
  console.log('✓ All tables created');
  
  db.close();
} catch (error) {
  console.error('Error creating database:', error);
  process.exit(1);
}

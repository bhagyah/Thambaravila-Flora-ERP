import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Permissions
  const permissions = [
    { name: 'view_financial_dashboard', description: 'View financial dashboard', category: 'financial' },
    { name: 'record_payment_status', description: 'Record/change payment status', category: 'financial' },
    { name: 'create_edit_enquiries', description: 'Create/edit enquiries', category: 'sales' },
    { name: 'view_customer_full_history', description: 'View customer full history', category: 'customer' },
    { name: 'view_customer_financial_only', description: 'View customer financial data only', category: 'customer' },
    { name: 'view_customer_event_only', description: 'View customer event data only', category: 'customer' },
    { name: 'manage_users_roles', description: 'Manage users/roles', category: 'system' },
    { name: 'manage_users_except_owner', description: 'Manage users/roles except Owner', category: 'system' },
    { name: 'set_payment_deadline_rules', description: 'Set payment deadline rules', category: 'system' },
    { name: 'download_balance_sheets', description: 'Download balance sheets', category: 'financial' },
    { name: 'view_owner_insights', description: 'View owner insights/analytics', category: 'analytics' },
    { name: 'internal_chat', description: 'Access internal chat', category: 'communication' },
    { name: 'print_lan', description: 'Print via LAN printer', category: 'general' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // 2. Roles
  const roles = [
    { name: 'Owner', description: 'Full system access', isSystem: true, canBeEdited: false },
    { name: 'IT/Admin', description: 'System administration', isSystem: true, canBeEdited: true },
    { name: 'Accountant', description: 'Financial management', isSystem: false, canBeEdited: true },
    { name: 'Sales Manager', description: 'Sales and enquiries', isSystem: false, canBeEdited: true },
    { name: 'Wedding Coordinator', description: 'Event coordination', isSystem: false, canBeEdited: true },
    { name: 'Floral Designer', description: 'Floral concept design, stem recipes & production specs', isSystem: false, canBeEdited: true },
    { name: 'Social Media Manager', description: 'Marketing and social media', isSystem: false, canBeEdited: true },
    { name: 'Labour', description: 'Mobile attendance and daily meal request access only', isSystem: true, canBeEdited: false },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // 2b. Role Permissions Mapping
  const rolePermissionsMap: Record<string, string[]> = {
    'Owner': [
      'view_financial_dashboard', 'record_payment_status', 'create_edit_enquiries',
      'view_customer_full_history', 'view_customer_financial_only', 'view_customer_event_only',
      'manage_users_roles', 'manage_users_except_owner', 'set_payment_deadline_rules',
      'download_balance_sheets', 'view_owner_insights', 'internal_chat', 'print_lan'
    ],
    'Sales Manager': ['create_edit_enquiries', 'view_customer_full_history', 'view_customer_event_only', 'internal_chat', 'print_lan'],
    'Accountant': ['view_financial_dashboard', 'record_payment_status', 'download_balance_sheets', 'view_customer_financial_only', 'internal_chat', 'print_lan'],
    'Wedding Coordinator': ['create_edit_enquiries', 'view_customer_event_only', 'internal_chat', 'print_lan'],
    'Floral Designer': ['create_edit_enquiries', 'view_customer_event_only', 'internal_chat', 'print_lan'],
    'Social Media Manager': ['create_edit_enquiries', 'internal_chat'],
    'IT/Admin': ['manage_users_roles', 'manage_users_except_owner', 'set_payment_deadline_rules', 'internal_chat', 'print_lan'],
    'Labour': []
  };

  for (const [rName, pList] of Object.entries(rolePermissionsMap)) {
    const r = await prisma.role.findUnique({ where: { name: rName } });
    if (!r) continue;
    for (const pName of pList) {
      const p = await prisma.permission.findUnique({ where: { name: pName } });
      if (!p) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.id, permissionId: p.id } },
        update: {},
        create: { roleId: r.id, permissionId: p.id },
      });
    }
  }

  // 3. Users for all roles
  const defaultAccounts = [
    { email: 'owner@thambaravila-flora.com', name: 'System Owner', roleName: 'Owner', pass: 'Admin@123' },
    { email: 'sales@thambaravila-flora.com', name: 'Samantha Sales', roleName: 'Sales Manager', pass: 'Sales@123' },
    { email: 'accountant@thambaravila-flora.com', name: 'Arthur Accountant', roleName: 'Accountant', pass: 'Accountant@123' },
    { email: 'coordinator@thambaravila-flora.com', name: 'Clara Coordinator', roleName: 'Wedding Coordinator', pass: 'Coordinator@123' },
    { email: 'designer@thambaravila-flora.com', name: 'Deshan Designer', roleName: 'Floral Designer', pass: 'Designer@123' },
    { email: 'social@thambaravila-flora.com', name: 'Sofia Social', roleName: 'Social Media Manager', pass: 'Social@123' },
    { email: 'it@thambaravila-flora.com', name: 'Ian IT Admin', roleName: 'IT/Admin', pass: 'ITAdmin@123' },
  ];

  for (const acc of defaultAccounts) {
    const role = await prisma.role.findUnique({ where: { name: acc.roleName } });
    if (!role) continue;

    const passwordHash = await argon2.hash(acc.pass);
    await prisma.user.upsert({
      where: { email: acc.email },
      update: { passwordHash, isActive: true, failedAttempts: 0, lockedUntil: null },
      create: {
        email: acc.email,
        name: acc.name,
        passwordHash,
        roleId: role.id,
        isActive: true,
      },
    });
  }

  // 4. Partner Venues
  const sampleVenues = [
    { name: 'Shangri-La Colombo Grand Ballroom', cityArea: 'Colombo 02', venueType: 'Hotel Ballroom', maxCapacity: 600, indoorOutdoor: 'Indoor', loadInNotes: 'Service elevator via basement B2', floralRestrictions: 'No open flame candles' },
    { name: 'Cinnamon Grand Oak Room', cityArea: 'Colombo 03', venueType: 'Hotel Ballroom', maxCapacity: 450, indoorOutdoor: 'Indoor', loadInNotes: 'Main loading dock at rear entrance', floralRestrictions: 'Hanging rigs max 40kg per point' },
    { name: 'Jetwing Beach Lawn', cityArea: 'Negombo', venueType: 'Beach Resort', maxCapacity: 350, indoorOutdoor: 'Outdoor', loadInNotes: 'Direct beach access path from parking', floralRestrictions: 'Wind anchors required for arches' },
    { name: 'Mount Lavinia Hotel Terrace', cityArea: 'Mount Lavinia', venueType: 'Heritage Estate', maxCapacity: 400, indoorOutdoor: 'Both', loadInNotes: 'Heritage steps - hand carry required', floralRestrictions: 'No tape on antique woodwork' },
  ];

  for (const v of sampleVenues) {
    const existing = await prisma.venue.findFirst({ where: { name: v.name } });
    if (!existing) {
      await prisma.venue.create({ data: v });
    }
  }

  // 5. Partner Vendors
  const sampleVendors = [
    { name: 'Studio Storytellers Photography', category: 'Photographer', phone: '+94 77 111 2222', contactPerson: 'Nalin Perera', reliabilityRating: 5 },
    { name: 'Royal Flora Wholesalers', category: 'Florist Wholesaler', phone: '+94 71 333 4444', contactPerson: 'Kanthi Silva', reliabilityRating: 5 },
    { name: 'Luxe Decorators & Linens', category: 'Decorator-Coordinator', phone: '+94 76 555 6666', contactPerson: 'Ruwan Fernando', reliabilityRating: 4 },
    { name: 'Gourmet Banquet Caterers', category: 'Caterer', phone: '+94 70 777 8888', contactPerson: 'Chef Devaka', reliabilityRating: 5 },
  ];

  for (const ven of sampleVendors) {
    const existing = await prisma.vendor.findFirst({ where: { name: ven.name } });
    if (!existing) {
      await prisma.vendor.create({ data: ven });
    }
  }

  // 6. Sample Customers
  const salesManager = await prisma.user.findFirst({ where: { email: 'sales@thambaravila-flora.com' } });
  const venue = await prisma.venue.findFirst({ where: { name: 'Cinnamon Grand Oak Room' } });

  const customerBhagya = await prisma.customer.upsert({
    where: { customerId: 'TF-2026-0001' },
    update: {},
    create: {
      id: 'coar06zbl08px0ruc9vmgd',
      customerId: 'TF-2026-0001',
      name: 'Bhagya Hirushan',
      phone: '+94761094968',
      email: 'bhagyamhirushan@gmail.com',
      address: 'Tharanga,Hettiyawala,Kirinda,Puhulwella,Matara',
      source: 'SOCIAL',
      nicNumber: '992246200V',
      dateOfBirth: new Date('1999-08-11'),
      gender: 'Male',
      socialHandle: 'bhagyah99',
      assignedSalesManagerId: salesManager?.id,
    },
  });

  // 7. Sample Booking B-001
  const existingBooking = await prisma.booking.findUnique({ where: { id: 'B-001' } });
  if (!existingBooking) {
    await prisma.booking.create({
      data: {
        id: 'B-001',
        customerId: customerBhagya.id,
        weddingDate: new Date('2026-08-31'),
        dayOfWeek: 'Monday',
        ceremonyVenueId: venue?.id,
        ceremonyTime: '10:00 AM',
        receptionVenueId: venue?.id,
        receptionTime: '06:30 PM',
        floristSetupTime: '06:00 AM',
        guestCount: 300,
        packageType: 'PREMIUM_BLOOM_PACKAGE',
        serviceScope: 'FULL_WEDDING_PACKAGE',
        colourTheme: 'Rose Gold & Cream',
        salesExecId: salesManager?.id,
        totalQuoteAmount: 15000000,
        depositPercent: 30,
        depositAmount: 4500000,
        balanceDueAmount: 10500000,
        paymentStatus: 'PARTIAL_PAYMENT',
        bookingStatus: 'COMPLETED',
        notes: 'Premium Rose Gold floral setup',
      },
    });
  }

  // 8. Sample System Notifications
  const sampleNotifications = [
    { title: 'New Social Media Lead', message: 'New inquiry captured from Instagram DM: Shanika & Tarindu.', type: 'INFO', roleName: 'Sales Manager', link: '/leads', isRead: true },
    { title: 'Payment Stage Due Soon', message: 'Advance deposit for Booking B-001 is due in 3 days.', type: 'WARNING', roleName: 'Accountant', link: '/accountant/dues', isRead: true },
    { title: 'Venue Confirmed', message: 'Shangri-La Colombo Grand Ballroom confirmed for upcoming wedding.', type: 'SUCCESS', roleName: 'ALL', link: '/venues', isRead: true },
  ];

  for (const n of sampleNotifications) {
    await prisma.notification.create({ data: n });
  }

  console.log('✅ Seed completed successfully with partner venues, vendors, and sample notifications!');
}

main()
  .catch(e => console.error('❌ Seed failed:', e))
  .finally(async () => await prisma.$disconnect());

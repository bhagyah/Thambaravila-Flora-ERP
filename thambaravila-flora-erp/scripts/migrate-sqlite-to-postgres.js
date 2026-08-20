const path = require('path');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const sqlitePath = process.env.SQLITE_DATABASE_PATH || path.join(process.cwd(), 'prisma', 'dev.db');
const sqlite = new Database(sqlitePath, { readonly: true });

function rows(table) {
  const exists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  if (!exists) return [];
  return sqlite.prepare(`SELECT * FROM "${table}"`).all();
}

function date(value) {
  return value == null || value === '' ? null : new Date(value);
}

function bool(value) {
  return value === true || value === 1 || value === '1';
}

function json(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function createMany(label, delegate, data) {
  if (data.length === 0) {
    console.log(`${label}: 0 rows`);
    return;
  }

  await delegate.createMany({ data, skipDuplicates: true });
  console.log(`${label}: ${data.length} rows`);
}

async function main() {
  await createMany('roles', prisma.role, rows('roles').map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: bool(r.is_system),
    canBeEdited: bool(r.can_be_edited),
    createdAt: date(r.created_at),
    updatedAt: date(r.updated_at),
  })));

  await createMany('permissions', prisma.permission, rows('permissions').map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    createdAt: date(p.created_at),
  })));

  await createMany('users', prisma.user, rows('users').map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    passwordHash: u.password_hash,
    totpSecret: u.totp_secret,
    roleId: u.role_id,
    isActive: bool(u.is_active),
    idNumber: u.id_number,
    phone: u.phone,
    avatarUrl: u.avatar_url,
    lastLogin: date(u.last_login),
    failedAttempts: u.failed_attempts || 0,
    lockedUntil: date(u.locked_until),
    createdAt: date(u.created_at),
    updatedAt: date(u.updated_at),
  })));

  await createMany('role_permissions', prisma.rolePermission, rows('role_permissions').map((rp) => ({
    id: rp.id,
    roleId: rp.role_id,
    permissionId: rp.permission_id,
    createdAt: date(rp.created_at),
  })));

  await createMany('venues', prisma.venue, rows('venues').map((v) => ({
    id: v.id,
    name: v.name,
    cityArea: v.city_area,
    fullAddress: v.full_address,
    venueType: v.venue_type,
    contactPerson: v.contact_person,
    phone: v.phone,
    email: v.email,
    maxCapacity: v.max_capacity,
    indoorOutdoor: v.indoor_outdoor,
    loadInNotes: v.load_in_notes,
    floralRestrictions: v.floral_restrictions,
    parkingAvailability: v.parking_availability,
    powerAccess: v.power_access,
    inHouseCatering: bool(v.in_house_catering),
    notesRating: v.notes_rating,
    createdAt: date(v.created_at),
    updatedAt: date(v.updated_at),
  })));

  await createMany('vendors', prisma.vendor, rows('vendors').map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
    contactPerson: v.contact_person,
    phone: v.phone,
    email: v.email,
    areaServed: v.area_served,
    reliabilityRating: v.reliability_rating,
    notes: v.notes,
    status: v.status,
    createdAt: date(v.created_at),
    updatedAt: date(v.updated_at),
  })));

  await createMany('customers', prisma.customer, rows('customers').map((c) => ({
    id: c.id,
    customerId: c.customer_id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    source: c.source,
    nicNumber: c.nic_number,
    dateOfBirth: date(c.date_of_birth),
    gender: c.gender,
    socialHandle: c.social_handle,
    additionalNotes: c.additional_notes,
    assignedSalesManagerId: c.assigned_sales_manager_id,
    createdAt: date(c.created_at),
    updatedAt: date(c.updated_at),
  })));

  await createMany('leads', prisma.lead, rows('leads').map((l) => ({
    id: l.id,
    customerId: l.customer_id,
    inquiryDate: date(l.inquiry_date),
    tentativeWeddingDate: date(l.tentative_wedding_date),
    tentativeVenue: l.tentative_venue,
    estimatedGuestCount: l.estimated_guest_count,
    budgetRange: l.budget_range,
    leadSource: l.lead_source,
    stage: l.stage,
    nextFollowupDate: date(l.next_followup_date),
    assignedSalesExecId: l.assigned_sales_exec_id,
    interestNotes: l.interest_notes,
    converted: bool(l.converted),
    createdAt: date(l.created_at),
    updatedAt: date(l.updated_at),
  })));

  await createMany('bookings', prisma.booking, rows('bookings').map((b) => ({
    id: b.id,
    customerId: b.customer_id,
    leadId: b.lead_id,
    weddingDate: date(b.wedding_date),
    dayOfWeek: b.day_of_week,
    ceremonyVenueId: b.ceremony_venue_id,
    ceremonyTime: b.ceremony_time,
    receptionVenueId: b.reception_venue_id,
    receptionTime: b.reception_time,
    floristSetupTime: b.florist_setup_time,
    guestCount: b.guest_count,
    packageType: b.package_type,
    serviceScope: b.service_scope,
    colourTheme: b.colour_theme,
    salesExecId: b.sales_exec_id,
    totalQuoteAmount: b.total_quote_amount,
    depositPercent: b.deposit_percent,
    depositAmount: b.deposit_amount,
    depositPaidDate: date(b.deposit_paid_date),
    balanceDueAmount: b.balance_due_amount,
    balanceDueDate: date(b.balance_due_date),
    paymentStatus: b.payment_status,
    bookingStatus: b.booking_status,
    daysUntilWedding: b.days_until_wedding,
    notes: b.notes,
    photographerVendorId: b.photographer_vendor_id,
    decoratorVendorId: b.decorator_vendor_id,
    catererVendorId: b.caterer_vendor_id,
    createdAt: date(b.created_at),
    updatedAt: date(b.updated_at),
  })));

  await createMany('payment_stages', prisma.paymentStage, rows('payment_stages').map((p) => ({
    id: p.id,
    bookingId: p.booking_id,
    stageType: p.stage_type,
    amountDue: p.amount_due,
    dueDate: date(p.due_date),
    amountPaid: p.amount_paid,
    paidDate: date(p.paid_date),
    paidConfirmedById: p.paid_confirmed_by_id,
    status: p.status,
    notificationSent: bool(p.notification_sent),
    createdAt: date(p.created_at),
    updatedAt: date(p.updated_at),
  })));

  await createMany('payment_deadline_rules', prisma.paymentDeadlineRule, rows('payment_deadline_rules').map((p) => ({
    id: p.id,
    stageType: p.stage_type,
    daysBeforeDueToNotify: p.days_before_due_to_notify,
    defaultDaysFromEnquiry: p.default_days_from_enquiry,
    defaultDaysBeforeEvent: p.default_days_before_event,
    createdAt: date(p.created_at),
    updatedAt: date(p.updated_at),
  })));

  await createMany('expenses', prisma.expense, rows('expenses').map((e) => ({
    id: e.id,
    expenseId: e.expense_id,
    date: date(e.date),
    bookingId: e.booking_id,
    clientName: e.client_name,
    description: e.description,
    category: e.category,
    supplierName: e.supplier_name,
    supplierContact: e.supplier_contact,
    department: e.department,
    paymentMethod: e.payment_method,
    amount: e.amount,
    taxVat: e.tax_vat,
    totalAmount: e.total_amount,
    paidByName: e.paid_by_name,
    paymentStatus: e.payment_status,
    approvalStatus: e.approval_status,
    notes: e.notes,
    importedFrom: e.imported_from,
    createdById: e.created_by_id,
    createdAt: date(e.created_at),
    updatedAt: date(e.updated_at),
  })));

  await createMany('historical_incomes', prisma.historicalIncome, rows('historical_incomes').map((h) => ({
    id: h.id,
    importId: h.import_id,
    date: date(h.date),
    bookingRef: h.booking_ref,
    clientName: h.client_name,
    description: h.description,
    amount: h.amount,
    paymentType: h.payment_type,
    receivedVia: h.received_via,
    importedFrom: h.imported_from,
    createdAt: date(h.created_at),
  })));

  await createMany('vendor_payments', prisma.vendorPayment, rows('vendor_payments').map((v) => ({
    id: v.id,
    vendorId: v.vendor_id,
    amount: v.amount,
    dueDate: date(v.due_date),
    paidDate: date(v.paid_date),
    status: v.status,
    description: v.description,
    createdAt: date(v.created_at),
  })));

  await createMany('discount_approvals', prisma.discountApproval, rows('discount_approvals').map((d) => ({
    id: d.id,
    bookingId: d.booking_id,
    requestedById: d.requested_by_id,
    amount: d.amount,
    reason: d.reason,
    status: d.status,
    approvedById: d.approved_by_id,
    createdAt: date(d.created_at),
    updatedAt: date(d.updated_at),
  })));

  await createMany('booking_deletion_requests', prisma.bookingDeletionRequest, rows('booking_deletion_requests').map((d) => ({
    id: d.id,
    bookingId: d.booking_id,
    requestedById: d.requested_by_id,
    customerName: d.customer_name,
    reason: d.reason,
    status: d.status,
    approvedById: d.approved_by_id,
    createdAt: date(d.created_at),
    updatedAt: date(d.updated_at),
  })));

  await createMany('customer_deletion_requests', prisma.customerDeletionRequest, rows('customer_deletion_requests').map((d) => ({
    id: d.id,
    customerId: d.customer_id,
    requestedById: d.requested_by_id,
    customerName: d.customer_name,
    reason: d.reason,
    status: d.status,
    approvedById: d.approved_by_id,
    createdAt: date(d.created_at),
    updatedAt: date(d.updated_at),
  })));

  await createMany('sales_targets', prisma.salesTarget, rows('sales_targets').map((s) => ({
    id: s.id,
    userId: s.user_id,
    userName: s.user_name,
    targetAmount: s.target_amount,
    achievedAmount: s.achieved_amount,
    period: s.period,
    timeframe: s.timeframe,
    createdAt: date(s.created_at),
    updatedAt: date(s.updated_at),
  })));

  await createMany('events', prisma.event, rows('events').map((e) => ({
    id: e.id,
    bookingId: e.booking_id,
    title: e.title,
    date: date(e.date),
    venue: e.venue,
    coordinatorId: e.coordinator_id,
    coordinatorName: e.coordinator_name,
    status: e.status,
    checklistJson: e.checklist_json,
    createdAt: date(e.created_at),
    updatedAt: date(e.updated_at),
  })));

  await createMany('social_campaigns', prisma.socialCampaign, rows('social_campaigns').map((s) => ({
    id: s.id,
    title: s.title,
    platform: s.platform,
    startDate: date(s.start_date),
    endDate: date(s.end_date),
    budget: s.budget,
    leadsCaptured: s.leads_captured,
    status: s.status,
    createdAt: date(s.created_at),
    updatedAt: date(s.updated_at),
  })));

  await createMany('chat_messages', prisma.chatMessage, rows('chat_messages').map((c) => ({
    id: c.id,
    senderId: c.sender_id,
    senderName: c.sender_name,
    recipientId: c.recipient_id,
    recipientName: c.recipient_name,
    channel: c.channel,
    content: c.content,
    attachmentUrl: c.attachment_url,
    sentAt: date(c.sent_at),
  })));

  await createMany('geofences', prisma.geofence, rows('geofences').map((g) => ({
    id: g.id,
    name: g.name,
    centerLatitude: g.center_latitude,
    centerLongitude: g.center_longitude,
    radiusMeters: g.radius_meters,
    isActive: bool(g.is_active),
    createdById: g.created_by_id,
    createdAt: date(g.created_at),
    updatedAt: date(g.updated_at),
  })));

  await createMany('work_sessions', prisma.workSession, rows('work_sessions').map((w) => ({
    id: w.id,
    userId: w.user_id,
    userName: w.user_name,
    startTime: date(w.start_time),
    endTime: date(w.end_time),
    duration: w.duration,
    notes: w.notes,
    clockInLatitude: w.clock_in_latitude,
    clockInLongitude: w.clock_in_longitude,
    clockInAccuracyMeters: w.clock_in_accuracy_meters,
    clockOutLatitude: w.clock_out_latitude,
    clockOutLongitude: w.clock_out_longitude,
    clockOutAccuracyMeters: w.clock_out_accuracy_meters,
    geofenceId: w.geofence_id,
    locationVerified: bool(w.location_verified),
    deviceInfo: w.device_info,
    createdAt: date(w.created_at),
  })));

  await createMany('attendance_attempt_logs', prisma.attendanceAttemptLog, rows('attendance_attempt_logs').map((a) => ({
    id: a.id,
    userId: a.user_id,
    userName: a.user_name,
    action: a.action,
    latitude: a.latitude,
    longitude: a.longitude,
    accuracyMeters: a.accuracy_meters,
    result: a.result,
    rejectionReason: a.rejection_reason,
    nearestGeofenceId: a.nearest_geofence_id,
    nearestDistanceM: a.nearest_distance_m,
    workSessionId: a.work_session_id,
    deviceInfo: a.device_info,
    timestamp: date(a.timestamp),
  })));

  await createMany('work_session_overrides', prisma.workSessionOverride, rows('work_session_overrides').map((w) => ({
    id: w.id,
    workSessionId: w.work_session_id,
    overriddenById: w.overridden_by_id,
    overriddenByName: w.overridden_by_name,
    reason: w.reason,
    originalData: w.original_data,
    newData: w.new_data,
    createdAt: date(w.created_at),
  })));

  await createMany('notifications', prisma.notification, rows('notifications').map((n) => ({
    id: n.id,
    userId: n.user_id,
    roleName: n.role_name,
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: bool(n.is_read),
    link: n.link,
    createdAt: date(n.created_at),
  })));

  await createMany('leave_requests', prisma.leaveRequest, rows('leave_requests').map((l) => ({
    id: l.id,
    userId: l.user_id,
    userName: l.user_name,
    userRole: l.user_role,
    startDate: date(l.start_date),
    endDate: date(l.end_date),
    reason: l.reason,
    status: l.status,
    requestedAt: date(l.requested_at),
    approverId: l.approver_id,
    approverName: l.approver_name,
    decidedAt: date(l.decided_at),
    decisionNotes: l.decision_notes,
  })));

  await createMany('work_schedule_configs', prisma.workScheduleConfig, rows('work_schedule_configs').map((w) => ({
    id: w.id,
    workingDays: w.working_days,
    workStartTime: w.work_start_time,
    workEndTime: w.work_end_time,
    graceMinutes: w.grace_minutes,
    updatedById: w.updated_by_id,
    updatedAt: date(w.updated_at),
  })));

  await createMany('system_target_configs', prisma.systemTargetConfig, rows('system_target_configs').map((s) => ({
    id: s.id,
    yearlyTarget: s.yearly_target,
    updatedById: s.updated_by_id,
    updatedByName: s.updated_by_name,
    updatedAt: date(s.updated_at),
  })));

  await createMany('audit_logs', prisma.auditLog, rows('audit_logs').map((a) => ({
    id: a.id,
    userId: a.user_id,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    details: json(a.details),
    ipAddress: a.ip_address,
    timestamp: date(a.timestamp),
  })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });

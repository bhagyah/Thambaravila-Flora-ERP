import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { getDeletedCustomerPublicIds } from '@/lib/delete-request-notification-fallback';

// GET /api/customers - List all customers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const where: any = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { customerId: { contains: search } },
          ],
        }
      : {};

    const [deletedCustomerPublicIds, approvedDeletionRequests, customers] = await Promise.all([
      getDeletedCustomerPublicIds(),
      prisma.customerDeletionRequest.findMany({
        where: { status: 'APPROVED' },
        select: { customerId: true },
      }).catch(() => []),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedSalesManager: { select: { id: true, name: true, role: { select: { name: true } } } },
        },
      }),
    ]);

    const approvedDeletionCustomerIds = new Set(approvedDeletionRequests.map((request) => request.customerId));
    const filteredCustomers = customers.filter(
      (customer) =>
        !approvedDeletionCustomerIds.has(customer.id) &&
        !deletedCustomerPublicIds.has(customer.customerId)
    );
    const total = filteredCustomers.length;
    const pagedCustomers = filteredCustomers.slice(offset, offset + limit);

    const formattedCustomers = pagedCustomers.map((c) => ({
      ...c,
      customer_id: c.customerId || c.id,
      nic_number: c.nicNumber || null,
      date_of_birth: c.dateOfBirth ? c.dateOfBirth.toISOString() : null,
      social_handle: c.socialHandle || null,
      created_at: c.createdAt.toISOString(),
      sales_manager_name: c.assignedSalesManager?.name || null,
      sales_manager_role: c.assignedSalesManager?.role?.name || null,
    }));

    return NextResponse.json({
      customers: formattedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

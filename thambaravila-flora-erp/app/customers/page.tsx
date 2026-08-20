'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseSriLankanNIC } from '@/lib/utils/nic';

interface Customer {
  id: string;
  customerId?: string | null;
  customer_id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  source: string;
  nicNumber?: string | null;
  nic_number?: string | null;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  socialHandle?: string | null;
  social_handle?: string | null;
  sales_manager_name: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCustomers();
    }
  }, [session, page, search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
      });

      const response = await fetch(`/api/customers?${params}`);
      const data = await response.json();

      if (response.ok) {
        setCustomers(data.customers);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    const reason = prompt(
      `Submit Customer Deletion Request for Owner Approval:\n\nPlease enter the reason for deleting customer "${customer.name}" and all associated bookings/balances:`
    );

    if (reason === null) return;
    if (!reason.trim()) {
      alert('A deletion reason is required to submit for Owner Approval.');
      return;
    }

    try {
      const res = await fetch('/api/customers/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Deletion request for Client "${customer.name}" submitted to Owner for Approval.`);
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to submit deletion request');
      }
    } catch (e) {
      alert('Error submitting deletion request');
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg font-semibold text-slate-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100">Customer Directory</h1>
            <p className="mt-1 text-xs text-slate-400">
              Manage client records, ID profiles, social handles, and wedding history
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition flex items-center space-x-2 text-sm"
          >
            <span>👤</span>
            <span>+ New Customer</span>
          </button>
        </div>

        {/* Search Bar */}
        <div>
          <input
            type="text"
            placeholder="Search by client name, NIC, phone, email, or social handle..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-inner"
          />
        </div>

        {/* Customers Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-xs text-slate-400">Loading client profiles...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">No customer records found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Customer ID</th>
                      <th className="px-5 py-3.5">Client Name</th>
                      <th className="px-5 py-3.5">ID / NIC</th>
                      <th className="px-5 py-3.5">Birthday &amp; Gender</th>
                      <th className="px-5 py-3.5">Social Handle (IG/FB)</th>
                      <th className="px-5 py-3.5">Phone &amp; Email</th>
                      <th className="px-5 py-3.5">Source</th>
                      <th className="px-5 py-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                    {customers.map((customer) => {
                      const displayId = customer.customerId || customer.customer_id || customer.id;
                      const displayNic = customer.nicNumber || customer.nic_number || null;
                      const displayDob = customer.dateOfBirth || customer.date_of_birth || null;
                      const displaySocial = customer.socialHandle || customer.social_handle || null;

                      return (
                        <tr key={customer.id} className="hover:bg-slate-800/50 transition">
                          <td className="px-5 py-4 font-bold text-blue-400 font-mono">
                            {displayId}
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-100">
                            {customer.name}
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold text-slate-300">
                            {displayNic || '-'}
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            {displayDob ? (
                              <div className="space-y-0.5">
                                <span className="font-semibold text-slate-200">
                                  🎂 {new Date(displayDob).toLocaleDateString('en-GB')}
                                </span>
                                {customer.gender && (
                                  <span className="block text-[10px] text-slate-400">
                                    ({customer.gender})
                                  </span>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            {displaySocial ? (
                              <span className="px-2 py-1 rounded-md bg-purple-950/50 text-purple-300 border border-purple-800/40 font-semibold text-[11px]">
                                📸 {displaySocial}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-300 space-y-0.5">
                            <div className="font-semibold">{customer.phone}</div>
                            {customer.email && <div className="text-[11px] text-slate-400">{customer.email}</div>}
                          </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {customer.source}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-3">
                            <Link
                              href={`/customers/${customer.id}`}
                              className="text-blue-400 hover:text-blue-300 font-bold hover:underline"
                            >
                              View Details →
                            </Link>
                            <button
                              onClick={() => handleDeleteCustomer(customer)}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition flex items-center space-x-1"
                              title="Delete Customer & Associated Balances"
                            >
                              <span>🗑️</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-800 bg-slate-950/40">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-400 font-semibold">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}

// Create Customer Modal Component
function CreateCustomerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    source: 'OTHER',
    nicNumber: '',
    dateOfBirth: '',
    gender: 'Male',
    socialHandle: '',
  });
  const [nicStatus, setNicStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatic Sri Lankan NIC Parsing Handler
  const handleNicInput = (val: string) => {
    const cleanNic = val.trim();
    const parsed = parseSriLankanNIC(cleanNic);

    if (parsed.isValid && parsed.dateOfBirth) {
      setNicStatus(`✨ Auto-extracted Birthday: ${parsed.formattedDob} (${parsed.gender}, ${parsed.format})`);
      setFormData((prev) => ({
        ...prev,
        nicNumber: cleanNic,
        dateOfBirth: parsed.dateOfBirth || prev.dateOfBirth,
        gender: parsed.gender || prev.gender,
      }));
    } else {
      setNicStatus(cleanNic.length >= 9 ? (parsed.error || '') : '');
      setFormData((prev) => ({
        ...prev,
        nicNumber: cleanNic,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/customers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create customer');
      }
    } catch (error) {
      setError('An error occurred while creating customer record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-lg font-black text-slate-100">New Customer Profile</h2>
            <p className="text-xs text-slate-400">Add client profile with automatic NIC birthdate calculation</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 text-red-300 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dilhani & Kanishka"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +94 77 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          {/* ID Number (NIC / Passport) with Auto-Fill logic */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-slate-300">
                ID Number (Sri Lankan NIC / Passport)
              </label>
              <span className="text-[10px] text-blue-400 font-semibold">
                Supports 10-char (952451234V) &amp; 12-digit
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. 952451234V or 199524501234"
              value={formData.nicNumber}
              onChange={(e) => handleNicInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
            />
            {nicStatus && (
              <p className="mt-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-800/40">
                {nicStatus}
              </p>
            )}
          </div>

          {/* Birthday & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Birthday (Date of Birth) 🎂
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          {/* Social Handle (Instagram / FB Name) & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Instagram / FB Profile Name / Handle
              </label>
              <input
                type="text"
                placeholder="e.g. @dilhani_wedding or FB Profile Name"
                value={formData.socialHandle}
                onChange={(e) => setFormData({ ...formData, socialHandle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="client@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              placeholder="Client residential address"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Acquisition Source */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Acquisition Source
            </label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="REFERRAL">Referral</option>
              <option value="SOCIAL">Social Media (Instagram / Facebook)</option>
              <option value="WALK_IN">Walk-in</option>
              <option value="WEBSITE">Website Inquiry</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Submit / Cancel Buttons */}
          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow disabled:opacity-50"
            >
              {loading ? 'Creating Profile...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

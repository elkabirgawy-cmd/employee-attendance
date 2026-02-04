import { useEffect, useState } from 'react';
import { Smartphone, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeviceChangeRequest {
  id: string;
  employee_id: string;
  old_device_id: string | null;
  new_device_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  employees: {
    full_name: string;
    employee_code: string;
    phone: string;
  };
}

interface DeviceApprovalsProps {
  currentPage?: string;
}

export default function DeviceApprovals({ currentPage }: DeviceApprovalsProps) {
  const [requests, setRequests] = useState<DeviceChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (currentPage === 'device-approvals') {
      fetchRequests();
    }
  }, [currentPage]);

  async function fetchRequests() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('device_change_requests')
        .select(`
          *,
          employees (
            full_name,
            employee_code,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching device requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(request: DeviceChangeRequest) {
    if (!confirm(`Approve device change for ${request.employees.full_name}?`)) {
      return;
    }

    setProcessing(request.id);

    try {
      const { data: adminData } = await supabase.auth.getUser();
      if (!adminData.user) throw new Error('Not authenticated');

      const { data: admin } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', adminData.user.id)
        .single();

      if (!admin) throw new Error('Admin not found');

      const { error: updateError } = await supabase
        .from('device_change_requests')
        .update({
          status: 'approved',
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      await fetchRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      alert(error.message || 'Failed to approve request');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(request: DeviceChangeRequest) {
    if (!confirm(`Reject device change for ${request.employees.full_name}?`)) {
      return;
    }

    setProcessing(request.id);

    try {
      const { data: adminData } = await supabase.auth.getUser();
      if (!adminData.user) throw new Error('Not authenticated');

      const { data: admin } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', adminData.user.id)
        .single();

      if (!admin) throw new Error('Admin not found');

      const { error: updateError } = await supabase
        .from('device_change_requests')
        .update({
          status: 'rejected',
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      await fetchRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      alert(error.message || 'Failed to reject request');
    } finally {
      setProcessing(null);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  if (currentPage !== 'device-approvals') return null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Device Approvals</h1>
          <p className="text-slate-600">Manage employee device change requests</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Smartphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Device Requests</h3>
          <p className="text-slate-600">There are no device change requests at this time.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Old Device ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    New Device ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {request.employees.full_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {request.employees.employee_code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {request.employees.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <div className="font-mono text-xs max-w-[150px] truncate">
                        {request.old_device_id || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <div className="font-mono text-xs max-w-[150px] truncate">
                        {request.new_device_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {request.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(request)}
                            disabled={processing === request.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            disabled={processing === request.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {requests.some((r) => r.status === 'pending') && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Device Approvals</p>
            <p>
              When you approve a device change request, the employee will receive a new OTP to
              complete the binding process. The new device will replace their current bound device.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

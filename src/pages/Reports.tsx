import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Filter, TrendingUp, BarChart3, Clock, Users, AlertCircle, Loader2, Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { detectReportCapabilities, buildReportQuery, type ReportCapabilities } from '../utils/reportCapabilities';

interface ReportsProps {
  currentPage?: string;
}

interface ReportStats {
  todayAttendance: number;
  monthlyAttendance: number;
  lateArrivals: number;
  totalHoursWorked: number;
}

interface ReportRequest {
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  format: 'csv' | 'pdf' | 'xlsx';
  includeWorkDetails: boolean;
  includeLateDetails: boolean;
  action: 'preview' | 'download';
  employeeId?: string;
  branchId?: string;
}

interface GeneratedReport {
  id: string;
  report_type: string;
  start_date: string;
  end_date: string;
  format: string;
  file_name: string;
  created_at: string;
}

export default function Reports({ currentPage }: ReportsProps) {
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth();

  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [format, setFormat] = useState<'csv' | 'pdf' | 'xlsx'>('xlsx');
  const [includeWorkDetails, setIncludeWorkDetails] = useState(true);
  const [includeLateDetails, setIncludeLateDetails] = useState(true);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [employees, setEmployees] = useState<Array<{ id: string; employee_code: string; full_name: string; branch_id?: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Array<{ id: string; employee_code: string; full_name: string; branch_id?: string }>>([]);

  const [stats, setStats] = useState<ReportStats>({
    todayAttendance: 0,
    monthlyAttendance: 0,
    lateArrivals: 0,
    totalHoursWorked: 0
  });

  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [capabilities, setCapabilities] = useState<ReportCapabilities>({
    gpsSupported: false,
    deviceInfoSupported: false,
    shiftsSupported: false,
    workHoursSupported: false,
    lateDetailsSupported: false,
  });

  useEffect(() => {
    if (currentPage === 'reports') {
      console.log('📊 [Reports] Component mounted');

      if (!isAdmin) {
        console.error('📊 [Reports] ❌ Unauthorized access attempt');
        setError('غير مصرح - يتطلب صلاحيات المسؤول');
        setLoading(false);
        return;
      }

      console.log('📊 [Reports] ✅ Authorization passed');
      initializePage();
    }
  }, [currentPage, isAdmin, user]);

  async function initializePage() {
    console.log('📊 [Reports] Detecting schema capabilities...');
    const caps = await detectReportCapabilities();
    console.log('📊 [Reports] Capabilities detected:', caps);
    setCapabilities(caps);

    if (!caps.workHoursSupported) {
      setIncludeWorkDetails(false);
    }
    if (!caps.lateDetailsSupported) {
      setIncludeLateDetails(false);
    }

    await Promise.all([
      fetchReportData(),
      fetchRecentReports(),
      loadEmployees(),
      loadBranches()
    ]);
  }

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_code, full_name, branch_id')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
      setFilteredEmployees(data || []);
      console.log('📊 [Reports] Loaded employees:', data?.length || 0);
    } catch (err) {
      console.error('📊 [Reports] Failed to load employees:', err);
    }
  }

  async function loadBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
      console.log('📊 [Reports] Loaded branches:', data?.length || 0);
    } catch (err) {
      console.error('📊 [Reports] Failed to load branches:', err);
    }
  }

  function clearFilters() {
    setSelectedEmployeeId('all');
    setSelectedBranchId('all');
    showToast('تم مسح الفلاتر', 'success');
  }

  useEffect(() => {
    updateDatesForReportType();
  }, [reportType]);

  useEffect(() => {
    validateDates();
  }, [startDate, endDate]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    filterEmployeesByBranch();
  }, [selectedBranchId, employees]);

  async function filterEmployeesByBranch() {
    if (selectedBranchId === 'all') {
      setFilteredEmployees(employees);
      return;
    }

    let branchEmployees = employees.filter(emp => emp.branch_id === selectedBranchId);

    if (branchEmployees.length === 0) {
      try {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('employee_id, employee:employees!inner(id, employee_code, full_name, branch_id)')
          .eq('branch_id', selectedBranchId)
          .limit(1000);

        if (!error && data) {
          const uniqueEmployees = new Map();
          data.forEach((log: any) => {
            if (log.employee && !uniqueEmployees.has(log.employee.id)) {
              uniqueEmployees.set(log.employee.id, {
                id: log.employee.id,
                employee_code: log.employee.employee_code,
                full_name: log.employee.full_name,
                branch_id: log.employee.branch_id
              });
            }
          });
          branchEmployees = Array.from(uniqueEmployees.values());
          console.log('📊 [Reports] Loaded employees from attendance_logs:', branchEmployees.length);
        }
      } catch (err) {
        console.error('📊 [Reports] Failed to load employees from attendance_logs:', err);
      }
    }

    setFilteredEmployees(branchEmployees);

    if (selectedEmployeeId !== 'all' && !branchEmployees.some(emp => emp.id === selectedEmployeeId)) {
      console.log('📊 [Reports] Selected employee not in branch, resetting filter');
      setSelectedEmployeeId('all');
    }
  }

  if (currentPage !== 'reports') return null;

  function updateDatesForReportType() {
    const now = new Date();

    if (reportType === 'daily') {
      const today = now.toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
    } else if (reportType === 'weekly') {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      setStartDate(startOfWeek.toISOString().split('T')[0]);
      setEndDate(endOfWeek.toISOString().split('T')[0]);
    } else if (reportType === 'monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      setStartDate(startOfMonth.toISOString().split('T')[0]);
      setEndDate(endOfMonth.toISOString().split('T')[0]);
    }
  }

  function validateDates() {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setDateError('تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية');
    } else {
      setDateError('');
    }
  }

  async function fetchReportData() {
    try {
      console.log('📊 [Reports] Starting data fetch...');
      setLoading(true);
      setError('');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: allLogs, error: logsError } = await supabase
        .from('attendance_logs')
        .select('*')
        .order('check_in_time', { ascending: false });

      if (logsError) throw logsError;

      const todayLogs = (allLogs || []).filter(log => log.check_in_time >= todayStart);
      const monthlyLogs = (allLogs || []).filter(log => log.check_in_time >= monthStart);
      const lateLogs = monthlyLogs.filter(log => log.status === 'late');
      const totalHours = monthlyLogs.reduce((sum, log) => sum + (log.total_working_hours || 0), 0);

      setStats({
        todayAttendance: todayLogs.length,
        monthlyAttendance: monthlyLogs.length,
        lateArrivals: lateLogs.length,
        totalHoursWorked: totalHours
      });

      setLoading(false);
    } catch (err: any) {
      console.error('📊 [Reports] ❌ Error:', err);
      setError(`خطأ في تحميل البيانات: ${err.message}`);
      setLoading(false);
    }
  }

  async function fetchRecentReports() {
    try {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentReports(data || []);
    } catch (err: any) {
      console.error('📊 [Reports] Error fetching recent reports:', err);
    }
  }

  async function generateReportClientSide(action: 'preview' | 'download') {
    console.log('📊 [Reports] Generating report CLIENT-SIDE, action:', action);

    try {
      const querySelect = buildReportQuery(capabilities, {
        includeGps: false,
        includeDevice: false,
        includeWorkDetails,
        includeLateDetails,
      });

      console.log('📊 [Reports] Query select:', querySelect);

      let query = supabase
        .from('attendance_logs')
        .select(querySelect)
        .gte('check_in_time', `${startDate}T00:00:00`)
        .lte('check_in_time', `${endDate}T23:59:59`);

      if (selectedEmployeeId !== 'all') {
        console.log('📊 [Reports] Filtering by employee:', selectedEmployeeId);
        query = query.eq('employee_id', selectedEmployeeId);
      }

      if (selectedBranchId !== 'all') {
        console.log('📊 [Reports] Filtering by branch:', selectedBranchId);
        query = query.eq('branch_id', selectedBranchId);
      }

      query = query.order('check_in_time', { ascending: false });

      const { data: attendanceLogs, error: logsError } = await query;

      if (logsError) {
        console.error('📊 [Reports] Query error:', logsError);
        throw logsError;
      }

      console.log('📊 [Reports] Fetched', attendanceLogs?.length || 0, 'attendance records');

      if (!attendanceLogs || attendanceLogs.length === 0) {
        showToast('لا توجد سجلات للفترة/الفلاتر المختارة', 'error');
        return;
      }

      const records = attendanceLogs.map((log: any) => {
        const checkIn = new Date(log.check_in_time);
        const checkOut = log.check_out_time ? new Date(log.check_out_time) : null;

        const formatTimeOnly = (date: Date) => {
          return date.toLocaleTimeString('ar-SA', {
            timeZone: 'Asia/Riyadh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        };

        let workedHours = '—';
        if (log.total_working_hours !== null && log.total_working_hours !== undefined) {
          workedHours = log.total_working_hours.toFixed(2);
        } else if (checkOut) {
          const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          workedHours = hours.toFixed(2);
        }

        const record: any = {
          'كود الموظف': log.employee?.employee_code || 'N/A',
          'اسم الموظف': log.employee?.full_name || 'N/A',
          'الفرع': log.branch?.name || 'N/A',
          'التاريخ': checkIn.toISOString().split('T')[0],
          'وقت الدخول': formatTimeOnly(checkIn),
          'وقت الخروج': checkOut ? formatTimeOnly(checkOut) : '—',
          'ساعات العمل': workedHours,
          'الحالة': log.status === 'late' ? 'متأخر' : log.status === 'on_time' ? 'في الوقت' : '—'
        };

        return record;
      });

      if (action === 'preview') {
        showPreview(records);
      } else {
        if (format === 'csv') {
          const csv = generateCSV(records);
          const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
          downloadBlob(blob, `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
          showToast('تم تحميل التقرير بنجاح', 'success');
        } else if (format === 'pdf') {
          generatePDF(records, true);
          showToast('تم تحميل التقرير بنجاح', 'success');
        } else if (format === 'xlsx') {
          const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
          downloadBlob(blob, `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.json`);
          showToast('تم تحميل التقرير (JSON)', 'success');
        }
      }

      await saveReportMetadata();
    } catch (err: any) {
      console.error('📊 [Reports] ❌ Client-side generation error:', err);
      showToast(`فشل في توليد التقرير: ${err.message}`, 'error');
    }
  }

  function generateCSV(records: any[]): string {
    if (records.length === 0) return '';

    const fixedHeaders = [
      'كود الموظف',
      'اسم الموظف',
      'الفرع',
      'التاريخ',
      'وقت الدخول',
      'وقت الخروج',
      'ساعات العمل',
      'الحالة'
    ];

    const allKeys = Object.keys(records[0]);
    const gpsHeaders = allKeys.filter(k => k.includes('خط العرض') || k.includes('خط الطول'));
    const deviceHeaders = allKeys.filter(k => k.includes('معلومات الجهاز'));

    const headers = [...fixedHeaders, ...gpsHeaders, ...deviceHeaders];
    const rows = [headers.join(',')];

    for (const record of records) {
      const values = headers.map(header => {
        const value = record[header];
        if (value === null || value === undefined) return '—';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      rows.push(values.join(','));
    }

    return rows.join('\n');
  }

  function generatePDF(records: any[], downloadAsFile: boolean = false) {
    if (records.length === 0) {
      showToast('لا توجد بيانات لطباعتها', 'error');
      return;
    }

    const fixedHeaders = [
      'كود الموظف',
      'اسم الموظف',
      'الفرع',
      'التاريخ',
      'وقت الدخول',
      'وقت الخروج',
      'ساعات العمل',
      'الحالة'
    ];

    const allKeys = Object.keys(records[0]);
    const gpsHeaders = allKeys.filter(k => k.includes('خط العرض') || k.includes('خط الطول'));
    const deviceHeaders = allKeys.filter(k => k.includes('معلومات الجهاز'));

    const headers = [...fixedHeaders, ...gpsHeaders, ...deviceHeaders];
    const reportTypeName = reportType === 'daily' ? 'يومي'
      : reportType === 'weekly' ? 'أسبوعي'
      : reportType === 'monthly' ? 'شهري'
      : 'مخصص';

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الحضور - ${reportTypeName}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 15mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Arial', 'Tahoma', sans-serif;
            direction: rtl;
            background: white;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 15px;
          }
          .header h1 {
            color: #1e40af;
            font-size: 28px;
            margin-bottom: 10px;
          }
          .header p {
            color: #475569;
            font-size: 14px;
          }
          .print-btn {
            position: fixed;
            top: 20px;
            left: 20px;
            background: #1e40af;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
          }
          .print-btn:hover {
            background: #1e3a8a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 11px;
          }
          th {
            background: #1e40af;
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #1e40af;
          }
          td {
            padding: 10px 8px;
            text-align: center;
            border: 1px solid #cbd5e1;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          tr:hover {
            background: #e0f2fe;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
          }
          @media print {
            body {
              padding: 0;
            }
            .no-print, .print-btn {
              display: none;
            }
          }
        </style>
        <script>
          function printReport() {
            window.print();
          }
        </script>
      </head>
      <body>
        <button onclick="printReport()" class="print-btn no-print">طباعة التقرير</button>

        <div class="header">
          <h1>تقرير الحضور - ${reportTypeName}</h1>
          <p>من ${startDate} إلى ${endDate}</p>
          ${selectedBranchId !== 'all' ? `<p>فرع: ${branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId}</p>` : ''}
          ${selectedEmployeeId !== 'all' ? `<p>موظف: ${filteredEmployees.find(e => e.id === selectedEmployeeId)?.full_name || selectedEmployeeId}</p>` : ''}
          <p>تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' })}</p>
        </div>

        <table>
          <thead>
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${records.map(record => `
              <tr>
                ${headers.map(header => `<td>${record[header] !== null && record[header] !== undefined ? record[header] : '—'}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>عدد السجلات: ${records.length}</p>
          <p>إجمالي ساعات العمل: ${(() => {
            const total = records.reduce((sum, r) => {
              const hours = parseFloat(r['ساعات العمل']);
              return sum + (isNaN(hours) ? 0 : hours);
            }, 0);
            return total.toFixed(2);
          })()} ساعة</p>
          <p>تم الإنشاء بواسطة نظام إدارة الحضور</p>
        </div>
      </body>
      </html>
    `;

    if (downloadAsFile) {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      downloadBlob(blob, `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.html`);
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';

      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        showToast('فشل في إنشاء نافذة الطباعة', 'error');
        document.body.removeChild(iframe);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (err) {
          console.error('📊 [Reports] Print error:', err);
          showToast('فشل في فتح نافذة الطباعة', 'error');
          document.body.removeChild(iframe);
        }
      }, 500);
    }
  }

  async function saveReportMetadata() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateStr = new Date().toISOString().split('T')[0];
      const reportTypeName = reportType.charAt(0).toUpperCase() + reportType.slice(1);

      await supabase.from('generated_reports').insert({
        admin_user_id: user.id,
        report_type: reportType,
        start_date: startDate,
        end_date: endDate,
        format: format,
        file_name: `تقرير_${reportTypeName}_${dateStr}.${format}`,
        include_gps: false,
        include_device: false,
        include_work_details: includeWorkDetails,
        include_late_details: includeLateDetails,
      });

      await fetchRecentReports();
    } catch (err) {
      console.error('📊 [Reports] Error saving metadata:', err);
    }
  }

  async function generateReport(action: 'preview' | 'download') {
    console.log('📊 [Reports] Generating report, action:', action);

    if (dateError) {
      showToast('يرجى تصحيح أخطاء التاريخ أولاً', 'error');
      return;
    }

    if (!reportType || !startDate || !endDate || !format) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    setGenerating(true);
    console.log('📊 [Reports] Request payload:', {
      reportType,
      startDate,
      endDate,
      format,
      includeWorkDetails,
      includeLateDetails,
      action
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('📊 [Reports] ❌ No active session, falling back to client-side generation');
        await generateReportClientSide(action);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`;
      console.log('📊 [Reports] API URL:', apiUrl);

      const payload: ReportRequest = {
        reportType,
        startDate,
        endDate,
        format,
        includeWorkDetails,
        includeLateDetails,
        action,
        employeeId: selectedEmployeeId !== 'all' ? selectedEmployeeId : undefined,
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined
      };

      console.log('📊 [Reports] Sending payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📊 [Reports] API Response status:', response.status);
      console.log('📊 [Reports] API Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.warn('📊 [Reports] ⚠️ Edge function failed, falling back to client-side generation');
        await generateReportClientSide(action);
        return;
      }

      if (format === 'csv') {
        const blob = await response.blob();
        console.log('📊 [Reports] ✅ CSV blob received, size:', blob.size);
        downloadBlob(blob, `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
        showToast('تم تحميل التقرير بنجاح', 'success');
      } else {
        const data = await response.json();
        console.log('📊 [Reports] ✅ Data received:', data);

        if (action === 'preview') {
          showPreview(data);
        } else {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          downloadBlob(blob, `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.json`);
        }

        showToast('تم توليد التقرير بنجاح', 'success');
      }

      await fetchRecentReports();
    } catch (err: any) {
      console.error('📊 [Reports] ❌ Generation error FULL:', err);
      console.warn('📊 [Reports] ⚠️ Falling back to client-side generation');

      try {
        await generateReportClientSide(action);
      } catch (fallbackErr: any) {
        console.error('📊 [Reports] ❌ Fallback also failed:', fallbackErr);
        showToast(`فشل في توليد التقرير: ${fallbackErr.message}`, 'error');
      }
    } finally {
      setGenerating(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showPreview(data: any[]) {
    if (!data || !Array.isArray(data)) {
      showToast('لا توجد بيانات للمعاينة', 'error');
      return;
    }

    setPreviewData(data);
    setShowPreviewModal(true);
  }

  function closePreviewModal() {
    setShowPreviewModal(false);
    setPreviewData(null);
  }

  function downloadPreviewAsPDF() {
    if (!previewData || previewData.length === 0) {
      showToast('لا توجد بيانات للطباعة', 'error');
      return;
    }
    generatePDF(previewData, true);
    showToast('تم تحميل التقرير بنجاح', 'success');
    closePreviewModal();
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
  }

  function getReportTypeName(type: string): string {
    const types: Record<string, string> = {
      daily: 'يومي',
      weekly: 'أسبوعي',
      monthly: 'شهري',
      custom: 'مخصص'
    };
    return types[type] || type;
  }

  function getFormatName(fmt: string): string {
    const formats: Record<string, string> = {
      csv: 'CSV',
      pdf: 'PDF',
      xlsx: 'Excel'
    };
    return formats[fmt] || fmt;
  }

  if (!isAdmin && currentPage === 'reports') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">غير مصرح</h2>
          <p className="text-slate-600">يتطلب الوصول إلى هذه الصفحة صلاحيات المسؤول</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">التقارير والتحليلات</h1>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-red-900 mb-2">خطأ في تحميل البيانات</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => fetchReportData()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const reportTypes = [
    { id: 'daily' as const, name: 'تقرير يومي', icon: Calendar },
    { id: 'weekly' as const, name: 'تقرير أسبوعي', icon: TrendingUp },
    { id: 'monthly' as const, name: 'تقرير شهري', icon: BarChart3 },
    { id: 'custom' as const, name: 'فترة مخصصة', icon: Filter },
  ];

  const isFormValid = !dateError && reportType && startDate && endDate && format;

  return (
    <div className="pb-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white font-medium`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">التقارير والتحليلات</h1>
        <p className="text-slate-600">عرض ملخص الحضور وتحميل التقارير التفصيلية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">حضور اليوم</h3>
            <Users className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{stats.todayAttendance}</p>
          <p className="text-xs opacity-75 mt-1">سجل حضور</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">حضور الشهر</h3>
            <Calendar className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{stats.monthlyAttendance}</p>
          <p className="text-xs opacity-75 mt-1">سجل حضور</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">التأخيرات</h3>
            <AlertCircle className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{stats.lateArrivals}</p>
          <p className="text-xs opacity-75 mt-1">حالة تأخير هذا الشهر</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">ساعات العمل</h3>
            <Clock className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{stats.totalHoursWorked.toFixed(1)}</p>
          <p className="text-xs opacity-75 mt-1">ساعة هذا الشهر</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-6">إعدادات التقرير</h2>

        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-bold text-slate-800">
              <Filter className="inline-block ml-2" size={18} />
              فلاتر التقرير
            </label>
            {(selectedEmployeeId !== 'all' || selectedBranchId !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
              >
                مسح الفلاتر
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">الموظف</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">كل الموظفين</option>
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} - {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">الفرع</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">كل الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">نوع التقرير</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {reportTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setReportType(type.id)}
                  className={`p-4 rounded-xl border-2 transition text-center ${
                    reportType === type.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <Icon
                    className={`mx-auto mb-2 ${reportType === type.id ? 'text-blue-600' : 'text-slate-400'}`}
                    size={24}
                  />
                  <p className={`font-medium text-sm ${reportType === type.id ? 'text-blue-700' : 'text-slate-700'}`}>
                    {type.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">تاريخ البداية</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={reportType !== 'custom'}
              className={`w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none transition ${
                reportType === 'custom'
                  ? 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  : 'bg-slate-50 cursor-not-allowed'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">تاريخ النهاية</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={reportType !== 'custom'}
              className={`w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none transition ${
                reportType === 'custom'
                  ? 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  : 'bg-slate-50 cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        {dateError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} />
            <span>{dateError}</span>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">صيغة التقرير</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setFormat('xlsx')}
              className={`py-3 px-4 border-2 rounded-lg font-medium transition ${
                format === 'xlsx'
                  ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Excel (.xlsx)
            </button>
            <button
              onClick={() => setFormat('pdf')}
              className={`py-3 px-4 border-2 rounded-lg font-medium transition ${
                format === 'pdf'
                  ? 'border-red-500 bg-red-50 text-red-700 shadow-md'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              PDF (.pdf)
            </button>
            <button
              onClick={() => setFormat('csv')}
              className={`py-3 px-4 border-2 rounded-lg font-medium transition ${
                format === 'csv'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              CSV (.csv)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">خيارات التضمين</label>
          <div className="space-y-3 bg-slate-50 rounded-lg p-4">
            <label
              className={`flex items-center gap-3 p-2 rounded transition ${
                capabilities.workHoursSupported
                  ? 'cursor-pointer hover:bg-white'
                  : 'cursor-not-allowed opacity-50'
              }`}
              title={!capabilities.workHoursSupported ? 'غير متاح - البيانات غير موجودة في قاعدة البيانات' : ''}
            >
              <input
                type="checkbox"
                checked={includeWorkDetails}
                onChange={(e) => setIncludeWorkDetails(e.target.checked)}
                disabled={!capabilities.workHoursSupported}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm text-slate-700 font-medium">تضمين تفاصيل ساعات العمل</span>
            </label>
            <label
              className={`flex items-center gap-3 p-2 rounded transition ${
                capabilities.lateDetailsSupported
                  ? 'cursor-pointer hover:bg-white'
                  : 'cursor-not-allowed opacity-50'
              }`}
              title={!capabilities.lateDetailsSupported ? 'غير متاح - البيانات غير موجودة في قاعدة البيانات' : ''}
            >
              <input
                type="checkbox"
                checked={includeLateDetails}
                onChange={(e) => setIncludeLateDetails(e.target.checked)}
                disabled={!capabilities.lateDetailsSupported}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm text-slate-700 font-medium">تضمين تفاصيل التأخير</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 mb-8">
        <button
          onClick={() => generateReport('preview')}
          disabled={!isFormValid || generating}
          className={`flex items-center justify-center gap-2 px-6 py-3 font-medium rounded-lg transition ${
            !isFormValid || generating
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>جاري التوليد...</span>
            </>
          ) : (
            <>
              <Eye size={20} />
              <span>معاينة التقرير</span>
            </>
          )}
        </button>
        <button
          onClick={() => generateReport('download')}
          disabled={!isFormValid || generating}
          className={`flex items-center justify-center gap-2 px-6 py-3 font-medium rounded-lg transition ${
            !isFormValid || generating
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>جاري التوليد...</span>
            </>
          ) : (
            <>
              <Download size={20} />
              <span>تحميل التقرير</span>
            </>
          )}
        </button>
      </div>

      {recentReports.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">التقارير الأخيرة</h2>
          <div className="space-y-3">
            {recentReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                <div className="flex items-center gap-3">
                  <FileText className="text-blue-600" size={20} />
                  <div>
                    <p className="font-medium text-slate-800">
                      تقرير {getReportTypeName(report.report_type)} - {getFormatName(report.format)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(report.created_at).toLocaleDateString('ar-SA')} •
                      من {report.start_date} إلى {report.end_date}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setReportType(report.report_type as any);
                      setStartDate(report.start_date);
                      setEndDate(report.end_date);
                      setFormat(report.format as any);
                      generateReport('preview');
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="معاينة"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setReportType(report.report_type as any);
                      setStartDate(report.start_date);
                      setEndDate(report.end_date);
                      setFormat(report.format as any);
                      generateReport('download');
                    }}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                    title="تحميل"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-1">معاينة التقرير</h2>
                <p className="text-blue-100 text-sm">
                  {reportType === 'daily' ? 'يومي' : reportType === 'weekly' ? 'أسبوعي' : reportType === 'monthly' ? 'شهري' : 'مخصص'}
                  {' • '}
                  من {startDate} إلى {endDate}
                  {selectedBranchId !== 'all' && (
                    <span className="mr-2">
                      {' • '}
                      فرع: {branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId}
                    </span>
                  )}
                  {selectedEmployeeId !== 'all' && (
                    <span className="mr-2">
                      {' • '}
                      موظف: {filteredEmployees.find(e => e.id === selectedEmployeeId)?.full_name || selectedEmployeeId}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={closePreviewModal}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition"
                title="إغلاق"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {previewData.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">لا توجد بيانات للعرض</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        {Object.keys(previewData[0]).map((header, idx) => (
                          <th key={idx} className="border border-blue-500 px-4 py-3 text-center font-semibold whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, rowIdx) => (
                        <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          {Object.keys(previewData[0]).map((header, cellIdx) => (
                            <td key={cellIdx} className="border border-gray-300 px-4 py-2 text-center">
                              {row[header] !== null && row[header] !== undefined ? String(row[header]) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">عدد السجلات:</span>
                        <span className="text-xl font-bold text-blue-700">{previewData.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">إجمالي ساعات العمل:</span>
                        <span className="text-xl font-bold text-blue-700">
                          {(() => {
                            const totalHours = previewData.reduce((sum, row) => {
                              const hours = parseFloat(row['ساعات العمل']);
                              return sum + (isNaN(hours) ? 0 : hours);
                            }, 0);
                            return totalHours.toFixed(2);
                          })()} ساعة
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-lg flex justify-between items-center">
              <p className="text-gray-600 text-sm opacity-75">
                معاينة البيانات المفلترة
              </p>
              <div className="flex gap-3">
                <button
                  onClick={downloadPreviewAsPDF}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  <Download size={18} />
                  <span>تحميل PDF</span>
                </button>
                <button
                  onClick={closePreviewModal}
                  className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

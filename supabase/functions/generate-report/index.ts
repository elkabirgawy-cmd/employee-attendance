import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { detectReportCapabilities, buildReportQuery } from '../_shared/reportCapabilities.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReportRequest {
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  format: 'csv' | 'pdf' | 'xlsx';
  includeGps?: boolean;
  includeDevice?: boolean;
  includeWorkDetails: boolean;
  includeLateDetails: boolean;
  action: 'preview' | 'download';
  employeeId?: string;
  branchId?: string;
}

interface AttendanceRecord {
  employee_code: string;
  employee_name: string;
  branch_name: string;
  check_in_time: string;
  check_out_time: string | null;
  date: string;
  total_hours: number | null;
  is_late: boolean;
  late_minutes: number;
  latitude?: number;
  longitude?: number;
  device_info?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, role_id')
      .eq('id', user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ReportRequest = await req.json();

    // Validate request
    if (!body.reportType || !body.startDate || !body.endDate || !body.format) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect schema capabilities
    console.log('[Generate Report] Detecting schema capabilities...');
    const capabilities = await detectReportCapabilities(supabase);
    console.log('[Generate Report] Capabilities:', capabilities);

    // Build dynamic query based on capabilities
    const querySelect = buildReportQuery(capabilities, {
      includeGps: body.includeGps ?? false,
      includeDevice: body.includeDevice ?? false,
      includeWorkDetails: body.includeWorkDetails,
      includeLateDetails: body.includeLateDetails,
    });

    console.log('[Generate Report] Query select:', querySelect);

    // Build query with filters
    let query = supabase
      .from('attendance_logs')
      .select(querySelect)
      .gte('check_in_time', body.startDate)
      .lte('check_in_time', `${body.endDate}T23:59:59`);

    // Apply employee filter if provided
    if (body.employeeId && body.employeeId !== 'all') {
      console.log('[Generate Report] Filtering by employee:', body.employeeId);
      query = query.eq('employee_id', body.employeeId);
    }

    // Apply branch filter if provided
    if (body.branchId && body.branchId !== 'all') {
      console.log('[Generate Report] Filtering by branch:', body.branchId);
      query = query.eq('branch_id', body.branchId);
    }

    query = query.order('check_in_time', { ascending: false });

    // Fetch attendance data
    const { data: attendanceData, error: dataError } = await query;

    if (dataError) {
      console.error('[Generate Report] Query error:', dataError);
      return new Response(
        JSON.stringify({
          error: 'فشل في جلب بيانات الحضور',
          details: dataError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process and format data
    const records: AttendanceRecord[] = (attendanceData || []).map((log: any) => {
      const checkIn = new Date(log.check_in_time);
      const checkOut = log.check_out_time ? new Date(log.check_out_time) : null;

      const formatTimeOnly = (date: Date): string => {
        return date.toLocaleTimeString('ar-SA', {
          timeZone: 'Asia/Riyadh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      };

      let totalHours = null;
      if (log.total_working_hours !== null && log.total_working_hours !== undefined) {
        totalHours = Math.round(log.total_working_hours * 100) / 100;
      } else if (checkOut) {
        totalHours = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 100) / 100;
      }

      // Calculate if late
      const shiftStart = log.shift?.start_time;
      const gracePeriod = log.shift?.grace_period_minutes || 0;
      let isLate = false;
      let lateMinutes = 0;

      if (shiftStart) {
        const [hours, minutes] = shiftStart.split(':').map(Number);
        const shiftDateTime = new Date(checkIn);
        shiftDateTime.setHours(hours, minutes + gracePeriod, 0, 0);

        if (checkIn > shiftDateTime) {
          isLate = true;
          lateMinutes = Math.floor((checkIn.getTime() - shiftDateTime.getTime()) / (1000 * 60));
        }
      }

      const record: AttendanceRecord = {
        employee_code: log.employee?.employee_code || 'N/A',
        employee_name: log.employee?.full_name || 'N/A',
        branch_name: log.branch?.name || 'N/A',
        check_in_time: formatTimeOnly(checkIn),
        check_out_time: checkOut ? formatTimeOnly(checkOut) : null,
        date: checkIn.toISOString().split('T')[0],
        total_hours: totalHours,
        is_late: isLate,
        late_minutes: lateMinutes,
      };

      if ((body.includeGps ?? false) && capabilities.gpsSupported) {
        record.latitude = log.check_in_latitude;
        record.longitude = log.check_in_longitude;
      }

      if ((body.includeDevice ?? false) && capabilities.deviceInfoSupported) {
        if (log.device) {
          const deviceParts = [];
          if (log.device.device_name) deviceParts.push(log.device.device_name);
          if (log.device.device_model) deviceParts.push(log.device.device_model);
          if (log.device.os_type) deviceParts.push(log.device.os_type);
          record.device_info = deviceParts.length > 0 ? deviceParts.join(' - ') : 'N/A';
        } else {
          record.device_info = 'N/A';
        }
      }

      return record;
    });

    // Generate report based on format
    let reportContent: string;
    let contentType: string;
    let fileName: string;

    const dateStr = new Date().toISOString().split('T')[0];
    const reportTypeName = body.reportType.charAt(0).toUpperCase() + body.reportType.slice(1);

    if (body.format === 'csv') {
      reportContent = generateCSV(records, body);
      contentType = 'text/csv; charset=utf-8';
      fileName = `${reportTypeName}_Attendance_${dateStr}.csv`;
    } else if (body.format === 'xlsx') {
      // For XLSX, we'll return JSON that the frontend can convert
      reportContent = JSON.stringify(records);
      contentType = 'application/json';
      fileName = `${reportTypeName}_Attendance_${dateStr}.json`; // Frontend will convert
    } else { // pdf
      // For PDF, we'll return JSON that the frontend can convert
      reportContent = JSON.stringify(records);
      contentType = 'application/json';
      fileName = `${reportTypeName}_Attendance_${dateStr}.json`; // Frontend will convert
    }

    // Save report metadata to database
    const { data: reportRecord, error: saveError } = await supabase
      .from('generated_reports')
      .insert({
        admin_user_id: adminUser.id,
        report_type: body.reportType,
        start_date: body.startDate,
        end_date: body.endDate,
        format: body.format,
        file_name: fileName,
        include_gps: body.includeGps ?? false,
        include_device: body.includeDevice ?? false,
        include_work_details: body.includeWorkDetails,
        include_late_details: body.includeLateDetails,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving report metadata:', saveError);
    }

    // Return response
    return new Response(
      reportContent,
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      }
    );
  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateCSV(records: AttendanceRecord[], options: ReportRequest): string {
  const headers = [
    'كود الموظف',
    'اسم الموظف',
    'الفرع',
    'التاريخ',
    'وقت الدخول',
    'وقت الخروج',
    'ساعات العمل',
    'الحالة'
  ];

  if (options.includeGps ?? false) {
    headers.push('خط العرض');
    headers.push('خط الطول');
  }

  if (options.includeDevice ?? false) {
    headers.push('معلومات الجهاز');
  }

  const rows = [headers.join(',')];

  for (const record of records) {
    const row = [
      record.employee_code,
      record.employee_name,
      record.branch_name,
      record.date,
      record.check_in_time,
      record.check_out_time || '—',
      record.total_hours !== null ? record.total_hours.toString() : '—',
      record.is_late ? 'متأخر' : 'في الوقت'
    ];

    if (options.includeGps ?? false) {
      row.push(record.latitude?.toString() || '—');
      row.push(record.longitude?.toString() || '—');
    }

    if (options.includeDevice ?? false) {
      row.push(`"${record.device_info || '—'}"`);
    }

    rows.push(row.join(','));
  }

  return '\uFEFF' + rows.join('\n'); // Add BOM for proper UTF-8 encoding in Excel
}

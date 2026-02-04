export interface ReportCapabilities {
  gpsSupported: boolean;
  deviceInfoSupported: boolean;
  shiftsSupported: boolean;
  workHoursSupported: boolean;
  lateDetailsSupported: boolean;
}

export async function detectReportCapabilities(supabase: any): Promise<ReportCapabilities> {
  const capabilities: ReportCapabilities = {
    gpsSupported: false,
    deviceInfoSupported: false,
    shiftsSupported: false,
    workHoursSupported: false,
    lateDetailsSupported: false,
  };

  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        check_in_latitude,
        check_in_longitude,
        device:devices(device_name),
        shift:shifts(start_time)
      `)
      .limit(1)
      .maybeSingle();

    if (!error) {
      capabilities.gpsSupported = true;

      if (data) {
        capabilities.deviceInfoSupported = !!data.device;
        capabilities.shiftsSupported = !!data.shift;
        capabilities.workHoursSupported = !!data.shift;
        capabilities.lateDetailsSupported = !!data.shift;
      }
    } else {
      console.warn('[Report Capabilities] Detection query failed:', error);

      if (error.message?.includes('check_in_latitude')) {
        capabilities.gpsSupported = false;
      } else {
        capabilities.gpsSupported = true;
      }

      if (error.message?.includes('devices')) {
        capabilities.deviceInfoSupported = false;
      } else {
        capabilities.deviceInfoSupported = true;
      }

      if (error.message?.includes('shifts')) {
        capabilities.shiftsSupported = false;
        capabilities.workHoursSupported = false;
        capabilities.lateDetailsSupported = false;
      } else {
        capabilities.shiftsSupported = true;
        capabilities.workHoursSupported = true;
        capabilities.lateDetailsSupported = true;
      }
    }
  } catch (err) {
    console.error('[Report Capabilities] Error detecting capabilities:', err);
  }

  return capabilities;
}

export function buildReportQuery(
  capabilities: ReportCapabilities,
  options: {
    includeGps: boolean;
    includeDevice: boolean;
    includeWorkDetails: boolean;
    includeLateDetails: boolean;
  }
) {
  const baseSelect = `
    id,
    check_in_time,
    check_out_time,
    total_working_hours,
    status,
    employee:employees(employee_code, full_name),
    branch:branches(name)
  `;

  const parts = [baseSelect];

  if (options.includeGps && capabilities.gpsSupported) {
    parts.push('check_in_latitude');
    parts.push('check_in_longitude');
    parts.push('check_out_latitude');
    parts.push('check_out_longitude');
  }

  if (options.includeDevice && capabilities.deviceInfoSupported) {
    parts.push('device:devices(device_name, device_model, os_type, os_version)');
  }

  if ((options.includeWorkDetails || options.includeLateDetails) && capabilities.shiftsSupported) {
    parts.push('shift:shifts(start_time, end_time, grace_period_minutes, name)');
  }

  return parts.join(',\n    ');
}

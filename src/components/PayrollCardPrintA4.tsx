interface PayrollCardPrintA4Props {
  employeeName: string;
  employeeCode: string;
  periodLabel: string;
  jobTitle?: string;
  department?: string;
  netSalary: number;
  currencyLabel?: string;
  earnings: {
    baseSalary: number;
    allowances: number;
    overtimeAmount: number;
    bonusesAmount: number;
  };
  deductions: {
    absence: number;
    late: number;
    penalties: number;
    socialInsurance: number;
    incomeTax: number;
  };
  attendance: {
    attendanceDays: number;
    absenceDays: number;
    lateDays: number;
  };
  overtimeHours?: number;
}

export default function PayrollCardPrintA4({
  employeeName,
  employeeCode,
  periodLabel,
  jobTitle,
  department,
  netSalary,
  currencyLabel = 'جنيه',
  earnings,
  deductions,
  attendance,
  overtimeHours
}: PayrollCardPrintA4Props) {
  const formatNumber = (num: number): string => {
    return num.toFixed(2);
  };

  const grossSalary = earnings.baseSalary + earnings.allowances + earnings.overtimeAmount + earnings.bonusesAmount;
  const totalDeductions = deductions.absence + deductions.late + deductions.penalties + deductions.socialInsurance + deductions.incomeTax;

  return (
    <div className="print-container" dir="rtl">
      <div className="print-card">
        {/* Header Section */}
        <div className="print-header">
          <div className="print-header-content">
            {/* Right: Employee Info */}
            <div className="print-employee-info">
              <h1 className="print-employee-name">{employeeName}</h1>
              <div className="print-employee-meta">
                <span>كود: {employeeCode}</span>
                <span className="print-separator">•</span>
                <span>الفترة: {periodLabel}</span>
              </div>
              {(jobTitle || department) && (
                <div className="print-job-info">
                  {jobTitle && <span>{jobTitle}</span>}
                  {jobTitle && department && <span className="print-separator">•</span>}
                  {department && <span>{department}</span>}
                </div>
              )}
            </div>

            {/* Left: Net Salary Circle */}
            <div className="print-net-circle">
              <div className="print-circle-content">
                <div className="print-circle-label">الصافي</div>
                <div className="print-circle-amount">{formatNumber(netSalary)}</div>
                <div className="print-circle-currency">{currencyLabel}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="print-main-content">
          {/* Earnings Box */}
          <div className="print-earnings-box">
            <h2 className="print-section-title">
              <span className="print-title-bar earnings-bar"></span>
              المستحقات
            </h2>
            <div className="print-items-list">
              <div className="print-item">
                <span className="print-item-label">الراتب الأساسي</span>
                <span className="print-item-value earnings-value">
                  {formatNumber(earnings.baseSalary)} {currencyLabel}
                </span>
              </div>
              <div className="print-item">
                <span className="print-item-label">البدلات</span>
                <span className="print-item-value earnings-value">
                  {formatNumber(earnings.allowances)} {currencyLabel}
                </span>
              </div>
              <div className="print-item">
                <span className="print-item-label">
                  الإضافي {overtimeHours ? `(${overtimeHours} ساعة)` : ''}
                </span>
                <span className="print-item-value earnings-value">
                  {formatNumber(earnings.overtimeAmount)} {currencyLabel}
                </span>
              </div>
              {earnings.bonusesAmount > 0 && (
                <div className="print-item">
                  <span className="print-item-label">المكافآت</span>
                  <span className="print-item-value earnings-value">
                    {formatNumber(earnings.bonusesAmount)} {currencyLabel}
                  </span>
                </div>
              )}
            </div>
            <div className="print-total">
              <span className="print-total-label">الإجمالي</span>
              <span className="print-total-value earnings-total">
                {formatNumber(grossSalary)} {currencyLabel}
              </span>
            </div>
          </div>

          {/* Deductions Box */}
          <div className="print-deductions-box">
            <h2 className="print-section-title">
              <span className="print-title-bar deductions-bar"></span>
              الخصومات
            </h2>
            <div className="print-items-list">
              <div className="print-item">
                <span className="print-item-label">خصم الغياب ({attendance.absenceDays} يوم)</span>
                <span className="print-item-value deductions-value">
                  -{formatNumber(deductions.absence)} {currencyLabel}
                </span>
              </div>
              <div className="print-item">
                <span className="print-item-label">خصم التأخير ({attendance.lateDays} يوم)</span>
                <span className="print-item-value deductions-value">
                  -{formatNumber(deductions.late)} {currencyLabel}
                </span>
              </div>
              <div className="print-item">
                <span className="print-item-label">الجزاءات</span>
                <span className="print-item-value deductions-value">
                  -{formatNumber(deductions.penalties)} {currencyLabel}
                </span>
              </div>
              <div className="print-item">
                <span className="print-item-label">التأمينات</span>
                <span className="print-item-value deductions-value">
                  -{formatNumber(deductions.socialInsurance)} {currencyLabel}
                </span>
              </div>
              <div className="print-item">
                <span className="print-item-label">الضريبة</span>
                <span className="print-item-value deductions-value">
                  -{formatNumber(deductions.incomeTax)} {currencyLabel}
                </span>
              </div>
            </div>
            <div className="print-total">
              <span className="print-total-label">الإجمالي</span>
              <span className="print-total-value deductions-total">
                -{formatNumber(totalDeductions)} {currencyLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="print-attendance">
          <div className="print-attendance-item">
            <div className="print-attendance-label">أيام الحضور</div>
            <div className="print-attendance-value attendance-present">{attendance.attendanceDays}</div>
          </div>
          <div className="print-attendance-item">
            <div className="print-attendance-label">أيام الغياب</div>
            <div className="print-attendance-value attendance-absent">{attendance.absenceDays}</div>
          </div>
          <div className="print-attendance-item">
            <div className="print-attendance-label">أيام التأخير</div>
            <div className="print-attendance-value attendance-late">{attendance.lateDays}</div>
          </div>
        </div>

        {/* Net Salary Footer */}
        <div className="print-footer">
          <span className="print-footer-label">صافي المرتب المستحق</span>
          <span className="print-footer-amount">
            {formatNumber(netSalary)} {currencyLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

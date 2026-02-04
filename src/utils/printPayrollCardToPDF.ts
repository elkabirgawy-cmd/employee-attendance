interface PayrollData {
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

export function printPayrollCardToPDF(data: PayrollData): void {
  const formatNumber = (num: number): string => num.toFixed(2);

  const grossSalary = data.earnings.baseSalary + data.earnings.allowances + data.earnings.overtimeAmount + data.earnings.bonusesAmount;
  const totalDeductions = data.deductions.absence + data.deductions.late +
    data.deductions.penalties + data.deductions.socialInsurance + data.deductions.incomeTax;
  const currencyLabel = data.currencyLabel || 'جنيه';

  // Create print styles
  const printStyles = `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      @page {
        size: A4;
        margin: 15mm;
      }

      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        direction: rtl;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }

      .print-container {
        width: 100%;
        max-width: 180mm;
        margin: 0 auto;
        page-break-inside: avoid;
      }

      .print-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        background: white;
      }

      /* Header */
      .print-header {
        background: linear-gradient(to left, #eff6ff, #ffffff);
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
      }

      .print-header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }

      .print-employee-info {
        flex: 1;
      }

      .print-employee-name {
        font-size: 18px;
        font-weight: bold;
        color: #111827;
        margin-bottom: 6px;
      }

      .print-employee-meta {
        font-size: 12px;
        color: #4b5563;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .print-separator {
        color: #9ca3af;
      }

      .print-job-info {
        margin-top: 8px;
        font-size: 11px;
        color: #6b7280;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Net Salary Circle */
      .print-net-circle {
        width: 80px;
        height: 80px;
        border: 4px solid #10b981;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
      }

      .print-circle-content {
        text-align: center;
      }

      .print-circle-label {
        font-size: 10px;
        color: #6b7280;
        margin-bottom: 2px;
      }

      .print-circle-amount {
        font-size: 16px;
        font-weight: bold;
        color: #111827;
      }

      .print-circle-currency {
        font-size: 10px;
        color: #6b7280;
        margin-top: 2px;
      }

      /* Main Content */
      .print-main-content {
        padding: 20px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .print-earnings-box,
      .print-deductions-box {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 16px;
      }

      .print-earnings-box {
        background: linear-gradient(to bottom right, #ecfdf5, #d1fae5);
      }

      .print-deductions-box {
        background: linear-gradient(to bottom right, #fef2f2, #fecaca);
      }

      .print-section-title {
        font-size: 13px;
        font-weight: bold;
        color: #1f2937;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .print-title-bar {
        width: 3px;
        height: 14px;
        border-radius: 2px;
      }

      .earnings-bar {
        background: #10b981;
      }

      .deductions-bar {
        background: #ef4444;
      }

      .print-items-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }

      .print-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        background: white;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.05);
      }

      .print-item-label {
        font-size: 11px;
        color: #4b5563;
      }

      .print-item-value {
        font-size: 12px;
        font-weight: bold;
      }

      .earnings-value {
        color: #059669;
      }

      .deductions-value {
        color: #dc2626;
      }

      .print-total {
        padding-top: 10px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .print-total-label {
        font-size: 11px;
        font-weight: 600;
        color: #374151;
      }

      .print-total-value {
        font-size: 14px;
        font-weight: bold;
      }

      .earnings-total {
        color: #047857;
      }

      .deductions-total {
        color: #b91c1c;
      }

      /* Attendance */
      .print-attendance {
        margin: 0 20px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 6px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        text-align: center;
      }

      .print-attendance-label {
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 4px;
      }

      .print-attendance-value {
        font-size: 18px;
        font-weight: bold;
      }

      .attendance-present {
        color: #059669;
      }

      .attendance-absent {
        color: #dc2626;
      }

      .attendance-late {
        color: #ea580c;
      }

      /* Footer */
      .print-footer {
        margin: 16px 20px 20px;
        padding: 16px;
        background: linear-gradient(to left, #2563eb, #1d4ed8);
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
      }

      .print-footer-label {
        font-size: 13px;
        font-weight: 600;
      }

      .print-footer-amount {
        font-size: 20px;
        font-weight: bold;
      }

      @media print {
        body {
          margin: 0;
          padding: 0;
        }

        .print-container {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .print-card {
          box-shadow: none;
        }
      }
    </style>
  `;

  // Create HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>مفردة مرتب - ${data.employeeName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      ${printStyles}
    </head>
    <body>
      <div class="print-container">
        <div class="print-card">
          <!-- Header -->
          <div class="print-header">
            <div class="print-header-content">
              <div class="print-employee-info">
                <h1 class="print-employee-name">${data.employeeName}</h1>
                <div class="print-employee-meta">
                  <span>كود: ${data.employeeCode}</span>
                  <span class="print-separator">•</span>
                  <span>الفترة: ${data.periodLabel}</span>
                </div>
                ${(data.jobTitle || data.department) ? `
                  <div class="print-job-info">
                    ${data.jobTitle ? `<span>${data.jobTitle}</span>` : ''}
                    ${data.jobTitle && data.department ? '<span class="print-separator">•</span>' : ''}
                    ${data.department ? `<span>${data.department}</span>` : ''}
                  </div>
                ` : ''}
              </div>
              <div class="print-net-circle">
                <div class="print-circle-content">
                  <div class="print-circle-label">الصافي</div>
                  <div class="print-circle-amount">${formatNumber(data.netSalary)}</div>
                  <div class="print-circle-currency">${currencyLabel}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Content -->
          <div class="print-main-content">
            <!-- Earnings -->
            <div class="print-earnings-box">
              <h2 class="print-section-title">
                <span class="print-title-bar earnings-bar"></span>
                المستحقات
              </h2>
              <div class="print-items-list">
                <div class="print-item">
                  <span class="print-item-label">الراتب الأساسي</span>
                  <span class="print-item-value earnings-value">${formatNumber(data.earnings.baseSalary)} ${currencyLabel}</span>
                </div>
                <div class="print-item">
                  <span class="print-item-label">البدلات</span>
                  <span class="print-item-value earnings-value">${formatNumber(data.earnings.allowances)} ${currencyLabel}</span>
                </div>
                <div class="print-item">
                  <span class="print-item-label">الإضافي ${data.overtimeHours ? `(${data.overtimeHours} ساعة)` : ''}</span>
                  <span class="print-item-value earnings-value">${formatNumber(data.earnings.overtimeAmount)} ${currencyLabel}</span>
                </div>
                ${data.earnings.bonusesAmount > 0 ? `
                <div class="print-item">
                  <span class="print-item-label">المكافآت</span>
                  <span class="print-item-value earnings-value">${formatNumber(data.earnings.bonusesAmount)} ${currencyLabel}</span>
                </div>
                ` : ''}
              </div>
              <div class="print-total">
                <span class="print-total-label">الإجمالي</span>
                <span class="print-total-value earnings-total">${formatNumber(grossSalary)} ${currencyLabel}</span>
              </div>
            </div>

            <!-- Deductions -->
            <div class="print-deductions-box">
              <h2 class="print-section-title">
                <span class="print-title-bar deductions-bar"></span>
                الخصومات
              </h2>
              <div class="print-items-list">
                <div class="print-item">
                  <span class="print-item-label">خصم الغياب (${data.attendance.absenceDays} يوم)</span>
                  <span class="print-item-value deductions-value">-${formatNumber(data.deductions.absence)} ${currencyLabel}</span>
                </div>
                <div class="print-item">
                  <span class="print-item-label">خصم التأخير (${data.attendance.lateDays} يوم)</span>
                  <span class="print-item-value deductions-value">-${formatNumber(data.deductions.late)} ${currencyLabel}</span>
                </div>
                <div class="print-item">
                  <span class="print-item-label">الجزاءات</span>
                  <span class="print-item-value deductions-value">-${formatNumber(data.deductions.penalties)} ${currencyLabel}</span>
                </div>
                <div class="print-item">
                  <span class="print-item-label">التأمينات</span>
                  <span class="print-item-value deductions-value">-${formatNumber(data.deductions.socialInsurance)} ${currencyLabel}</span>
                </div>
                <div class="print-item">
                  <span class="print-item-label">الضريبة</span>
                  <span class="print-item-value deductions-value">-${formatNumber(data.deductions.incomeTax)} ${currencyLabel}</span>
                </div>
              </div>
              <div class="print-total">
                <span class="print-total-label">الإجمالي</span>
                <span class="print-total-value deductions-total">-${formatNumber(totalDeductions)} ${currencyLabel}</span>
              </div>
            </div>
          </div>

          <!-- Attendance -->
          <div class="print-attendance">
            <div class="print-attendance-item">
              <div class="print-attendance-label">أيام الحضور</div>
              <div class="print-attendance-value attendance-present">${data.attendance.attendanceDays}</div>
            </div>
            <div class="print-attendance-item">
              <div class="print-attendance-label">أيام الغياب</div>
              <div class="print-attendance-value attendance-absent">${data.attendance.absenceDays}</div>
            </div>
            <div class="print-attendance-item">
              <div class="print-attendance-label">أيام التأخير</div>
              <div class="print-attendance-value attendance-late">${data.attendance.lateDays}</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="print-footer">
            <span class="print-footer-label">صافي المرتب المستحق</span>
            <span class="print-footer-amount">${formatNumber(data.netSalary)} ${currencyLabel}</span>
          </div>
        </div>
      </div>

      <script>
        // Auto-print when loaded
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 250);
        };

        // Close window after print (both success and cancel)
        window.onafterprint = function() {
          setTimeout(function() {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `;

  // Open print window
  const printWindow = window.open('', '_blank', 'width=800,height=600');

  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    // Fallback: create an iframe if popup was blocked
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    }
  }
}

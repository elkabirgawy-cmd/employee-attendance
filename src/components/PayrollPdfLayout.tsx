interface PayrollRun {
  id: string;
  employee_id: string;
  period_month: number;
  period_year: number;
  base_salary: number;
  allowances: number;
  overtime_hours: number;
  overtime_amount: number;
  present_days: number;
  absence_days: number;
  absence_deduction: number;
  late_days: number;
  lateness_deduction: number;
  penalties_deduction: number;
  social_insurance: number;
  income_tax: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  employees?: {
    full_name: string;
    employee_code: string;
  };
}

interface PayrollPdfLayoutProps {
  payrollData: PayrollRun;
  currency: string;
  language: 'ar' | 'en';
  companyName?: string;
}

export default function PayrollPdfLayout({
  payrollData,
  currency,
  language,
  companyName
}: PayrollPdfLayoutProps) {
  const monthYear = `${payrollData.period_month}/${payrollData.period_year}`;
  const employeeName = payrollData.employees?.full_name || 'N/A';
  const employeeCode = payrollData.employees?.employee_code || 'N/A';

  return (
    <div className="print-only" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="pdf-container">
        <div className="pdf-header">
          <div className="pdf-header-content">
            <h1 className="pdf-title">{language === 'ar' ? 'كشف المرتب' : 'Payroll Statement'}</h1>
            {companyName && <div className="pdf-company">{companyName}</div>}
          </div>
        </div>

        <div className="pdf-section">
          <div className="pdf-info-grid">
            <div className="pdf-info-item">
              <span className="pdf-label">{language === 'ar' ? 'اسم الموظف:' : 'Employee Name:'}</span>
              <span className="pdf-value">{employeeName}</span>
            </div>
            <div className="pdf-info-item">
              <span className="pdf-label">{language === 'ar' ? 'رقم الموظف:' : 'Employee Code:'}</span>
              <span className="pdf-value">{employeeCode}</span>
            </div>
            <div className="pdf-info-item">
              <span className="pdf-label">{language === 'ar' ? 'الفترة:' : 'Period:'}</span>
              <span className="pdf-value">{monthYear}</span>
            </div>
          </div>
        </div>

        <div className="pdf-section">
          <h2 className="pdf-section-title">{language === 'ar' ? 'الحضور' : 'Attendance'}</h2>
          <table className="pdf-table">
            <tbody>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'أيام الحضور' : 'Present Days'}</td>
                <td className="pdf-td-value">{payrollData.present_days}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'أيام الغياب' : 'Absence Days'}</td>
                <td className="pdf-td-value">{payrollData.absence_days}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'أيام التأخير' : 'Late Days'}</td>
                <td className="pdf-td-value">{payrollData.late_days}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pdf-section">
          <h2 className="pdf-section-title">{language === 'ar' ? 'المستحقات' : 'Earnings'}</h2>
          <table className="pdf-table">
            <tbody>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</td>
                <td className="pdf-td-value">{parseFloat(String(payrollData.base_salary)).toFixed(2)} {currency}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'البدلات' : 'Allowances'}</td>
                <td className="pdf-td-value">{parseFloat(String(payrollData.allowances)).toFixed(2)} {currency}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">
                  {language === 'ar' ? 'الإضافي' : 'Overtime'}
                  <span className="pdf-subtext"> ({payrollData.overtime_hours} {language === 'ar' ? 'ساعة' : 'hours'})</span>
                </td>
                <td className="pdf-td-value">{parseFloat(String(payrollData.overtime_amount)).toFixed(2)} {currency}</td>
              </tr>
              <tr className="pdf-total-row">
                <td className="pdf-td-label"><strong>{language === 'ar' ? 'إجمالي الراتب' : 'Gross Salary'}</strong></td>
                <td className="pdf-td-value"><strong>{parseFloat(String(payrollData.gross_salary)).toFixed(2)} {currency}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pdf-section">
          <h2 className="pdf-section-title">{language === 'ar' ? 'الخصومات' : 'Deductions'}</h2>
          <table className="pdf-table">
            <tbody>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'خصم الغياب' : 'Absence Deduction'}</td>
                <td className="pdf-td-value">-{parseFloat(String(payrollData.absence_deduction)).toFixed(2)} {currency}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'خصم التأخير' : 'Late Deduction'}</td>
                <td className="pdf-td-value">-{parseFloat(String(payrollData.lateness_deduction)).toFixed(2)} {currency}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'الجزاءات' : 'Penalties'}</td>
                <td className="pdf-td-value">-{parseFloat(String(payrollData.penalties_deduction)).toFixed(2)} {currency}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'التأمينات الاجتماعية' : 'Social Insurance'}</td>
                <td className="pdf-td-value">-{parseFloat(String(payrollData.social_insurance)).toFixed(2)} {currency}</td>
              </tr>
              <tr>
                <td className="pdf-td-label">{language === 'ar' ? 'ضريبة الدخل' : 'Income Tax'}</td>
                <td className="pdf-td-value">-{parseFloat(String(payrollData.income_tax)).toFixed(2)} {currency}</td>
              </tr>
              <tr className="pdf-total-row">
                <td className="pdf-td-label"><strong>{language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions'}</strong></td>
                <td className="pdf-td-value"><strong>-{parseFloat(String(payrollData.total_deductions)).toFixed(2)} {currency}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pdf-section pdf-final">
          <div className="pdf-net-salary">
            <span className="pdf-net-label">{language === 'ar' ? 'صافي الراتب' : 'Net Salary'}</span>
            <span className="pdf-net-value">{parseFloat(String(payrollData.net_salary)).toFixed(2)} {currency}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden;
          }

          .print-only,
          .print-only * {
            visibility: visible;
          }

          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }

          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }

        .pdf-container {
          max-width: 210mm;
          margin: 0 auto;
          background: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          color: #000;
          font-size: 11pt;
          line-height: 1.5;
        }

        .pdf-header {
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }

        .pdf-header-content {
          text-align: center;
        }

        .pdf-title {
          font-size: 18pt;
          font-weight: bold;
          margin: 0 0 5px 0;
          color: #000;
        }

        .pdf-company {
          font-size: 12pt;
          color: #333;
          margin: 0;
        }

        .pdf-section {
          margin-bottom: 20px;
        }

        .pdf-section-title {
          font-size: 13pt;
          font-weight: bold;
          margin: 0 0 10px 0;
          padding: 5px 10px;
          background: #f5f5f5;
          border-left: 4px solid #000;
          color: #000;
        }

        [dir="rtl"] .pdf-section-title {
          border-left: none;
          border-right: 4px solid #000;
        }

        .pdf-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 10px;
          background: #fafafa;
          border: 1px solid #ddd;
        }

        .pdf-info-item {
          display: flex;
          gap: 8px;
        }

        .pdf-label {
          font-weight: 600;
          color: #333;
        }

        .pdf-value {
          color: #000;
        }

        .pdf-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #ddd;
        }

        .pdf-td-label,
        .pdf-td-value {
          padding: 8px 12px;
          border: 1px solid #ddd;
        }

        .pdf-td-label {
          background: #fafafa;
          font-weight: 500;
          width: 60%;
        }

        .pdf-td-value {
          text-align: ${language === 'ar' ? 'left' : 'right'};
          font-weight: 600;
          width: 40%;
        }

        .pdf-subtext {
          font-size: 9pt;
          color: #666;
          font-weight: normal;
        }

        .pdf-total-row {
          background: #f0f0f0;
        }

        .pdf-total-row td {
          border-top: 2px solid #000;
          padding: 10px 12px;
        }

        .pdf-final {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 3px double #000;
        }

        .pdf-net-salary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: #f5f5f5;
          border: 2px solid #000;
        }

        .pdf-net-label {
          font-size: 14pt;
          font-weight: bold;
          color: #000;
        }

        .pdf-net-value {
          font-size: 16pt;
          font-weight: bold;
          color: #000;
        }
      `}</style>
    </div>
  );
}

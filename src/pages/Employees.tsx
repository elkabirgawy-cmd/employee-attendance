import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, UserCheck, UserX, X, Key, Copy, Check, ChevronLeft, ChevronRight, Building2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { normalizeEgyptPhone } from '../utils/phoneNormalization';
import Avatar from '../components/Avatar';
import ImageUpload from '../components/ImageUpload';
import AdminPageShell from '../components/admin-ui/AdminPageShell';
import AdminCard from '../components/admin-ui/AdminCard';
import AdminSearchInput from '../components/admin-ui/AdminSearchInput';
import AdminFilterChips, { FilterChip } from '../components/admin-ui/AdminFilterChips';
import AdminEmptyState from '../components/admin-ui/AdminEmptyState';
import AdminSkeleton from '../components/admin-ui/AdminSkeleton';
import { useAdminTheme } from '../contexts/AdminThemeContext';

interface EmployeesProps {
  currentPage?: string;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
}

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string | null;
  department: string | null;
  department_id: string | null;
  is_active: boolean;
  hire_date: string;
  branch_id: string | null;
  shift_id: string | null;
  custom_working_days: number | null;
  custom_working_days_enabled: boolean;
  weekly_off_days: number[] | null;
  avatar_url: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  late_grace_min: number;
  early_grace_min: number;
  monthly_salary: number | null;
  allowances: number | null;
  salary_mode: string | null;
  social_insurance_value: number | null;
  income_tax_value: number | null;
  branches?: { name: string };
  departments?: { name: string };
  shifts?: { name: string };
  created_at?: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  name: string;
}

interface EmployeeFormData {
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  department_id: string;
  branch_id: string;
  shift_id: string;
  hire_date: string;
  custom_working_days: string;
  custom_working_days_enabled: boolean;
  weekly_off_days: number[];
  work_start_time: string;
  work_end_time: string;
  late_grace_min: string;
  early_grace_min: string;
  monthly_salary: string;
  salary_mode: string;
  social_insurance_value: string;
  income_tax_value: string;
}

const ITEMS_PER_PAGE = 10;

export default function Employees({ currentPage, onNavigate }: EmployeesProps) {
  const { language } = useLanguage();
  const { companyId } = useAuth();
  const theme = useAdminTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showActivationCodeModal, setShowActivationCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [currentPage2, setCurrentPage2] = useState(1);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoEmployee, setPhotoEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    department_id: '',
    branch_id: '',
    shift_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    custom_working_days: '',
    custom_working_days_enabled: false,
    weekly_off_days: [],
    work_start_time: '',
    work_end_time: '',
    late_grace_min: '0',
    early_grace_min: '0',
    monthly_salary: '0',
    salary_mode: 'monthly',
    social_insurance_value: '0',
    income_tax_value: '0',
  });

  useEffect(() => {
    if (currentPage === 'employees') {
      fetchEmployees();
      fetchBranches();
      fetchDepartments();
      fetchShifts();
    }
  }, [currentPage]);

  useEffect(() => {
    if (currentPage === 'employees' && branches.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openAddModal') === 'true') {
        setShowAddModal(true);
        urlParams.delete('openAddModal');
        window.history.replaceState({}, '', `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`);
      }
    } else if (currentPage === 'employees' && branches.length === 0) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openAddModal') === 'true') {
        alert(language === 'ar' ? 'أضف فرع أولاً' : 'Add a branch first');
        urlParams.delete('openAddModal');
        window.history.replaceState({}, '', `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`);
      }
    }
  }, [currentPage, branches, language]);

  useEffect(() => {
    filterEmployees();
  }, [searchTerm, filterStatus, filterBranch, filterShift, employees]);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          branches (name),
          departments (name),
          shifts (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  }

  async function fetchDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  }

  async function fetchShifts() {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (branches.length === 0) {
      alert(language === 'ar' ? 'أضف فرع أولاً' : 'Add a branch first');
      return;
    }

    if (!formData.branch_id) {
      alert(language === 'ar' ? 'اختيار الفرع إلزامي' : 'Branch selection is required');
      return;
    }

    setSubmitting(true);

    try {
      const employeeCode = `EMP${Date.now().toString().slice(-6)}`;
      const normalizedPhone = normalizeEgyptPhone(formData.phone);

      const salaryValue = formData.monthly_salary ? parseFloat(formData.monthly_salary) : 0;

      const { error } = await supabase.from('employees').insert({
        employee_code: employeeCode,
        full_name: formData.full_name,
        email: formData.email,
        phone: normalizedPhone,
        job_title: formData.job_title,
        department_id: formData.department_id || null,
        branch_id: formData.branch_id || null,
        shift_id: formData.shift_id || null,
        hire_date: formData.hire_date,
        is_active: true,
        company_id: companyId,
        custom_working_days: formData.custom_working_days_enabled && formData.custom_working_days ? parseInt(formData.custom_working_days) : null,
        custom_working_days_enabled: formData.custom_working_days_enabled,
        work_start_time: formData.work_start_time || null,
        work_end_time: formData.work_end_time || null,
        late_grace_min: formData.late_grace_min ? parseInt(formData.late_grace_min) : 0,
        early_grace_min: formData.early_grace_min ? parseInt(formData.early_grace_min) : 0,
        weekly_off_days: formData.weekly_off_days.length > 0 ? formData.weekly_off_days : null,
        monthly_salary: salaryValue,
        salary_mode: formData.salary_mode || 'monthly',
        salary_base: salaryValue,
        salary_type: formData.salary_mode || 'monthly',
        social_insurance_value: formData.social_insurance_value ? parseFloat(formData.social_insurance_value) : 0,
        income_tax_value: formData.income_tax_value ? parseFloat(formData.income_tax_value) : 0,
      });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        job_title: '',
        department_id: '',
        branch_id: '',
        shift_id: '',
        hire_date: new Date().toISOString().split('T')[0],
        custom_working_days: '',
        custom_working_days_enabled: false,
        weekly_off_days: [],
        work_start_time: '',
        work_end_time: '',
        late_grace_min: '0',
        early_grace_min: '0',
        monthly_salary: '0',
        salary_mode: 'monthly',
        social_insurance_value: '0',
        income_tax_value: '0',
      });
      fetchEmployees();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      alert(error.message || 'Failed to add employee');
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(employee: Employee) {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone,
      job_title: employee.job_title || '',
      department_id: employee.department_id || '',
      branch_id: employee.branch_id || '',
      shift_id: employee.shift_id || '',
      hire_date: employee.hire_date,
      custom_working_days: employee.custom_working_days?.toString() || '',
      custom_working_days_enabled: employee.custom_working_days_enabled || false,
      weekly_off_days: employee.weekly_off_days || [],
      work_start_time: employee.work_start_time || '',
      work_end_time: employee.work_end_time || '',
      late_grace_min: employee.late_grace_min?.toString() || '0',
      early_grace_min: employee.early_grace_min?.toString() || '0',
      monthly_salary: employee.monthly_salary?.toString() || '0',
      salary_mode: employee.salary_mode || 'monthly',
      social_insurance_value: employee.social_insurance_value?.toString() || '0',
      income_tax_value: employee.income_tax_value?.toString() || '0',
    });
    setShowEditModal(true);
    setShowDrawer(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;

    setSubmitting(true);

    try {
      const normalizedPhone = normalizeEgyptPhone(formData.phone);
      const salaryValue = formData.monthly_salary ? parseFloat(formData.monthly_salary) : 0;

      const { error } = await supabase
        .from('employees')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: normalizedPhone,
          job_title: formData.job_title,
          department_id: formData.department_id || null,
          branch_id: formData.branch_id || null,
          shift_id: formData.shift_id || null,
          hire_date: formData.hire_date,
          custom_working_days: formData.custom_working_days_enabled && formData.custom_working_days ? parseInt(formData.custom_working_days) : null,
          custom_working_days_enabled: formData.custom_working_days_enabled,
          weekly_off_days: formData.weekly_off_days.length > 0 ? formData.weekly_off_days : null,
          work_start_time: formData.work_start_time || null,
          work_end_time: formData.work_end_time || null,
          late_grace_min: formData.late_grace_min ? parseInt(formData.late_grace_min) : 0,
          early_grace_min: formData.early_grace_min ? parseInt(formData.early_grace_min) : 0,
          monthly_salary: salaryValue,
          salary_mode: formData.salary_mode || 'monthly',
          salary_base: salaryValue,
          salary_type: formData.salary_mode || 'monthly',
          social_insurance_value: formData.social_insurance_value ? parseFloat(formData.social_insurance_value) : 0,
          income_tax_value: formData.income_tax_value ? parseFloat(formData.income_tax_value) : 0,
        })
        .eq('id', editingEmployee.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingEmployee(null);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        job_title: '',
        department_id: '',
        branch_id: '',
        shift_id: '',
        hire_date: new Date().toISOString().split('T')[0],
        custom_working_days: '',
        custom_working_days_enabled: false,
        weekly_off_days: [],
        work_start_time: '',
        work_end_time: '',
        late_grace_min: '0',
        early_grace_min: '0',
        monthly_salary: '0',
        salary_mode: 'monthly',
        social_insurance_value: '0',
        income_tax_value: '0',
      });
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      alert(error.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(employeeId: string, employeeName: string) {
    setEmployeeToDelete({ id: employeeId, name: employeeName });
    setShowDeleteModal(true);
    setShowDrawer(false);
  }

  async function handleDelete() {
    if (!employeeToDelete) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeToDelete.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      alert(error.message || 'Failed to delete employee');
    }
  }

  async function toggleEmployeeStatus(employeeId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: !currentStatus })
        .eq('id', employeeId);

      if (error) throw error;

      fetchEmployees();
      if (selectedEmployee && selectedEmployee.id === employeeId) {
        setSelectedEmployee({ ...selectedEmployee, is_active: !currentStatus });
      }
    } catch (error: any) {
      console.error('Error toggling employee status:', error);
      alert(error.message || 'Failed to update employee status');
    }
  }

  async function generateActivationCode(employee: Employee) {
    setGeneratingCode(true);
    setCodeCopied(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existingCodes, error: fetchError } = await supabase
        .from('activation_codes')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString());

      if (fetchError) throw fetchError;

      if (existingCodes && existingCodes.length > 0) {
        for (const code of existingCodes) {
          await supabase
            .from('activation_codes')
            .update({ is_used: true, used_at: new Date().toISOString() })
            .eq('id', code.id);
        }
      }

      const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const { error: insertError } = await supabase
        .from('activation_codes')
        .insert({
          employee_id: employee.id,
          activation_code: activationCode,
          is_used: false,
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
        });

      if (insertError) throw insertError;

      setGeneratedCode(activationCode);
      setShowActivationCodeModal(true);
    } catch (error: any) {
      console.error('Error generating activation code:', error);
      alert(error.message || 'Failed to generate activation code');
    } finally {
      setGeneratingCode(false);
    }
  }

  function handleGenerateCode(employeeId: string) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (employee) {
      generateActivationCode(employee);
    }
  }

  function copyCodeToClipboard() {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function filterEmployees() {
    let filtered = [...employees];

    if (searchTerm) {
      filtered = filtered.filter(
        (emp) =>
          emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((emp) =>
        filterStatus === 'active' ? emp.is_active : !emp.is_active
      );
    }

    if (filterBranch !== 'all') {
      filtered = filtered.filter((emp) => emp.branch_id === filterBranch);
    }

    if (filterShift !== 'all') {
      filtered = filtered.filter((emp) => emp.shift_id === filterShift);
    }

    setFilteredEmployees(filtered);
    setCurrentPage2(1);
  }

  function handleRowClick(employee: Employee) {
    setSelectedEmployee(employee);
    setShowDrawer(true);
  }

  const uniqueDepartments = Array.from(new Set(employees.map(emp => emp.department).filter(Boolean)));

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage2 - 1) * ITEMS_PER_PAGE,
    currentPage2 * ITEMS_PER_PAGE
  );

  const activeFiltersCount = [
    filterStatus !== 'all',
    filterBranch !== 'all',
    filterShift !== 'all',
    searchTerm !== ''
  ].filter(Boolean).length;

  const chips: FilterChip[] = [];
  if (filterStatus !== 'all') {
    chips.push({
      id: 'status',
      label: language === 'ar' ? 'الحالة' : 'Status',
      value: filterStatus === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'موقوف' : 'Inactive'),
      onRemove: () => setFilterStatus('all')
    });
  }
  if (filterBranch !== 'all') {
    const branchName = branches.find(b => b.id === filterBranch)?.name || filterBranch;
    chips.push({
      id: 'branch',
      label: language === 'ar' ? 'الفرع' : 'Branch',
      value: branchName,
      onRemove: () => setFilterBranch('all')
    });
  }
  if (filterShift !== 'all') {
    const shiftName = shifts.find(s => s.id === filterShift)?.name || filterShift;
    chips.push({
      id: 'shift',
      label: language === 'ar' ? 'الوردية' : 'Shift',
      value: shiftName,
      onRemove: () => setFilterShift('all')
    });
  }

  const handleResetFilters = () => {
    setFilterStatus('all');
    setFilterBranch('all');
    setFilterShift('all');
    setSearchTerm('');
  };

  if (currentPage !== 'employees') return null;

  return (
    <AdminPageShell
      title={language === 'ar' ? 'الموظفون' : 'Employees'}
      subtitle={language === 'ar' ? `إجمالي ${employees.length} موظف` : `Total ${employees.length} employees`}
      actions={
        <button
          onClick={() => {
            if (branches.length === 0) {
              alert(language === 'ar' ? 'أضف فرع أولاً' : 'Add a branch first');
              return;
            }
            setShowAddModal(true);
          }}
          className={theme.button.primary}
        >
          <Plus size={20} />
          {language === 'ar' ? 'إضافة موظف' : 'Add Employee'}
        </button>
      }
    >

      {/* Search and Filters */}
      <AdminCard className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminSearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={language === 'ar' ? 'بحث بالاسم، الرقم، الهاتف...' : 'Search by name, ID, phone...'}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className={theme.input.base}
          >
            <option value="all">{language === 'ar' ? 'الحالة: الكل' : 'Status: All'}</option>
            <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
            <option value="inactive">{language === 'ar' ? 'موقوف' : 'Inactive'}</option>
          </select>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className={theme.input.base}
          >
            <option value="all">{language === 'ar' ? 'الفرع: الكل' : 'Branch: All'}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className={theme.input.base}
          >
            <option value="all">{language === 'ar' ? 'الوردية: الكل' : 'Shift: All'}</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name}
              </option>
            ))}
          </select>
        </div>
        <AdminFilterChips
          chips={chips}
          onReset={handleResetFilters}
          className="mt-4"
        />
      </AdminCard>

      {/* Content */}
      <div className="space-y-6">
        {
          loading ? (
            <div className="space-y-3" >
              <AdminSkeleton type="card" count={5} className="h-20" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <AdminEmptyState
              icon={UserX}
              title={language === 'ar' ? 'لا يوجد موظفون' : 'No employees found'}
              description={language === 'ar' ? 'جرب تعديل البحث أو المرشحات' : 'Try adjusting your search or filters'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50 border-b border-gray-200 backdrop-blur-sm">
                      <tr>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                        </th>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'الاسم' : 'Name'}
                        </th>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'رقم الموظف' : 'Employee ID'}
                        </th>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'القسم' : 'Department'}
                        </th>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'الفرع' : 'Branch'}
                        </th>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'الحالة' : 'Status'}
                        </th>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'الإجراءات' : 'Actions'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEmployees.map((employee, index) => (
                        <tr
                          key={employee.id}
                          className="bg-white border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => handleRowClick(employee)}
                        >
                          <td className="py-4 px-6">
                            <Avatar src={employee.avatar_url} name={employee.full_name} size="sm" />
                          </td>
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-medium text-slate-800">{employee.full_name}</p>
                              <p className="text-xs text-slate-500">{employee.email}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                              {employee.employee_code}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div>
                              <p className="text-sm font-medium text-slate-700">{employee.job_title || '-'}</p>
                              <p className="text-xs text-slate-500">{employee.department || '-'}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-slate-400" />
                              <span className="text-sm text-slate-600">{employee.branches?.name || '-'}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {employee.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                <UserCheck size={14} />
                                {language === 'ar' ? 'نشط' : 'Active'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                                <UserX size={14} />
                                {language === 'ar' ? 'موقوف' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleEdit(employee)}
                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                                title={language === 'ar' ? 'تعديل' : 'Edit'}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => confirmDelete(employee.id, employee.full_name)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                                title={language === 'ar' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {paginatedEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition"
                  >
                    <div
                      onClick={() => handleRowClick(employee)}
                      className="p-4 cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar src={employee.avatar_url} name={employee.full_name} size="sm" />
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{employee.full_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{employee.employee_code}</p>
                        </div>
                        {employee.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <UserCheck size={12} />
                            {language === 'ar' ? 'نشط' : 'Active'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                            <UserX size={12} />
                            {language === 'ar' ? 'موقوف' : 'Inactive'}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-medium">{language === 'ar' ? 'القسم:' : 'Dept:'}</span>
                          <span>{employee.departments?.name || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 size={14} className="text-slate-400" />
                          <span>{employee.branches?.name || '-'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateCode(employee.id);
                        }}
                        className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors rounded-b-xl"
                      >
                        <Key size={16} />
                        {language === 'ar' ? 'كود التفعيل' : 'Activation Code'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-600">
                    {language === 'ar'
                      ? `عرض ${(currentPage2 - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage2 * ITEMS_PER_PAGE, filteredEmployees.length)} من ${filteredEmployees.length}`
                      : `Showing ${(currentPage2 - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage2 * ITEMS_PER_PAGE, filteredEmployees.length)} of ${filteredEmployees.length}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage2(Math.max(1, currentPage2 - 1))}
                      disabled={currentPage2 === 1}
                      className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {language === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                    <span className="text-sm font-medium text-slate-700">
                      {currentPage2} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage2(Math.min(totalPages, currentPage2 + 1))}
                      disabled={currentPage2 === totalPages}
                      className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {language === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        }
      </div >

      {/* Employee Details Drawer */}
      {
        showDrawer && selectedEmployee && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowDrawer(false)}
            />
            <div
              className={`fixed top-0 ${language === 'ar' ? 'left-0' : 'right-0'} h-full w-full md:w-[500px] bg-white shadow-2xl z-50 overflow-y-auto`}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            >
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-md">
                <div className="flex items-start justify-between mb-4">
                  <button
                    onClick={() => setShowDrawer(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="relative mb-3">
                    <Avatar src={selectedEmployee.avatar_url} name={selectedEmployee.full_name} size="xl" />
                    <button
                      onClick={() => {
                        setPhotoEmployee(selectedEmployee);
                        setShowPhotoModal(true);
                      }}
                      className="absolute bottom-0 right-0 p-2 bg-white hover:bg-slate-100 text-blue-600 rounded-full shadow-lg transition"
                      title={language === 'ar' ? 'تغيير الصورة' : 'Change Photo'}
                    >
                      <ImageIcon size={16} />
                    </button>
                  </div>
                  <h2 className="text-2xl font-bold">{selectedEmployee.full_name}</h2>
                  <p className="text-sm text-blue-100 mt-1">{selectedEmployee.employee_code}</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  {selectedEmployee.is_active ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-full">
                      <UserCheck size={14} />
                      {language === 'ar' ? 'نشط' : 'Active'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-sm font-medium rounded-full">
                      <UserX size={14} />
                      {language === 'ar' ? 'موقوف' : 'Inactive'}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-3">
                    {language === 'ar' ? 'معلومات الاتصال' : 'Contact Information'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'البريد:' : 'Email:'}</span>
                      <p className="font-medium text-slate-700">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'الهاتف:' : 'Phone:'}</span>
                      <p className="font-medium text-slate-700">{selectedEmployee.phone}</p>
                    </div>
                  </div>
                </div>

                {/* Job Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-3">
                    {language === 'ar' ? 'معلومات الوظيفة' : 'Job Information'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'المسمى:' : 'Position:'}</span>
                      <p className="font-medium text-slate-700">{selectedEmployee.job_title || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'القسم:' : 'Department:'}</span>
                      <p className="font-medium text-slate-700">{selectedEmployee.department || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'الفرع:' : 'Branch:'}</span>
                      <p className="font-medium text-slate-700">{selectedEmployee.branches?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'الوردية:' : 'Shift:'}</span>
                      <p className="font-medium text-slate-700">{selectedEmployee.shifts?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'تاريخ التعيين:' : 'Hire Date:'}</span>
                      <p className="font-medium text-slate-700">
                        {new Date(selectedEmployee.hire_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary Info */}
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h3 className="font-semibold text-slate-800 mb-3">
                    {language === 'ar' ? 'معلومات الراتب' : 'Salary Information'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'نظام الراتب:' : 'Salary Mode:'}</span>
                      <p className="font-medium text-slate-700">
                        {selectedEmployee.salary_mode === 'monthly'
                          ? (language === 'ar' ? 'شهري' : 'Monthly')
                          : selectedEmployee.salary_mode === 'daily'
                            ? (language === 'ar' ? 'يومي' : 'Daily')
                            : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'المرتب الأساسي:' : 'Base Salary:'}</span>
                      <p className="font-bold text-green-700">
                        {selectedEmployee.monthly_salary
                          ? `${selectedEmployee.monthly_salary.toFixed(2)} ${language === 'ar' ? 'ريال' : 'SAR'}`
                          : '-'}
                      </p>
                    </div>
                    {selectedEmployee.allowances && selectedEmployee.allowances > 0 && (
                      <div>
                        <span className="text-slate-500">{language === 'ar' ? 'البدلات:' : 'Allowances:'}</span>
                        <p className="font-medium text-slate-700">
                          {selectedEmployee.allowances.toFixed(2)} {language === 'ar' ? 'ريال' : 'SAR'}
                        </p>
                      </div>
                    )}
                    {selectedEmployee.social_insurance_value && selectedEmployee.social_insurance_value > 0 && (
                      <div>
                        <span className="text-slate-500">{language === 'ar' ? 'التأمينات الاجتماعية:' : 'Social Insurance:'}</span>
                        <p className="font-medium text-red-600">
                          -{selectedEmployee.social_insurance_value.toFixed(2)} {language === 'ar' ? 'ريال' : 'SAR'}
                        </p>
                      </div>
                    )}
                    {selectedEmployee.income_tax_value && selectedEmployee.income_tax_value > 0 && (
                      <div>
                        <span className="text-slate-500">{language === 'ar' ? 'ضريبة الدخل:' : 'Income Tax:'}</span>
                        <p className="font-medium text-red-600">
                          -{selectedEmployee.income_tax_value.toFixed(2)} {language === 'ar' ? 'ريال' : 'SAR'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={() => toggleEmployeeStatus(selectedEmployee.id, selectedEmployee.is_active)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition ${selectedEmployee.is_active
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-green-100 hover:bg-green-200 text-green-700'
                      }`}
                  >
                    {selectedEmployee.is_active ? (
                      <>
                        <UserX size={18} />
                        {language === 'ar' ? 'إيقاف الموظف' : 'Deactivate Employee'}
                      </>
                    ) : (
                      <>
                        <UserCheck size={18} />
                        {language === 'ar' ? 'تفعيل الموظف' : 'Activate Employee'}
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => generateActivationCode(selectedEmployee)}
                    disabled={generatingCode}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition disabled:opacity-50"
                  >
                    <Key size={18} />
                    {generatingCode
                      ? language === 'ar' ? 'جاري الإصدار...' : 'Generating...'
                      : language === 'ar' ? 'إصدار كود تفعيل' : 'Generate Activation Code'}
                  </button>

                  <button
                    onClick={() => handleEdit(selectedEmployee)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition"
                  >
                    <Edit2 size={18} />
                    {language === 'ar' ? 'تعديل البيانات' : 'Edit Details'}
                  </button>

                  <button
                    onClick={() => confirmDelete(selectedEmployee.id, selectedEmployee.full_name)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition"
                  >
                    <Trash2 size={18} />
                    {language === 'ar' ? 'حذف الموظف' : 'Delete Employee'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      }

      {/* Delete Confirmation Modal */}
      {
        showDeleteModal && employeeToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                </h2>
                <p className="text-sm text-slate-600 mb-6">
                  {language === 'ar'
                    ? `هل أنت متأكد من حذف الموظف "${employeeToDelete.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                    : `Are you sure you want to delete employee "${employeeToDelete.name}"? This action cannot be undone.`}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setEmployeeToDelete(null);
                    }}
                    className="flex-1 px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                  >
                    {language === 'ar' ? 'حذف' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Add/Edit Modal - keeping the existing modals code */}
      {
        showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {language === 'ar' ? 'إضافة موظف' : 'Add Employee'}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {language === 'ar' ? 'أدخل معلومات الموظف الجديد' : 'Enter new employee information'}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X size={24} className="text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الاسم' : 'Full Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email'} *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الهاتف' : 'Phone'} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'المسمى الوظيفي' : 'Job Title'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'القسم' : 'Department'}
                    </label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">{language === 'ar' ? 'اختر القسم' : 'Select Department'}</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الفرع' : 'Branch'}
                    </label>
                    <select
                      value={formData.branch_id}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">{language === 'ar' ? 'اختر الفرع' : 'Select Branch'}</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الوردية' : 'Shift'}
                    </label>
                    <select
                      value={formData.shift_id}
                      onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">{language === 'ar' ? 'اختر الوردية' : 'Select Shift'}</option>
                      {shifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'تاريخ التعيين' : 'Hire Date'} *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'وقت العمل من' : 'Work Start Time'}
                    </label>
                    <input
                      type="time"
                      value={formData.work_start_time}
                      onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'وقت العمل إلى' : 'Work End Time'}
                    </label>
                    <input
                      type="time"
                      value={formData.work_end_time}
                      onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'سماحية التأخير (دقيقة)' : 'Late Grace (minutes)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.late_grace_min}
                      onChange={(e) => setFormData({ ...formData, late_grace_min: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'سماحية الانصراف المبكر (دقيقة)' : 'Early Leave Grace (minutes)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.early_grace_min}
                      onChange={(e) => setFormData({ ...formData, early_grace_min: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'نظام الراتب' : 'Salary Type'} *
                    </label>
                    <select
                      value={formData.salary_mode}
                      onChange={(e) => setFormData({ ...formData, salary_mode: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                      <option value="daily">{language === 'ar' ? 'يومي' : 'Daily'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'} *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={formData.monthly_salary}
                      onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <Key size={18} className="text-amber-700 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      {language === 'ar'
                        ? 'سيتم إتاحة إنشاء كود التفعيل بعد حفظ بيانات الموظف'
                        : 'Activation code generation will be available after saving employee data'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : (language === 'ar' ? 'إضافة' : 'Add')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        showEditModal && editingEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {language === 'ar' ? 'تعديل بيانات الموظف' : 'Edit Employee'}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {language === 'ar' ? `تعديل معلومات ${editingEmployee.full_name}` : `Edit ${editingEmployee.full_name}'s information`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEmployee(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X size={24} className="text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الاسم' : 'Full Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email'} *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الهاتف' : 'Phone'} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'المسمى الوظيفي' : 'Job Title'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'القسم' : 'Department'}
                    </label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">{language === 'ar' ? 'اختر القسم' : 'Select Department'}</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الفرع' : 'Branch'}
                    </label>
                    <select
                      value={formData.branch_id}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">{language === 'ar' ? 'اختر الفرع' : 'Select Branch'}</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الوردية' : 'Shift'}
                    </label>
                    <select
                      value={formData.shift_id}
                      onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">{language === 'ar' ? 'اختر الوردية' : 'Select Shift'}</option>
                      {shifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'تاريخ التعيين' : 'Hire Date'} *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'وقت العمل من' : 'Work Start Time'}
                    </label>
                    <input
                      type="time"
                      value={formData.work_start_time}
                      onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'وقت العمل إلى' : 'Work End Time'}
                    </label>
                    <input
                      type="time"
                      value={formData.work_end_time}
                      onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'سماحية التأخير (دقيقة)' : 'Late Grace (minutes)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.late_grace_min}
                      onChange={(e) => setFormData({ ...formData, late_grace_min: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'سماحية الانصراف المبكر (دقيقة)' : 'Early Leave Grace (minutes)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.early_grace_min}
                      onChange={(e) => setFormData({ ...formData, early_grace_min: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'نظام الراتب' : 'Salary Type'} *
                    </label>
                    <select
                      value={formData.salary_mode}
                      onChange={(e) => setFormData({ ...formData, salary_mode: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                      <option value="daily">{language === 'ar' ? 'يومي' : 'Daily'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'} *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={formData.monthly_salary}
                      onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {language === 'ar' ? 'كود التفعيل' : 'Activation Code'}
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {language === 'ar' ? 'قم بإنشاء كود تفعيل للموظف' : 'Generate activation code for employee'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => editingEmployee && handleGenerateCode(editingEmployee.id)}
                      disabled={generatingCode}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Key size={18} />
                      {generatingCode ? (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...') : (language === 'ar' ? 'إنشاء كود' : 'Generate Code')}
                    </button>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      {language === 'ar'
                        ? 'سيتم إنشاء كود تفعيل جديد يمكن مشاركته مع الموظف لتسجيل الدخول إلى التطبيق'
                        : 'A new activation code will be generated that can be shared with the employee to login to the app'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingEmployee(null);
                    }}
                    className="px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Activation Code Modal */}
      {
        showActivationCodeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Key className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {language === 'ar' ? 'كود التفعيل' : 'Activation Code'}
                </h2>
                <p className="text-sm text-slate-600 mb-6">
                  {language === 'ar' ? 'قم بمشاركة هذا الكود مع الموظف' : 'Share this code with the employee'}
                </p>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border-2 border-blue-200">
                  <div className="text-5xl font-bold text-blue-700 tracking-wider font-mono">
                    {generatedCode}
                  </div>
                </div>

                <button
                  onClick={copyCodeToClipboard}
                  className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2 mb-4"
                >
                  {codeCopied ? (
                    <>
                      <Check size={20} />
                      {language === 'ar' ? 'تم النسخ' : 'Copied'}
                    </>
                  ) : (
                    <>
                      <Copy size={20} />
                      {language === 'ar' ? 'نسخ الكود' : 'Copy Code'}
                    </>
                  )}
                </button>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-xs text-yellow-800 text-center">
                    {language === 'ar' ? 'صالح لمدة 30 دقيقة ويُستخدم مرة واحدة' : 'Valid for 30 minutes, single use'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowActivationCodeModal(false);
                    setGeneratedCode('');
                    setCodeCopied(false);
                  }}
                  className="w-full px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Photo Upload Modal */}
      {
        showPhotoModal && photoEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {language === 'ar' ? 'تغيير صورة الموظف' : 'Change Employee Photo'}
                </h2>
                <p className="text-sm text-slate-600">
                  {language === 'ar' ? photoEmployee.full_name : photoEmployee.full_name}
                </p>
              </div>

              <ImageUpload
                currentImageUrl={photoEmployee.avatar_url}
                employeeName={photoEmployee.full_name}
                employeeId={photoEmployee.id}
                language={language}
                onUploadComplete={(url) => {
                  setPhotoEmployee({ ...photoEmployee, avatar_url: url });
                  if (selectedEmployee && selectedEmployee.id === photoEmployee.id) {
                    setSelectedEmployee({ ...selectedEmployee, avatar_url: url });
                  }
                  fetchEmployees();
                }}
              />

              <button
                onClick={() => {
                  setShowPhotoModal(false);
                  setPhotoEmployee(null);
                }}
                className="w-full mt-6 px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        )
      }
    </AdminPageShell>

  );
}

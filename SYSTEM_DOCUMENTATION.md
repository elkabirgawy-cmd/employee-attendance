# GPS-Based Employee Attendance System - Complete Documentation

## Table of Contents
- [A. Requirements Analysis & Use Cases](#a-requirements-analysis--use-cases)
- [B. Technology Stack](#b-technology-stack)
- [C. Database Schema](#c-database-schema)
- [D. API Design](#d-api-design)
- [E. Wireframes](#e-wireframes)
- [F. Development Roadmap](#f-development-roadmap)
- [G. Security & Limitations](#g-security--limitations)

---

## A. Requirements Analysis & Use Cases

### Core Use Cases

#### UC-001: Employee Registration & Login
**Actor:** Employee
**Precondition:** Employee has phone number or email
**Flow:**
1. Employee opens mobile app
2. Enters phone number or email
3. System sends OTP
4. Employee enters OTP
5. System verifies OTP and creates session
6. Employee completes profile (first-time only)

**Postcondition:** Employee is authenticated and can access app features

**Justification for Phone-based Auth:**
- Phone numbers are more unique and stable than emails in enterprise settings
- SMS OTP is faster and more reliable in regions with limited email access
- Reduces risk of shared credentials
- Better for non-technical employees

---

#### UC-002: Check-In Process
**Actor:** Employee
**Precondition:** Employee is authenticated and at work location
**Flow:**
1. Employee taps "Check-In" button
2. System requests high-accuracy GPS permission
3. System reads current GPS coordinates (lat, lng, accuracy)
4. System validates employee is within branch geofence
5. System generates and sends 6-digit OTP (SMS/Email)
6. Employee enters OTP within 5 minutes
7. System verifies OTP
8. System records check-in with:
   - Server timestamp (authoritative)
   - Device timestamp
   - GPS coordinates
   - GPS accuracy
   - IP address
   - Device ID
9. System calculates if arrival is on-time/late

**Validation Rules:**
- GPS accuracy must be < 50 meters
- Employee must be inside branch geofence (radius check)
- Cannot check-in if already checked-in today
- Check-in time must be within shift window (±30 minutes)

**Error Scenarios:**
- Outside geofence: "You are outside the allowed work location"
- Poor GPS: "GPS accuracy is too low. Please move to an open area"
- Invalid OTP: "Invalid OTP. Please try again (2 attempts remaining)"
- Duplicate: "You have already checked in today"

**Postcondition:** Attendance record created with status (on_time/late)

---

#### UC-003: Check-Out Process
**Actor:** Employee
**Precondition:** Employee has checked-in today
**Flow:**
1. Employee taps "Check-Out" button
2. System performs same GPS validation as check-in
3. System sends OTP
4. Employee verifies OTP
5. System updates attendance record with:
   - Check-out timestamp
   - Check-out GPS coordinates
   - Total working hours
6. System calculates if departure is early/normal

**Postcondition:** Attendance record completed with working hours

---

#### UC-004: View Attendance History
**Actor:** Employee
**Precondition:** Employee is authenticated
**Flow:**
1. Employee navigates to History screen
2. System fetches attendance records from database
3. System displays:
   - Daily records with check-in/out times
   - Status badges (on-time, late, early leave)
   - Total working hours per day
   - Monthly summary

**Postcondition:** Employee views their attendance data

---

#### UC-005: Manage Employees (Admin)
**Actor:** Admin/HR
**Precondition:** Admin is authenticated
**Flow:**
1. Admin navigates to Employees section
2. System displays employee list with filters
3. Admin can:
   - Add new employee (name, email, phone, branch, shift)
   - Edit employee details
   - Deactivate employee
   - Assign to branch and shift
   - Set GPS requirements

**Postcondition:** Employee data is updated in system

---

#### UC-006: Manage Branches & Geofences (Admin)
**Actor:** Admin
**Precondition:** Admin is authenticated
**Flow:**
1. Admin navigates to Branches section
2. Admin clicks "Add Branch"
3. Admin enters:
   - Branch name
   - Address
   - Latitude & longitude (from map picker)
   - Geofence radius (100-300 meters)
   - Timezone
4. System saves branch with geospatial data
5. System creates PostGIS geography point

**Validation:**
- Radius must be 10-5000 meters
- Coordinates must be valid lat/lng

**Postcondition:** Branch is active and available for employee assignment

---

#### UC-007: Generate Reports (Admin)
**Actor:** Admin/Manager
**Precondition:** Admin is authenticated
**Flow:**
1. Admin navigates to Reports section
2. Admin selects:
   - Report type (daily/weekly/monthly)
   - Date range
   - Export format (Excel/PDF/CSV)
   - Include options (GPS coords, device info)
3. System queries attendance data
4. System generates report with:
   - Employee attendance records
   - Late arrivals count
   - Absences
   - Total working hours
   - GPS coordinates (if enabled)
5. System exports file

**Postcondition:** Report is downloaded

---

#### UC-008: Monitor Fraud Attempts (Admin)
**Actor:** Admin
**Precondition:** Admin is authenticated
**Flow:**
1. Admin navigates to Fraud Alerts section
2. System displays alerts with:
   - Alert type (fake GPS, rooted device, out of range)
   - Severity (low/medium/high/critical)
   - Employee details
   - Timestamp
   - Resolution status
3. Admin can:
   - View alert details
   - Mark as resolved
   - Block device

**Postcondition:** Fraud alerts are monitored and resolved

---

#### UC-009: Offline Attendance (Employee)
**Actor:** Employee
**Precondition:** Employee has no internet connection
**Flow:**
1. Employee attempts check-in/out
2. System detects no network
3. System stores attendance attempt locally with:
   - All GPS data
   - Device timestamp
   - Pending sync flag
4. System shows "Pending sync" message
5. When internet available:
   - System auto-syncs pending records
   - Server validates and assigns final status
   - System updates local records

**Postcondition:** Attendance is recorded once online

---

### Non-Functional Requirements

**Performance:**
- GPS location must be obtained within 10 seconds
- OTP delivery within 30 seconds
- API response time < 500ms
- Support 1000+ concurrent check-ins

**Security:**
- All API calls use JWT authentication
- OTP codes are hashed before storage
- Sensitive data encrypted at rest
- Rate limiting on OTP requests (5 per hour)

**Scalability:**
- Support 10,000+ employees
- Handle 100+ branches
- Store 1M+ attendance records
- Real-time updates for admins

**Reliability:**
- 99.9% uptime
- Automatic failover
- Data backup every 6 hours
- Audit logs for all actions

---

## B. Technology Stack

### Final Stack with Detailed Justification

#### Frontend Web Dashboard
**React 18 + TypeScript + Vite + Tailwind CSS**

**Why React?**
- Component reusability between web and React Native
- Largest ecosystem and community
- Excellent performance with virtual DOM
- Easy state management with hooks
- TypeScript adds type safety

**Why Vite?**
- 10x faster than webpack in development
- Lightning-fast HMR (Hot Module Replacement)
- Optimized production builds
- Native ESM support

**Why Tailwind CSS?**
- Rapid UI development without custom CSS
- Consistent design system
- Small production bundle (only used classes)
- Easy responsive design
- No CSS naming conflicts

**Alternatives Considered:**
- Vue.js: Smaller community, less React Native synergy
- Next.js: Overkill for SPA, adds complexity
- Bootstrap: Less customizable, larger bundle

---

#### Mobile Application
**React Native with Expo**

**Justification:**
- **Code Sharing:** Share business logic with web (React ecosystem)
- **Native APIs:** Built-in GPS, device info, geolocation
- **OTA Updates:** Push updates without app store approval
- **Offline Support:** AsyncStorage for local data
- **Cross-Platform:** Single codebase for iOS and Android
- **Development Speed:** Faster than native development
- **Cost Effective:** One team maintains web + mobile

**Key Expo Modules:**
- `expo-location`: High-accuracy GPS with background support
- `expo-device`: Device info (model, OS, rooted detection)
- `expo-constants`: Device ID, app version
- `expo-secure-store`: Encrypted local storage for tokens
- `expo-updates`: OTA update management

**Native Modules Required:**
- **Fake GPS Detection (Android):** Check for mock location apps
- **Jailbreak Detection (iOS):** Detect compromised devices
- **Background Location:** Track location when app is backgrounded

**Alternative: Flutter**
- **Pros:** Better performance, beautiful UI, single codebase
- **Cons:** Different language (Dart), no code sharing with React, smaller community

**Decision:** React Native chosen for ecosystem synergy and code reuse

---

#### Backend & Database
**Supabase (PostgreSQL + Edge Functions + Auth)**

**Justification:**

**PostgreSQL Benefits:**
- **PostGIS Extension:** Native geospatial queries for geofencing
- **ACID Compliance:** Critical for attendance data integrity
- **JSON Support:** Flexible metadata storage
- **Powerful Indexing:** Fast queries on large datasets
- **Mature & Stable:** Production-proven reliability

**Supabase Benefits:**
- **Built-in Auth:** Phone/email authentication with OTP
- **Row Level Security (RLS):** Database-level security policies
- **Real-time Subscriptions:** Live attendance updates for admins
- **Edge Functions:** Serverless API endpoints (Deno runtime)
- **Auto-generated API:** REST API from database schema
- **Storage:** For profile images, report files
- **Cost-Effective:** Free tier supports 500MB database, 50K monthly active users

**Architecture Pattern: REST API via Edge Functions**

**Why REST over GraphQL?**
- Simpler to implement with Edge Functions
- Better caching (HTTP caching headers)
- Easier rate limiting
- Less overhead for simple CRUD operations
- Established tooling and monitoring

**GraphQL Pros (not chosen):**
- Flexible queries
- Reduces over-fetching
- Better for complex nested data

**Decision:** REST chosen for simplicity and Supabase Edge Functions integration

---

#### Third-Party Services

**OTP Delivery: Twilio (SMS) + SendGrid (Email)**
- **Twilio:** Industry standard for SMS, global coverage, 99.95% uptime
- **SendGrid:** Reliable email delivery, transactional templates
- **Fallback:** If SMS fails, use email
- **Cost:** ~$0.02 per SMS, email is cheaper fallback

**Maps & Geolocation:**
- **Google Maps API:** Map picker for admin (add branches)
- **OpenStreetMap (Leaflet):** Free alternative for displaying locations
- **Expo Location API:** Native GPS on mobile

**Report Generation:**
- **SheetJS (xlsx):** Generate Excel files client-side
- **jsPDF + jspdf-autotable:** Generate PDF reports
- **Server-side Alternative:** Edge Function with Deno libraries

**Error Tracking: Sentry**
- Real-time error monitoring
- Performance tracking
- Release tracking
- User feedback

---

#### DevOps & Infrastructure

**Version Control:** Git + GitHub
- Branching strategy: Git Flow
- PR reviews required
- Automated CI checks

**CI/CD:** GitHub Actions
```yaml
# .github/workflows/deploy.yml
- Run tests
- Run linter
- Build project
- Deploy to Vercel (web)
- Deploy to Expo EAS (mobile)
- Run database migrations
```

**Hosting:**
- **Web Dashboard:** Vercel (zero config, auto SSL, CDN)
- **Mobile App:** Expo EAS Build (iOS + Android)
- **Backend:** Supabase (managed PostgreSQL + Edge Functions)
- **Alternative:** AWS (EC2 + RDS + S3) for full control

**Why Vercel?**
- Automatic deployments from Git
- Global CDN
- Serverless functions
- Free SSL
- Preview deployments for PRs

**Why Expo EAS?**
- No need for Mac for iOS builds
- Automatic code signing
- OTA updates
- Crash reporting

**Containerization: Docker (Optional)**
```dockerfile
# For self-hosted deployments
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["npm", "start"]
```

**Monitoring Stack:**
- Sentry (errors)
- Vercel Analytics (web performance)
- Supabase Dashboard (database metrics)
- Grafana + Prometheus (optional for advanced monitoring)

---

## C. Database Schema

### Entity Relationship Diagram (Explanation)

```
┌─────────────────┐
│   auth.users    │ (Supabase Auth - Built-in)
│─────────────────│
│ id (uuid) PK    │
│ email           │
│ phone           │
│ created_at      │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
┌────────▼────────┐  ┌──────▼──────┐  ┌───────▼────────┐
│  admin_users    │  │  employees  │  │   audit_logs   │
│─────────────────│  │─────────────│  │────────────────│
│ id (uuid) PK/FK │  │ id (uuid) PK│  │ id (uuid) PK   │
│ role_id FK      │  │ employee_cd │  │ user_id        │
│ full_name       │  │ full_name   │  │ action         │
│ email           │  │ email       │  │ resource_type  │
│ is_active       │  │ phone       │  │ changes (json) │
└────────┬────────┘  │ branch_id FK│  └────────────────┘
         │           │ shift_id FK │
         │           │ job_title   │
    ┌────▼────┐      │ is_active   │
    │  roles  │      └──────┬──────┘
    │─────────│             │
    │ id PK   │             │
    │ name    │      ┌──────┴───────────┬──────────────┐
    │ perms   │      │                  │              │
    └─────────┘      │                  │              │
                ┌────▼────────┐  ┌──────▼──────┐  ┌───▼──────────┐
                │   devices   │  │ attendance  │  │  otp_logs    │
                │─────────────│  │    _logs    │  │──────────────│
                │ id PK       │  │─────────────│  │ id PK        │
                │ employee_id │  │ id PK       │  │ employee_id  │
                │ device_id   │  │ employee_id │  │ otp_code     │
                │ os_type     │  │ branch_id   │  │ otp_type     │
                │ is_rooted   │  │ device_id   │  │ is_verified  │
                └─────────────┘  │ check_in_*  │  │ expires_at   │
                                 │ check_out_* │  └──────────────┘
                                 │ status      │
                                 │ total_hours │
                                 └─────────────┘

┌──────────────┐       ┌─────────────────┐
│   branches   │       │  fraud_alerts   │
│──────────────│       │─────────────────│
│ id PK        │       │ id PK           │
│ name         │       │ employee_id FK  │
│ latitude     │◄──────│ device_id FK    │
│ longitude    │       │ alert_type      │
│ geofence_rad │       │ severity        │
│ timezone     │       │ description     │
│ location (geo)       │ is_resolved     │
└──────┬───────┘       └─────────────────┘
       │
┌──────▼───────┐       ┌─────────────────┐
│    shifts    │       │ system_settings │
│──────────────│       │─────────────────│
│ id PK        │       │ id PK           │
│ name         │       │ key (unique)    │
│ start_time   │       │ value (jsonb)   │
│ end_time     │       │ description     │
│ grace_period │       └─────────────────┘
│ working_days │
└──────────────┘
```

### Table Descriptions

#### 1. **auth.users** (Supabase Built-in)
- Managed by Supabase Auth
- Stores authentication credentials
- Supports phone and email auth
- Handles password hashing and sessions

#### 2. **admin_users**
- Extends auth.users for admin roles
- Links to roles table for permissions
- Tracks last login for security
- Can be deactivated without deleting

**Key Columns:**
- `role_id`: Links to roles for permission checking
- `is_active`: Soft delete for admin access control
- `last_login_at`: Audit trail

#### 3. **employees**
- Core employee data
- Links to branches and shifts
- Extends auth.users
- Supports multiple location assignment

**Key Columns:**
- `employee_code`: Unique identifier for employee
- `branch_id`: Primary branch assignment
- `shift_id`: Work schedule
- `allow_multiple_locations`: Can work at multiple branches
- `require_gps`: Enforce GPS for this employee

**Business Rules:**
- Employee must have branch_id OR allow_multiple_locations=true
- If allow_multiple_locations, use employee_branches table

#### 4. **employee_branches** (Many-to-Many)
- Allows employees to work at multiple branches
- One primary branch per employee
- Used when allow_multiple_locations=true

#### 5. **branches**
- Physical work locations
- Contains geofence data
- Uses PostGIS geography type

**Key Columns:**
- `latitude`, `longitude`: Center point of branch
- `geofence_radius`: Allowed radius in meters (100-300m typical)
- `location`: PostGIS geography point (auto-calculated)
- `timezone`: Branch timezone for accurate time calculations

**Geofencing Query Example:**
```sql
SELECT * FROM branches
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
  geofence_radius
);
```

#### 6. **shifts**
- Work schedule definitions
- Reusable across employees
- Supports grace periods

**Key Columns:**
- `start_time`, `end_time`: Shift hours
- `grace_period_minutes`: Late allowance (e.g., 15 min)
- `working_days`: JSON array [1,2,3,4,5] = Mon-Fri
- `early_checkout_threshold_minutes`: Early leave detection

#### 7. **attendance_logs**
- Core attendance records
- Dual timestamp (server + device)
- GPS coordinates for check-in and check-out
- Status calculation

**Key Columns:**
- `check_in_time`: **Server timestamp (authoritative)**
- `check_in_device_time`: Device reported time (for fraud detection)
- `check_in_latitude`, `check_in_longitude`: GPS coordinates
- `check_in_accuracy`: GPS accuracy in meters
- `check_in_ip_address`: IP address for audit
- `check_out_*`: Same fields for checkout
- `total_working_hours`: Calculated duration
- `status`: `on_time`, `late`, `early_leave`, `absent`, `pending`
- `is_synced`: For offline sync tracking

**Status Calculation Logic:**
```typescript
function calculateStatus(
  checkInTime: Date,
  shiftStartTime: Time,
  gracePeriod: number
): Status {
  const diffMinutes = (checkInTime - shiftStartTime) / 60000;

  if (diffMinutes <= 0) return 'on_time';
  if (diffMinutes <= gracePeriod) return 'on_time';
  return 'late';
}
```

#### 8. **devices**
- Registered employee devices
- Security tracking
- Fraud prevention

**Key Columns:**
- `device_id`: Unique hardware identifier
- `os_type`: `android`, `ios`, `web`
- `is_rooted_jailbroken`: Security flag
- `last_used_at`: Track active devices

**Device Registration Flow:**
1. Employee logs in on new device
2. System generates device fingerprint
3. Device record created
4. Future check-ins link to device

#### 9. **otp_logs**
- OTP generation and verification tracking
- Security audit trail
- Rate limiting enforcement

**Key Columns:**
- `otp_code`: **Hashed OTP** (never store plaintext)
- `otp_type`: `check_in`, `check_out`, `login`
- `delivery_method`: `sms`, `email`, `in_app`
- `expires_at`: OTP expiry (typically 5 minutes)
- `attempts`: Failed verification count
- `is_verified`: Successfully used

**OTP Flow:**
```
1. Generate 6-digit OTP
2. Hash with bcrypt
3. Store in otp_logs with expiry
4. Send via SMS/Email
5. User enters OTP
6. Hash input and compare
7. Check expiry and attempts
8. Mark as verified
```

#### 10. **fraud_alerts**
- Security incident tracking
- Fraud detection logs
- Admin investigation

**Alert Types:**
- `fake_gps`: Mock location detected
- `rooted_device`: Jailbroken/rooted device
- `out_of_range`: Outside geofence
- `poor_gps_accuracy`: GPS accuracy > threshold
- `time_manipulation`: Device time differs from server
- `suspicious_pattern`: Unusual behavior

**Severity Levels:**
- `low`: Minor deviation
- `medium`: Noteworthy issue
- `high`: Clear fraud attempt
- `critical`: Confirmed fraud

#### 11. **audit_logs**
- Complete audit trail
- Compliance requirement
- Forensic investigation

**Key Columns:**
- `user_id`: Who performed action
- `user_type`: `employee` or `admin`
- `action`: Descriptive action name
- `changes`: JSONB with before/after data
- `ip_address`, `user_agent`: Request metadata

**Examples:**
```json
{
  "action": "check_in",
  "resource_type": "attendance",
  "changes": {
    "latitude": 24.7136,
    "longitude": 46.6753,
    "accuracy": 12.5
  }
}
```

#### 12. **system_settings**
- Global configuration
- JSON-based settings
- Admin-modifiable

**Key Settings:**
```json
{
  "otp_settings": {
    "length": 6,
    "expiry_minutes": 5,
    "max_attempts": 3
  },
  "gps_settings": {
    "max_accuracy_meters": 50,
    "require_high_accuracy": true
  },
  "fraud_detection": {
    "detect_fake_gps": true,
    "detect_rooted_devices": true
  }
}
```

### Indexes & Performance

**Critical Indexes:**
```sql
-- Attendance queries
CREATE INDEX idx_attendance_employee_date ON attendance_logs(employee_id, check_in_time);
CREATE INDEX idx_attendance_branch ON attendance_logs(branch_id);
CREATE INDEX idx_attendance_status ON attendance_logs(status);

-- Geospatial queries
CREATE INDEX idx_branches_location ON branches USING GIST(location);
CREATE INDEX idx_attendance_checkin_location ON attendance_logs USING GIST(check_in_location);

-- Lookup queries
CREATE INDEX idx_employees_code ON employees(employee_code);
CREATE INDEX idx_employees_phone ON employees(phone);
```

### Data Retention & Archival

**Policies:**
- Attendance logs: Keep 3 years, then archive
- Audit logs: Keep 7 years (compliance)
- OTP logs: Purge after 30 days
- Fraud alerts: Keep indefinitely until resolved

**Archive Strategy:**
```sql
-- Monthly job to archive old attendance
INSERT INTO attendance_logs_archive
SELECT * FROM attendance_logs
WHERE check_in_time < NOW() - INTERVAL '3 years';

DELETE FROM attendance_logs
WHERE check_in_time < NOW() - INTERVAL '3 years';
```

---

## D. API Design

### API Architecture

**Base URL:** `https://[project-id].supabase.co`

**Authentication:** JWT Bearer Token
```
Authorization: Bearer <jwt_token>
```

**API Patterns:**
1. **Supabase Auto-Generated REST API:** For simple CRUD
2. **Edge Functions:** For business logic (geofencing, OTP, status calc)

### Edge Functions vs Direct Database

| Operation | Method | Why |
|-----------|--------|-----|
| Get employees | Direct DB (Supabase API) | Simple SELECT |
| Check-in | Edge Function | Complex validation + OTP |
| Get attendance | Direct DB | Simple query with RLS |
| Generate report | Edge Function | File generation logic |

---

### Authentication Endpoints

#### 1. Register Employee
**Edge Function:** `/functions/v1/auth-register`

**Request:**
```http
POST /functions/v1/auth-register
Content-Type: application/json

{
  "phone": "+966501234567",
  "email": "employee@company.com",
  "full_name": "Ahmed Hassan",
  "employee_code": "EMP001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to +966501234567",
  "session_id": "uuid-here",
  "expires_in": 300
}
```

**Business Logic:**
1. Validate phone format
2. Check if employee exists
3. Generate 6-digit OTP
4. Hash OTP with bcrypt
5. Store in otp_logs
6. Send via Twilio
7. Return session_id for verification

---

#### 2. Verify Registration OTP
**Edge Function:** `/functions/v1/auth-verify`

**Request:**
```http
POST /functions/v1/auth-verify
Content-Type: application/json

{
  "session_id": "uuid-here",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "access_token": "jwt-token-here",
  "refresh_token": "refresh-token-here",
  "user": {
    "id": "uuid",
    "email": "employee@company.com",
    "phone": "+966501234567",
    "employee_code": "EMP001"
  }
}
```

**Business Logic:**
1. Verify session_id exists
2. Check OTP not expired
3. Hash input OTP
4. Compare with stored hash
5. Check attempts < 3
6. Create Supabase auth user
7. Create employee record
8. Generate JWT tokens
9. Log audit event

---

#### 3. Login
**Edge Function:** `/functions/v1/auth-login`

**Request:**
```http
POST /functions/v1/auth-login
Content-Type: application/json

{
  "phone": "+966501234567"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "session_id": "uuid-here"
}
```

---

### Attendance Endpoints

#### 4. Request Check-In OTP
**Edge Function:** `/functions/v1/attendance/request-checkin`

**Request:**
```http
POST /functions/v1/attendance/request-checkin
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 24.7136,
  "longitude": 46.6753,
  "accuracy": 12.5,
  "device_time": "2026-01-10T08:05:00Z",
  "device_id": "device-uuid"
}
```

**Response - Success:**
```json
{
  "success": true,
  "message": "OTP sent to your phone",
  "otp_id": "uuid",
  "expires_at": "2026-01-10T08:10:00Z",
  "branch": {
    "id": "uuid",
    "name": "Main Office",
    "distance_meters": 45
  }
}
```

**Response - Outside Geofence:**
```json
{
  "success": false,
  "error": "OUTSIDE_GEOFENCE",
  "message": "You are outside the allowed work location.",
  "nearest_branch": {
    "name": "Main Office",
    "distance_meters": 850
  }
}
```

**Response - Poor GPS:**
```json
{
  "success": false,
  "error": "POOR_GPS_ACCURACY",
  "message": "GPS accuracy is too low. Please move to an open area.",
  "current_accuracy": 120,
  "required_accuracy": 50
}
```

**Business Logic:**
```typescript
async function requestCheckin(req) {
  // 1. Validate JWT and get employee
  const employee = await getEmployeeFromToken(req);

  // 2. Check GPS accuracy
  if (req.accuracy > 50) {
    return { error: 'POOR_GPS_ACCURACY' };
  }

  // 3. Find branch with geofence check
  const branch = await findNearestBranch(req.latitude, req.longitude);
  const distance = calculateDistance(
    req.latitude, req.longitude,
    branch.latitude, branch.longitude
  );

  if (distance > branch.geofence_radius) {
    return { error: 'OUTSIDE_GEOFENCE', distance };
  }

  // 4. Check if already checked in today
  const existingCheckin = await getCheckinToday(employee.id);
  if (existingCheckin) {
    return { error: 'ALREADY_CHECKED_IN' };
  }

  // 5. Check device security
  const device = await checkDevice(req.device_id);
  if (device.is_rooted_jailbroken) {
    await createFraudAlert({
      employee_id: employee.id,
      alert_type: 'rooted_device',
      severity: 'high'
    });
    // Optional: Allow or block
  }

  // 6. Generate OTP
  const otp = generateOTP(6);
  const hashedOtp = await bcrypt.hash(otp, 10);

  // 7. Store OTP log
  const otpLog = await supabase.from('otp_logs').insert({
    employee_id: employee.id,
    otp_code: hashedOtp,
    otp_type: 'check_in',
    delivery_method: 'sms',
    phone_or_email: employee.phone,
    expires_at: new Date(Date.now() + 5 * 60000)
  });

  // 8. Send OTP via Twilio
  await sendSMS(employee.phone, `Your check-in OTP: ${otp}`);

  // 9. Log audit
  await logAudit({
    user_id: employee.id,
    action: 'check_in_otp_requested',
    metadata: { branch_id: branch.id, distance }
  });

  return { success: true, otp_id: otpLog.id, branch };
}
```

---

#### 5. Verify Check-In OTP
**Edge Function:** `/functions/v1/attendance/verify-checkin`

**Request:**
```http
POST /functions/v1/attendance/verify-checkin
Authorization: Bearer <token>
Content-Type: application/json

{
  "otp_id": "uuid",
  "otp": "123456",
  "latitude": 24.7136,
  "longitude": 46.6753,
  "accuracy": 12.5,
  "device_time": "2026-01-10T08:05:00Z",
  "device_id": "device-uuid",
  "ip_address": "192.168.1.1"
}
```

**Response:**
```json
{
  "success": true,
  "attendance": {
    "id": "uuid",
    "check_in_time": "2026-01-10T08:05:23Z",
    "status": "on_time",
    "branch": {
      "id": "uuid",
      "name": "Main Office"
    }
  },
  "message": "Check-in completed successfully"
}
```

**Business Logic:**
```typescript
async function verifyCheckin(req) {
  // 1. Get OTP log
  const otpLog = await getOtpLog(req.otp_id);

  // 2. Verify OTP
  if (otpLog.attempts >= 3) {
    return { error: 'MAX_ATTEMPTS_EXCEEDED' };
  }

  if (new Date() > otpLog.expires_at) {
    return { error: 'OTP_EXPIRED' };
  }

  const isValid = await bcrypt.compare(req.otp, otpLog.otp_code);
  if (!isValid) {
    await incrementOtpAttempts(otpLog.id);
    return { error: 'INVALID_OTP', attempts_remaining: 3 - (otpLog.attempts + 1) };
  }

  // 3. Re-validate GPS (user might have moved)
  const branch = await findNearestBranch(req.latitude, req.longitude);
  const distance = calculateDistance(...);
  if (distance > branch.geofence_radius) {
    return { error: 'MOVED_OUTSIDE_GEOFENCE' };
  }

  // 4. Get employee shift
  const employee = await getEmployeeWithShift(req.employee_id);

  // 5. Calculate status
  const serverTime = new Date();
  const status = calculateAttendanceStatus(
    serverTime,
    employee.shift.start_time,
    employee.shift.grace_period_minutes
  );

  // 6. Create attendance record
  const attendance = await supabase.from('attendance_logs').insert({
    employee_id: employee.id,
    branch_id: branch.id,
    device_id: req.device_id,
    check_in_time: serverTime, // Authoritative server time
    check_in_device_time: req.device_time,
    check_in_latitude: req.latitude,
    check_in_longitude: req.longitude,
    check_in_accuracy: req.accuracy,
    check_in_ip_address: req.ip_address,
    status: status,
    is_synced: true
  });

  // 7. Mark OTP as verified
  await markOtpVerified(otpLog.id);

  // 8. Check time manipulation
  const timeDiff = Math.abs(serverTime - new Date(req.device_time));
  if (timeDiff > 300000) { // 5 minutes
    await createFraudAlert({
      employee_id: employee.id,
      alert_type: 'time_manipulation',
      severity: 'medium',
      description: `Device time differs by ${timeDiff / 1000} seconds`
    });
  }

  // 9. Log audit
  await logAudit({
    user_id: employee.id,
    action: 'check_in',
    resource_type: 'attendance',
    resource_id: attendance.id,
    changes: { status, branch_id: branch.id }
  });

  return { success: true, attendance };
}
```

---

#### 6. Check-Out (Similar to Check-In)
**Edge Function:** `/functions/v1/attendance/request-checkout`
**Edge Function:** `/functions/v1/attendance/verify-checkout`

Same flow as check-in but:
- Updates existing attendance record
- Calculates total working hours
- Checks for early departure

---

#### 7. Get Employee Attendance History
**Direct Supabase API (RLS enforced):**

**Request:**
```http
GET /rest/v1/attendance_logs?employee_id=eq.{id}&order=check_in_time.desc&limit=30
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "check_in_time": "2026-01-10T08:05:23Z",
    "check_out_time": "2026-01-10T17:10:00Z",
    "total_working_hours": 9.08,
    "status": "on_time",
    "branch": {
      "name": "Main Office"
    }
  },
  ...
]
```

---

### Admin Endpoints

#### 8. Create Employee
**Direct Supabase API:**

**Request:**
```http
POST /rest/v1/employees
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "employee_code": "EMP002",
  "full_name": "Fatima Al-Rashid",
  "email": "fatima@company.com",
  "phone": "+966502345678",
  "branch_id": "branch-uuid",
  "shift_id": "shift-uuid",
  "job_title": "Sales Manager",
  "department": "Sales",
  "hire_date": "2026-01-10",
  "is_active": true,
  "require_gps": true
}
```

**Response:**
```json
{
  "id": "uuid",
  "employee_code": "EMP002",
  "full_name": "Fatima Al-Rashid",
  ...
}
```

---

#### 9. Generate Report
**Edge Function:** `/functions/v1/reports/generate`

**Request:**
```http
POST /functions/v1/reports/generate
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "report_type": "monthly",
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "branch_id": "uuid", // optional
  "format": "excel",
  "include_gps": true,
  "include_device_info": true
}
```

**Response:**
```json
{
  "success": true,
  "report_url": "https://storage.supabase.co/reports/monthly_2025-12.xlsx",
  "expires_at": "2026-01-17T00:00:00Z",
  "record_count": 1523,
  "file_size_mb": 2.4
}
```

---

### Error Response Format

**Standard Error:**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message in selected language",
  "details": {
    "field": "latitude",
    "reason": "Out of valid range"
  },
  "timestamp": "2026-01-10T08:05:23Z"
}
```

**Error Codes:**
- `OUTSIDE_GEOFENCE`
- `POOR_GPS_ACCURACY`
- `INVALID_OTP`
- `OTP_EXPIRED`
- `MAX_ATTEMPTS_EXCEEDED`
- `ALREADY_CHECKED_IN`
- `NOT_CHECKED_IN`
- `DEVICE_BLOCKED`
- `UNAUTHORIZED`
- `RATE_LIMIT_EXCEEDED`

---

### Rate Limiting

**Implemented via Edge Functions:**
```typescript
const RATE_LIMITS = {
  'otp_request': { limit: 5, window: 3600 }, // 5 per hour
  'otp_verify': { limit: 10, window: 600 },  // 10 per 10 min
  'api_general': { limit: 100, window: 60 }  // 100 per minute
};
```

---

### Webhooks (Optional for Enterprise)

**Attendance Webhook:**
```http
POST https://customer-server.com/webhooks/attendance
Content-Type: application/json
X-Signature: hmac-signature

{
  "event": "check_in",
  "employee_id": "uuid",
  "employee_code": "EMP001",
  "timestamp": "2026-01-10T08:05:23Z",
  "status": "late",
  "branch": "Main Office"
}
```

---

## E. Wireframes

### Mobile App Wireframes (Text-Based)

#### Screen 1: Login / Registration
```
┌──────────────────────────────────┐
│          GPS Attendance          │
│                                  │
│    ┌────────────────────────┐   │
│    │     [GPS Icon Logo]    │   │
│    └────────────────────────┘   │
│                                  │
│   Sign in to continue            │
│                                  │
│   ┌──────────────────────────┐  │
│   │ Phone Number             │  │
│   │ +966 |_________________  │  │
│   └──────────────────────────┘  │
│                                  │
│   ┌──────────────────────────┐  │
│   │  [ Send OTP ]            │  │
│   └──────────────────────────┘  │
│                                  │
│   or                             │
│                                  │
│   ┌──────────────────────────┐  │
│   │ Email Address            │  │
│   │ name@company.com         │  │
│   └──────────────────────────┘  │
│                                  │
│   ┌──────────────────────────┐  │
│   │  [ Continue with Email ] │  │
│   └──────────────────────────┘  │
│                                  │
│   Need help? Contact support    │
│                                  │
└──────────────────────────────────┘
```

#### Screen 2: OTP Verification
```
┌──────────────────────────────────┐
│  [<]        Verify OTP           │
│                                  │
│   We sent a code to              │
│   +966 50 123 4567               │
│                                  │
│   Enter 6-digit code:            │
│                                  │
│   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐│
│   │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 ││
│   └───┘ └───┘ └───┘ └───┘ └───┘│
│   ┌───┐                          │
│   │ 6 │                          │
│   └───┘                          │
│                                  │
│   Code expires in 04:32          │
│                                  │
│   ┌──────────────────────────┐  │
│   │      [ Verify ]          │  │
│   └──────────────────────────┘  │
│                                  │
│   Didn't receive? [Resend OTP]  │
│                                  │
└──────────────────────────────────┘
```

#### Screen 3: Home (Check-In/Out)
```
┌──────────────────────────────────┐
│ [≡] GPS Attendance    [👤] [⚙] │
│                                  │
│   Welcome, Ahmed! 👋             │
│                                  │
│  ┌────────────────────────────┐ │
│  │  📍 Main Office Branch     │ │
│  │  Distance: 45m away        │ │
│  │  GPS Accuracy: ±12m        │ │
│  │  ✓ High Accuracy Mode      │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │                            │ │
│  │       [Fingerprint]        │ │
│  │                            │ │
│  │     CHECK IN               │ │
│  │                            │ │
│  │  Saturday, Jan 10, 2026    │ │
│  │  08:05 AM                  │ │
│  │                            │ │
│  └────────────────────────────┘ │
│                                  │
│  Today's Status: Not Checked In  │
│                                  │
│  ┌──────────────────────────┐   │
│  │ This Week Summary        │   │
│  │ ───────────────────────  │   │
│  │ Mon  ✓ On Time  9.2h     │   │
│  │ Tue  ✓ On Time  8.8h     │   │
│  │ Wed  ⚠ Late(10m) 9.0h   │   │
│  │ Thu  ✓ On Time  8.5h     │   │
│  │ Fri  -                   │   │
│  └──────────────────────────┘   │
│                                  │
│  [📊 View Full History]         │
│                                  │
└──────────────────────────────────┘
[🏠 Home] [📍 Map] [📊 History] [👤 Profile]
```

#### Screen 4: Check-In (GPS Active)
```
┌──────────────────────────────────┐
│  [<]     Checking Location...    │
│                                  │
│  ┌────────────────────────────┐ │
│  │                            │ │
│  │   [Loading Spinner]        │ │
│  │                            │ │
│  │  Acquiring GPS Signal...   │ │
│  │  Accuracy: ±24m            │ │
│  │  Improving...              │ │
│  │                            │ │
│  └────────────────────────────┘ │
│                                  │
│  Status:                         │
│  ✓ GPS Permission Enabled        │
│  ✓ High Accuracy Mode Active     │
│  ⏳ Verifying Location...        │
│                                  │
│  Tips:                           │
│  • Move to an open area          │
│  • Ensure WiFi is enabled        │
│  • Wait for better accuracy      │
│                                  │
│  ┌──────────────────────────┐   │
│  │      [ Cancel ]          │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
```

#### Screen 5: OTP Verification (Check-In)
```
┌──────────────────────────────────┐
│  [<]     Verify Check-In         │
│                                  │
│  ✓ Location Verified             │
│  📍 Main Office (45m away)       │
│                                  │
│  Enter OTP sent to your phone:   │
│                                  │
│   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐│
│   │ _ │ │ _ │ │ _ │ │ _ │ │ _ ││
│   └───┘ └───┘ └───┘ └───┘ └───┘│
│   ┌───┐                          │
│   │ _ │                          │
│   └───┘                          │
│                                  │
│   Expires in 04:45               │
│                                  │
│   ┌──────────────────────────┐  │
│   │   [ Confirm Check-In ]   │  │
│   └──────────────────────────┘  │
│                                  │
│   Didn't receive? [Resend]      │
│                                  │
│   ⚠ Warning: False check-ins    │
│   will be logged and monitored   │
│                                  │
└──────────────────────────────────┘
```

#### Screen 6: Check-In Success
```
┌──────────────────────────────────┐
│         Check-In Success! ✓      │
│                                  │
│  ┌────────────────────────────┐ │
│  │                            │ │
│  │     [Green Checkmark]      │ │
│  │                            │ │
│  │  You're checked in!        │ │
│  │                            │ │
│  └────────────────────────────┘ │
│                                  │
│  Details:                        │
│  ─────────────────────────────── │
│  Time:     08:05 AM              │
│  Status:   ✓ On Time             │
│  Location: Main Office           │
│  Date:     Jan 10, 2026          │
│                                  │
│  You arrived 5 minutes early     │
│  Great job! 🎉                   │
│                                  │
│  ┌──────────────────────────┐   │
│  │    [ View Details ]      │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │    [ Done ]              │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
```

#### Screen 7: Error - Outside Geofence
```
┌──────────────────────────────────┐
│  [<]     Location Error          │
│                                  │
│  ┌────────────────────────────┐ │
│  │                            │ │
│  │   [Red X Icon]             │ │
│  │                            │ │
│  │  Outside Work Location     │ │
│  │                            │ │
│  └────────────────────────────┘ │
│                                  │
│  ⚠ You are outside the allowed   │
│     work location.               │
│                                  │
│  Current Distance: 850 meters    │
│  Nearest Branch: Main Office     │
│  Required: Within 100 meters     │
│                                  │
│  ┌────────────────────────────┐ │
│  │  [Map showing location]    │ │
│  │  • Your Location (Red)     │ │
│  │  • Branch (Blue)           │ │
│  │  • Geofence Circle         │ │
│  └────────────────────────────┘ │
│                                  │
│  Please move closer to the       │
│  branch to check in.             │
│                                  │
│  ┌──────────────────────────┐   │
│  │    [ Try Again ]         │   │
│  └──────────────────────────┘   │
│                                  │
│  Need help? [Contact Support]   │
│                                  │
└──────────────────────────────────┘
```

#### Screen 8: Attendance History
```
┌──────────────────────────────────┐
│ [<] Attendance History   [Filter]│
│                                  │
│  ┌──────────────────────────┐   │
│  │ January 2026          [▼]│   │
│  └──────────────────────────┘   │
│                                  │
│  Summary:                        │
│  Present: 18 days | Absent: 2    │
│  On-Time: 15 | Late: 3           │
│  Total Hours: 162.5h             │
│                                  │
│  ──────────────────────────────  │
│                                  │
│  ┌────────────────────────────┐ │
│  │ Sat, Jan 10                │ │
│  │ ✓ On Time                  │ │
│  │ In: 08:05 | Out: 17:10     │ │
│  │ Hours: 9.08h               │ │
│  │ 📍 Main Office             │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │ Thu, Jan 09                │ │
│  │ ✓ On Time                  │ │
│  │ In: 08:02 | Out: 17:05     │ │
│  │ Hours: 9.05h               │ │
│  │ 📍 Main Office             │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │ Wed, Jan 08                │ │
│  │ ⚠ Late Arrival (10 min)   │ │
│  │ In: 08:10 | Out: 17:15     │ │
│  │ Hours: 9.08h               │ │
│  │ 📍 Main Office             │ │
│  └────────────────────────────┘ │
│                                  │
│  [Load More...]                  │
│                                  │
└──────────────────────────────────┘
[🏠 Home] [📍 Map] [📊 History] [👤 Profile]
```

#### Screen 9: Profile
```
┌──────────────────────────────────┐
│ [<] Profile              [Edit]  │
│                                  │
│      ┌────────────────┐          │
│      │  [Photo]       │          │
│      │  Ahmed Hassan  │          │
│      └────────────────┘          │
│                                  │
│  Employee Code: EMP001           │
│  Department: Sales               │
│  Position: Sales Representative  │
│                                  │
│  ──────────────────────────────  │
│                                  │
│  Contact Information             │
│  ─────────────────────────────── │
│  📧 ahmed@company.com            │
│  📱 +966 50 123 4567             │
│                                  │
│  Work Details                    │
│  ─────────────────────────────── │
│  🏢 Branch: Main Office          │
│  ⏰ Shift: 08:00 - 17:00         │
│  📅 Hire Date: Jan 1, 2025       │
│                                  │
│  Device Information              │
│  ─────────────────────────────── │
│  📱 iPhone 13 Pro                │
│  🔐 Security Status: ✓ Secure    │
│  📍 GPS: ✓ Enabled               │
│                                  │
│  Settings                        │
│  ─────────────────────────────── │
│  🌍 Language: Arabic             │
│  🔔 Notifications: Enabled       │
│  🔒 Privacy Policy               │
│  📄 Terms of Service             │
│                                  │
│  ┌──────────────────────────┐   │
│  │    [ Sign Out ]          │   │
│  └──────────────────────────┘   │
│                                  │
│  Version 1.0.0                   │
│                                  │
└──────────────────────────────────┘
[🏠 Home] [📍 Map] [📊 History] [👤 Profile]
```

---

### Admin Web Dashboard Wireframes

#### Screen 1: Dashboard Overview
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] GPS Attendance         Search...           Admin ▼ [Sign Out]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Dashboard Overview                                                │
│ Monitor your attendance system at a glance                       │
│                                                                   │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐│
│ │ 👥 Employees │ │ 📍 Branches  │ │ ⏰ Today     │ │ ⚠ Fraud  ││
│ │              │ │              │ │              │ │          ││
│ │     245      │ │      12      │ │     198      │ │    3     ││
│ │ 230 active   │ │ Active locs  │ │ 12 late      │ │ Unresolved│
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘│
│                                                                   │
│ ┌─────────────────────────────┐ ┌───────────────────────────┐  │
│ │ 📈 Attendance Trends        │ │ ⚡ Quick Actions          │  │
│ │                             │ │                           │  │
│ │ On-Time Rate:       85% ✓  │ │ [+ Add New Employee]      │  │
│ │ Late Rate:          10% ⚠  │ │ Register a new employee   │  │
│ │ Attendance Rate:    92% ✓  │ │                           │  │
│ │                             │ │ [+ Add New Branch]        │  │
│ │ [View Detailed Analytics]   │ │ Set up work location      │  │
│ │                             │ │                           │  │
│ └─────────────────────────────┘ │ [📄 Generate Report]      │  │
│                                  │ Export attendance data    │  │
│ Recent Activity:                 │                           │  │
│ ─────────────────────────────── └───────────────────────────┘  │
│ • Ahmed checked in at Main Office (2 min ago)                  │
│ • Fatima checked out at North Branch (5 min ago)               │
│ • ⚠ Fraud alert: Fake GPS detected - Employee #EMP123         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 2: Employee Management
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] GPS Attendance         Search...           Admin ▼ [Sign Out]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Employee Management                           [+ Add Employee]   │
│ Manage employee records and assignments                          │
│                                                                   │
│ ┌──────────────────────────┐  Filter: [All Status ▼]            │
│ │ 🔍 Search name, email... │                                     │
│ └──────────────────────────┘  Showing 245 employees             │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┤
│ │ Employee        │ Code   │ Department│ Branch  │ Status│Actions│
│ ├─────────────────────────────────────────────────────────────────
│ │ Ahmed Hassan    │ EMP001 │ Sales     │ Main    │ ✓ Act │ [✏][🗑]│
│ │ ahmed@co.com    │        │ Manager   │ Office  │       │       │
│ │ +966501234567   │        │           │         │       │       │
│ ├─────────────────────────────────────────────────────────────────
│ │ Fatima Al-Rashid│ EMP002 │ HR        │ North   │ ✓ Act │ [✏][🗑]│
│ │ fatima@co.com   │        │ Director  │ Branch  │       │       │
│ │ +966502345678   │        │           │         │       │       │
│ ├─────────────────────────────────────────────────────────────────
│ │ Mohammed Ali    │ EMP003 │ IT        │ Main    │ ✗ Inact│[✏][🗑]│
│ │ mohammed@co.com │        │ Developer │ Office  │       │       │
│ │ +966503456789   │        │           │         │       │       │
│ └─────────────────────────────────────────────────────────────────
│                                                                   │
│                                         [1] [2] [3] ... [10]     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 3: Branch Management
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] GPS Attendance         Search...           Admin ▼ [Sign Out]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Branch Management                                [+ Add Branch]  │
│ Manage work locations and geofence settings                      │
│                                                                   │
│ ┌────────────────────────┐  ┌────────────────────────┐          │
│ │ 📍 Main Office         │  │ 📍 North Branch        │          │
│ │                        │  │                        │          │
│ │ ✓ Active               │  │ ✓ Active               │          │
│ │                        │  │                        │          │
│ │ King Fahd Road,        │  │ Al Olaya District,     │          │
│ │ Riyadh, Saudi Arabia   │  │ Riyadh                 │          │
│ │                        │  │                        │          │
│ │ Coordinates:           │  │ Coordinates:           │          │
│ │ 24.7136, 46.6753       │  │ 24.7247, 46.6891       │          │
│ │                        │  │                        │          │
│ │ 📡 Geofence: 100m      │  │ 📡 Geofence: 150m      │          │
│ │ 🕐 Timezone: Asia/Riya.│  │ 🕐 Timezone: Asia/Riya.│          │
│ │                        │  │                        │          │
│ │ [✏ Edit] [🗑 Delete]   │  │ [✏ Edit] [🗑 Delete]   │          │
│ └────────────────────────┘  └────────────────────────┘          │
│                                                                   │
│ ┌────────────────────────┐  ┌────────────────────────┐          │
│ │ 📍 South Branch        │  │ 📍 East Branch         │          │
│ │                        │  │                        │          │
│ │ ✓ Active               │  │ ✗ Inactive             │          │
│ │                        │  │                        │          │
│ │ Exit 15, Riyadh       │  │ Al Kharj Road          │          │
│ │                        │  │                        │          │
│ │ Coordinates:           │  │ Coordinates:           │          │
│ │ 24.6478, 46.7187       │  │ 24.6189, 46.7543       │          │
│ │                        │  │                        │          │
│ │ 📡 Geofence: 200m      │  │ 📡 Geofence: 100m      │          │
│ │ 🕐 Timezone: Asia/Riya.│  │ 🕐 Timezone: Asia/Riya.│          │
│ │                        │  │                        │          │
│ │ [✏ Edit] [🗑 Delete]   │  │ [✏ Edit] [🗑 Delete]   │          ��
│ └────────────────────────┘  └────────────────────────┘          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 4: Attendance Tracking
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] GPS Attendance         Search...           Admin ▼ [Sign Out]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Attendance Tracking                    Date: [Jan 10, 2026 ▼]   │
│ Monitor employee check-ins and check-outs                        │
│                                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Total    │ │ On Time  │ │ Late     │ │ Pending  │            │
│ │   198    │ │   175    │ │    12    │ │    45    │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┤
│ │ Employee    │ Branch  │ Check-In│Check-Out│ Hours │Location│Status│
│ ├─────────────────────────────────────────────────────────────────
│ │ Ahmed Hassan│ Main    │ 08:05   │ 17:10   │ 9.08h │ [Map]  │✓ On Time│
│ │ EMP001      │ Office  │ ±12m    │         │       │        │      │
│ ├─────────────────────────────────────────────────────────────────
│ │ Fatima Al-R.│ North   │ 08:00   │ 17:05   │ 9.08h │ [Map]  │✓ On Time│
│ │ EMP002      │ Branch  │ ±8m     │         │       │        │      │
│ ├─────────────────────────────────────────────────────────────────
│ │ Mohammed Ali│ Main    │ 08:15   │ -       │ -     │ [Map]  │⚠ Late  │
│ │ EMP003      │ Office  │ ±15m    │         │       │        │(15 min)│
│ ├─────────────────────────────────────────────────────────────────
│ │ Sarah Omar  │ South   │ 07:55   │ 16:45   │ 8.83h │ [Map]  │⚠ Early │
│ │ EMP004      │ Branch  │ ±10m    │         │       │        │Leave   │
│ └─────────────────────────────────────────────────────────────────
│                                                                   │
│                                         [1] [2] [3] ... [5]      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 5: Reports
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] GPS Attendance         Search...           Admin ▼ [Sign Out]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Reports & Analytics                                              │
│ Generate and export attendance reports                           │
│                                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │📅 Daily  │ │📊 Weekly │ │📈 Monthly│ │🔍 Custom │            │
│ │ Report   │ │ Report   │ │ Report   │ │ Range    │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Report Configuration                                        │ │
│ │                                                             │ │
│ │ Start Date: [2026-01-01]    End Date: [2026-01-31]        │ │
│ │                                                             │ │
│ │ Report Format:                                              │ │
│ │ [ Excel (.xlsx) ] [ PDF (.pdf) ] [ CSV (.csv) ]           │ │
│ │                                                             │ │
│ │ Include Options:                                            │ │
│ │ ☑ Include GPS coordinates                                  │ │
│ │ ☑ Include device information                               │ │
│ │ ☐ Include working hours breakdown                          │ │
│ │ ☐ Include late arrival details                             │ │
│ │                                                             │ │
│ │                  [📄 Preview Report] [⬇ Download Report]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Recent Reports                                                    │
│ ─────────────────────────────────────────────────────────────    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📄 Monthly Attendance - December 2025    [⬇ Download]      │ │
│ │    Generated on Jan 10, 2026                                │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 📄 Weekly Report - Week 1, Jan 2026      [⬇ Download]      │ │
│ │    Generated on Jan 8, 2026                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 6: Fraud Alerts
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] GPS Attendance         Search...           Admin ▼ [Sign Out]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Fraud Detection & Alerts        [All] [Unresolved] [Resolved]   │
│ Monitor suspicious activities and security threats               │
│                                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Total    │ │ Critical │ │ High     │ │ Resolved │            │
│ │    15    │ │     3    │ │     7    │ │     8    │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔴 Fake GPS Detected                        [CRITICAL]      │ │
│ │                                                             │ │
│ │ Mock location app detected during check-in attempt         │ │
│ │                                                             │ │
│ │ Employee: Ahmed Hassan (EMP001) • Jan 10, 2026 08:15 AM   │ │
│ │                                                             │ │
│ │         [✓ Mark as Resolved]     [👁 View Details]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🟠 Rooted/Jailbroken Device                 [HIGH]          │ │
│ │                                                             │ │
│ │ Employee using compromised device                           │ │
│ │                                                             │ │
│ │ Employee: Mohammed Ali (EMP003) • Jan 9, 2026 02:30 PM    │ │
│ │                                                             │ │
│ │         [✓ Mark as Resolved]     [👁 View Details]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🟡 Poor GPS Accuracy                        [MEDIUM]        │ │
│ │                                                             │ │
│ │ GPS accuracy exceeded threshold (120m)                      │ │
│ │                                                             │ │
│ │ Employee: Sarah Omar (EMP004) • Jan 10, 2026 07:55 AM     │ │
│ │                                                             │ │
│ │ ✓ Resolved by Admin User • Jan 10, 2026 09:00 AM          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 7: System Settings
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] GPS Attendance         Search...           Admin ▼ [Sign Out]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ System Settings                                                  │
│ Configure system-wide preferences and policies                   │
│                                                                   │
│ ┌────────────────────────┐  ┌────────────────────────┐          │
│ │ 📍 GPS Settings        │  │ ⏰ Attendance Rules    │          │
│ │                        │  │                        │          │
│ │ Max GPS Accuracy (m):  │  │ Grace Period (min):    │          │
│ │ [  50  ]               │  │ [  15  ]               │          │
│ │                        │  │                        │          │
│ │ Warning Threshold (m): │  │ Early Check-in (min):  │          │
│ │ [  30  ]               │  │ [  30  ]               │          │
│ │                        │  │                        │          │
│ │ ☑ High accuracy mode   │  │ ☑ Require check-out    │          │
│ │ ☑ Fake GPS detection   │  │ ☐ Block duplicate      │          │
│ │                        │  │                        │          │
│ └────────────────────────┘  └────────────────────────┘          │
│                                                                   │
│ ┌────────────────────────┐  ┌────────────────────────┐          │
│ │ 🛡️ Security & Fraud    │  │ 🔔 Notifications       │          │
│ │                        │  │                        │          │
│ │ ☑ Detect rooted device │  │ ☑ Late arrival         │          │
│ │ ☑ Detect fake GPS      │  │ ☑ Early leave          │          │
│ │ ☑ Time manipulation    │  │ ☑ Absence              │          │
│ │ ☐ Block suspicious     │  │ ☑ Fraud alerts         │          │
│ │                        │  │                        │          │
│ │ Max Distance Jump (m): │  │ Admin Email:           │          │
│ │ [  1000  ]             │  │ [admin@company.com]    │          │
│ │                        │  │                        │          │
│ └────────────────────────┘  └────────────────────────┘          │
│                                                                   │
│ ┌────────────────────────┐  ┌────────────────────────┐          │
│ │ ⚙️ OTP Configuration   │  │ 🌍 Regional Settings   │          │
│ │                        │  │                        │          │
│ │ OTP Length (digits):   │  │ Language:              │          │
│ │ [  6  ]                │  │ [Arabic (العربية) ▼]  │          │
│ │                        │  │                        │          │
│ │ Expiry Time (min):     │  │ Timezone:              │          │
│ │ [  5  ]                │  │ [Asia/Riyadh ▼]       │          │
│ │                        │  │                        │          │
│ │ Maximum Attempts:      │  │ Date Format:           │          │
│ │ [  3  ]                │  │ [DD/MM/YYYY ▼]        │          │
│ │                        │  │                        │          │
│ │ Delivery Method:       │  │                        │          │
│ │ [SMS ▼]                │  │                        │          │
│ │                        │  │                        │          │
│ └────────────────────────┘  └────────────────────────┘          │
│                                                                   │
│              [Reset to Defaults]      [Save Changes]             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## F. Development Roadmap

### Phase 1: MVP (Minimum Viable Product) - 4-6 Weeks

**Goal:** Core attendance tracking with basic fraud prevention

#### Week 1-2: Backend Foundation
- [ ] Set up Supabase project
- [ ] Create database schema (all tables)
- [ ] Implement Row Level Security policies
- [ ] Create Edge Functions:
  - Auth (register, login, verify OTP)
  - Attendance (check-in, check-out)
- [ ] Set up Twilio for SMS OTP
- [ ] Implement geofencing logic with PostGIS
- [ ] Write unit tests for business logic

#### Week 3-4: Mobile App (React Native)
- [ ] Set up Expo project
- [ ] Implement authentication flow
- [ ] Build check-in/check-out screens
- [ ] Integrate GPS location APIs
- [ ] Implement OTP verification
- [ ] Add offline support (AsyncStorage)
- [ ] Build attendance history screen
- [ ] Add basic error handling

#### Week 5-6: Admin Web Dashboard
- [ ] Set up React + Vite + Tailwind
- [ ] Implement admin authentication
- [ ] Build dashboard overview
- [ ] Create employee management (CRUD)
- [ ] Create branch management
- [ ] Build attendance tracking view
- [ ] Implement real-time updates

**MVP Deliverables:**
- ✓ Employees can check-in/out with GPS + OTP
- ✓ Geofencing validation works
- ✓ Admins can manage employees and branches
- ✓ Admins can view attendance records
- ✓ Basic fraud detection (fake GPS, rooted devices)

---

### Phase 2: Enhanced Features - 3-4 Weeks

#### Week 7-8: Advanced Fraud Prevention
- [ ] Implement fake GPS detection (Android)
- [ ] Implement jailbreak detection (iOS)
- [ ] Add device fingerprinting
- [ ] Create fraud alert dashboard
- [ ] Implement time manipulation detection
- [ ] Add suspicious pattern detection
- [ ] Build fraud resolution workflow

#### Week 9-10: Reporting & Analytics
- [ ] Build report generation system
- [ ] Implement Excel export (SheetJS)
- [ ] Implement PDF export (jsPDF)
- [ ] Add CSV export
- [ ] Create report scheduling
- [ ] Build analytics dashboard
- [ ] Add charts and visualizations
- [ ] Implement report history

---

### Phase 3: Enterprise Features - 3-4 Weeks

#### Week 11-12: Role-Based Access Control
- [ ] Implement role system (Super Admin, HR, Manager)
- [ ] Add permission-based UI
- [ ] Create admin management screen
- [ ] Implement audit logging
- [ ] Add activity tracking
- [ ] Build compliance reports

#### Week 13-14: Advanced Attendance Features
- [ ] Add shift management
- [ ] Implement multiple branch support per employee
- [ ] Add manual attendance adjustments
- [ ] Create leave request system
- [ ] Implement overtime tracking
- [ ] Add attendance approval workflow
- [ ] Build notification system

---

### Phase 4: Polish & Optimization - 2-3 Weeks

#### Week 15-16: Performance & Security
- [ ] Optimize database queries
- [ ] Add database indexes
- [ ] Implement caching
- [ ] Add rate limiting
- [ ] Security audit
- [ ] Penetration testing
- [ ] Load testing (1000+ concurrent users)
- [ ] Optimize mobile app bundle size

#### Week 17: Localization & UX
- [ ] Add Arabic language support
- [ ] Implement RTL layout
- [ ] Add English translations
- [ ] Improve error messages
- [ ] Add loading states
- [ ] Implement skeleton screens
- [ ] Add animations and transitions
- [ ] User acceptance testing

---

### Phase 5: Deployment & Launch - 1-2 Weeks

#### Week 18-19: Production Deployment
- [ ] Set up production Supabase instance
- [ ] Deploy web dashboard to Vercel
- [ ] Build iOS app with EAS
- [ ] Build Android app with EAS
- [ ] Submit to App Store
- [ ] Submit to Google Play
- [ ] Set up monitoring (Sentry)
- [ ] Configure analytics
- [ ] Create user documentation
- [ ] Create admin documentation
- [ ] Train support team
- [ ] Launch! 🚀

---

### Post-Launch: Maintenance & Enhancements

#### Ongoing Tasks
- [ ] Monitor system performance
- [ ] Fix reported bugs
- [ ] Gather user feedback
- [ ] Implement feature requests
- [ ] Update dependencies
- [ ] Security patches
- [ ] Database optimization

#### Potential Future Features
- [ ] Biometric authentication
- [ ] Face recognition check-in
- [ ] Integration with payroll systems
- [ ] Mobile app for managers
- [ ] WhatsApp notifications
- [ ] Attendance predictions (ML)
- [ ] Employee self-service portal
- [ ] Integration with HR systems
- [ ] Multi-tenancy (white-label)
- [ ] API for third-party integrations

---

### Team Recommendation

**MVP Phase (Weeks 1-6):**
- 1 Full-Stack Developer
- 1 Mobile Developer
- 1 Designer/UX
- 1 QA Tester (part-time)

**Full Development (Weeks 1-19):**
- 2 Full-Stack Developers
- 1 Mobile Developer (React Native)
- 1 UI/UX Designer
- 1 QA Tester
- 1 DevOps/Security Engineer (part-time)
- 1 Product Manager

---

## G. Security, Fraud Prevention & System Limitations

### Security Measures

#### 1. Authentication Security

**JWT Tokens:**
- Access token expires in 1 hour
- Refresh token expires in 7 days
- Tokens stored securely (HTTP-only cookies for web, SecureStore for mobile)
- Token rotation on refresh

**OTP Security:**
- OTP hashed with bcrypt (never stored plaintext)
- 5-minute expiry window
- Maximum 3 attempts before lockout
- Rate limiting: 5 OTP requests per hour per user
- OTP codes are 6 digits (1M possibilities)

**Password Requirements (for admin users):**
- Minimum 8 characters
- Must include uppercase, lowercase, number, special character
- Hashed with bcrypt (cost factor 10)

---

#### 2. Database Security

**Row Level Security (RLS):**
- Enabled on all tables
- Employees can only access their own data
- Admins have role-based access
- Policies checked at database level (not application)

**Sensitive Data Protection:**
- OTP codes hashed
- IP addresses logged for audit
- Personal data encrypted at rest
- SSL/TLS for data in transit

**SQL Injection Prevention:**
- Supabase uses parameterized queries
- Input validation on all fields
- Edge Functions validate input types

---

#### 3. API Security

**Rate Limiting:**
```typescript
const RATE_LIMITS = {
  'otp_request': { limit: 5, window: 3600 },      // 5/hour
  'otp_verify': { limit: 10, window: 600 },       // 10/10min
  'check_in': { limit: 10, window: 3600 },        // 10/hour
  'api_general': { limit: 100, window: 60 }       // 100/min
};
```

**API Authentication:**
- All endpoints require JWT Bearer token
- Admin endpoints verify admin role
- Device ID tracked for all requests

**CORS Configuration:**
- Restricted origins in production
- Credentials allowed only for verified domains

---

### Fraud Prevention Mechanisms

#### 1. Fake GPS Detection (Android)

**Methods:**
```typescript
async function detectFakeGPS(location) {
  // Method 1: Check for mock location
  if (location.isMock) {
    return { isFake: true, method: 'mock_location_flag' };
  }

  // Method 2: Check for known fake GPS apps
  const fakeGPSApps = [
    'com.lexa.fakegps',
    'com.fakegps.mock',
    // ... more
  ];
  const installedApps = await getInstalledApps();
  const hasFakeApp = fakeGPSApps.some(app => installedApps.includes(app));

  if (hasFakeApp) {
    return { isFake: true, method: 'fake_gps_app_detected' };
  }

  // Method 3: Check developer options
  const isDeveloperMode = await isDevModeEnabled();
  if (isDeveloperMode) {
    return { isFake: false, warning: 'developer_mode_enabled' };
  }

  return { isFake: false };
}
```

**Limitations:**
- Advanced fake GPS apps can bypass detection
- Root access can hide fake GPS apps
- No 100% detection method exists

---

#### 2. Rooted/Jailbroken Device Detection

**Android (Root Detection):**
```typescript
async function isDeviceRooted() {
  // Check for root management apps
  const rootApps = ['com.topjohnwu.magisk', 'eu.chainfire.supersu'];

  // Check for su binary
  const suPaths = [
    '/system/bin/su',
    '/system/xbin/su',
    '/sbin/su',
  ];

  // Check for writable system partitions
  const systemWritable = await isSystemWritable();

  return { isRooted, details };
}
```

**iOS (Jailbreak Detection):**
```typescript
async function isDeviceJailbroken() {
  // Check for Cydia and jailbreak files
  const jailbreakFiles = [
    '/Applications/Cydia.app',
    '/Library/MobileSubstrate/MobileSubstrate.dylib',
    '/bin/bash',
    '/usr/sbin/sshd',
  ];

  // Check if can write to system
  try {
    await writeFile('/private/jailbreak_test.txt', 'test');
    return true; // Should fail on non-jailbroken device
  } catch (error) {
    return false;
  }
}
```

**Limitations:**
- Advanced jailbreaks can hide from detection
- Some methods can cause false positives
- Breaks on OS updates

---

#### 3. Time Manipulation Detection

**Server-Client Time Comparison:**
```typescript
function detectTimeManipulation(deviceTime, serverTime) {
  const diff = Math.abs(deviceTime - serverTime);

  if (diff > 300000) { // 5 minutes
    return {
      isManipulated: true,
      difference_seconds: diff / 1000
    };
  }

  return { isManipulated: false };
}
```

**Always Use Server Time:**
- Check-in/out timestamps use server time (authoritative)
- Device time logged separately for fraud detection
- Alerts triggered for large time differences

---

#### 4. GPS Accuracy Validation

**Accuracy Thresholds:**
```typescript
const GPS_THRESHOLDS = {
  max_accuracy: 50,      // Block if > 50m
  warning_accuracy: 30,  // Warn if > 30m
  ideal_accuracy: 10     // Ideal < 10m
};

function validateGPSAccuracy(accuracy) {
  if (accuracy > GPS_THRESHOLDS.max_accuracy) {
    return {
      valid: false,
      error: 'POOR_GPS_ACCURACY',
      message: 'GPS accuracy is too low. Please move to an open area.'
    };
  }

  if (accuracy > GPS_THRESHOLDS.warning_accuracy) {
    return {
      valid: true,
      warning: 'GPS accuracy is lower than recommended'
    };
  }

  return { valid: true };
}
```

---

#### 5. Geofence Validation

**Distance Calculation (Haversine Formula):**
```typescript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

function isInsideGeofence(userLat, userLon, branchLat, branchLon, radius) {
  const distance = calculateDistance(userLat, userLon, branchLat, branchLon);
  return distance <= radius;
}
```

**Using PostGIS (More Accurate):**
```sql
SELECT
  b.name,
  ST_Distance(
    b.location,
    ST_SetSRID(ST_MakePoint(:user_lng, :user_lat), 4326)::geography
  ) as distance_meters
FROM branches b
WHERE ST_DWithin(
  b.location,
  ST_SetSRID(ST_MakePoint(:user_lng, :user_lat), 4326)::geography,
  b.geofence_radius
)
ORDER BY distance_meters
LIMIT 1;
```

---

#### 6. Suspicious Pattern Detection

**Patterns to Detect:**

**Impossible Travel:**
```typescript
// Check if employee moved too fast between locations
async function detectImpossibleTravel(employeeId) {
  const lastTwoLogs = await getLastTwoAttendanceLogs(employeeId);

  if (lastTwoLogs.length < 2) return { suspicious: false };

  const [current, previous] = lastTwoLogs;

  const distance = calculateDistance(
    current.latitude, current.longitude,
    previous.latitude, previous.longitude
  );

  const timeDiff = (current.timestamp - previous.timestamp) / 1000; // seconds
  const speedKmh = (distance / timeDiff) * 3.6;

  // Flag if speed > 200 km/h (unrealistic)
  if (speedKmh > 200) {
    return {
      suspicious: true,
      type: 'impossible_travel',
      speed_kmh: speedKmh,
      distance_km: distance / 1000
    };
  }

  return { suspicious: false };
}
```

**Repeated Failures:**
```typescript
// Detect multiple failed OTP attempts
async function detectRepeatedFailures(employeeId) {
  const recentOTPs = await getRecentOTPLogs(employeeId, 3600); // last hour

  const failedAttempts = recentOTPs.filter(log => !log.is_verified).length;

  if (failedAttempts > 10) {
    return {
      suspicious: true,
      type: 'multiple_otp_failures',
      count: failedAttempts
    };
  }

  return { suspicious: false };
}
```

**Unusual Check-in Times:**
```typescript
// Detect check-ins at unusual hours
function isUnusualTime(timestamp, shift) {
  const hour = new Date(timestamp).getHours();
  const shiftStart = new Date(shift.start_time).getHours();

  // More than 3 hours before shift
  if (hour < shiftStart - 3 || hour > shiftStart + 12) {
    return {
      unusual: true,
      type: 'unusual_time',
      difference_hours: Math.abs(hour - shiftStart)
    };
  }

  return { unusual: false };
}
```

---

### System Limitations

#### 1. Technical Limitations

**GPS Accuracy:**
- **Indoor Environments:** GPS accuracy degrades indoors (30-100m typical)
- **Urban Canyons:** Tall buildings can block satellite signals
- **Weather:** Heavy rain/clouds affect GPS accuracy
- **Device Quality:** Older devices have less accurate GPS

**Workarounds:**
- Use WiFi and cell tower triangulation
- Increase geofence radius for indoor branches
- Allow manual check-in with admin approval

---

**Offline Functionality:**
- **Limited:** Attendance stored locally, synced when online
- **Security Risk:** Offline data can be manipulated
- **Validation:** Server re-validates all offline synced data

**Workarounds:**
- Require online check-in for high-security branches
- Flag all offline check-ins for manual review

---

**Device Compatibility:**
- **Android:** Requires Android 8.0+ for best GPS accuracy
- **iOS:** Requires iOS 13+ for background location
- **GPS Required:** Devices without GPS cannot use system

---

#### 2. Fraud Prevention Limitations

**Cannot Prevent:**
- **GPS Spoofing by Experts:** Advanced users with rooted devices can spoof GPS undetected
- **Shared Credentials:** Users can share phone and let others check-in
- **Hardware Manipulation:** External GPS spoofers (rare but possible)

**Mitigation:**
- Combine with biometric authentication (future enhancement)
- Add facial recognition check-in (future)
- Random audit checks
- CCTV verification at branches

---

**False Positives:**
- Rooted devices for legitimate reasons (developers)
- Poor GPS in buildings (not fraud)
- Time differences due to timezone changes

**Mitigation:**
- Allow admin overrides
- Whitelist known developer devices
- Add manual attendance option

---

#### 3. Operational Limitations

**Scalability:**
- **Database:** PostgreSQL scales to millions of records
- **API:** Edge Functions auto-scale but have cold start (1-2s)
- **Supabase Free Tier:** 500MB database, 2GB storage, 50K monthly active users

**Upgrade Path:**
- Migrate to Supabase Pro ($25/mo) for production
- Add database read replicas for heavy read operations
- Use connection pooling for high concurrency

---

**Geofencing Accuracy:**
- **Error Margin:** ±10-50 meters depending on GPS
- **Building Size:** Small buildings may need larger geofence
- **Multiple Floors:** GPS cannot detect floors

**Workarounds:**
- Use larger geofence radius (200-300m)
- Add manual floor selection
- Use WiFi SSID detection (future enhancement)

---

**Network Dependency:**
- **Internet Required:** Check-in requires internet for OTP
- **Poor Networks:** SMS delays can frustrate users

**Workarounds:**
- Support email OTP as fallback
- Add in-app OTP generation (less secure)
- Offline mode with delayed verification

---

#### 4. Compliance & Privacy

**GDPR/Data Privacy:**
- **Location Tracking:** Requires explicit employee consent
- **Data Storage:** Must comply with local data residency laws
- **Right to Delete:** Employees can request data deletion

**Compliance Measures:**
- Add consent flow during registration
- Implement data export/deletion endpoints
- Store data in appropriate region (Supabase has multiple regions)
- Add privacy policy and terms of service

---

**Labor Laws:**
- **Overtime:** System must track working hours accurately
- **Breaks:** Some countries require break tracking
- **Shift Regulations:** Maximum hours per shift varies by country

**Compliance Measures:**
- Configurable working hour rules per country
- Break time tracking (future enhancement)
- Overtime alerts
- Export compliance reports

---

### Security Best Practices

#### For Administrators

1. **Strong Passwords:** Enforce strong password policy
2. **2FA:** Enable two-factor authentication for admin accounts
3. **Regular Audits:** Review audit logs weekly
4. **Access Control:** Use least privilege principle
5. **Device Management:** Regularly review registered devices
6. **Fraud Monitoring:** Check fraud alerts daily
7. **Backup:** Regular database backups (automated in Supabase)

#### For Employees

1. **Protect Credentials:** Never share phone or login details
2. **GPS Permissions:** Keep GPS enabled only when needed
3. **App Updates:** Keep mobile app updated
4. **Report Issues:** Report suspicious activity immediately
5. **Device Security:** Use device lock (PIN/biometric)

#### For Developers

1. **Code Reviews:** All code must be reviewed
2. **Security Testing:** Regular penetration testing
3. **Dependency Updates:** Keep dependencies updated
4. **Secret Management:** Never commit secrets to git
5. **Error Handling:** Don't expose sensitive info in errors
6. **Logging:** Log security events but not sensitive data

---

### Disaster Recovery

**Backup Strategy:**
- **Database:** Automated daily backups (Supabase)
- **Retention:** 30 days of backups
- **Point-in-Time Recovery:** Available on Supabase Pro

**Incident Response:**
1. Detect incident (monitoring alerts)
2. Isolate affected systems
3. Investigate root cause
4. Restore from backup if needed
5. Implement fix
6. Post-mortem analysis

**Business Continuity:**
- **RTO (Recovery Time Objective):** 2 hours
- **RPO (Recovery Point Objective):** 24 hours (daily backups)
- **Failover:** Supabase has built-in redundancy

---

### Monitoring & Alerting

**Critical Alerts:**
- High fraud alert volume (>10/hour)
- Database down
- API error rate >5%
- OTP delivery failures
- Supabase storage near limit

**Monitoring Tools:**
- **Sentry:** Error tracking and performance monitoring
- **Supabase Dashboard:** Database metrics, API usage
- **Vercel Analytics:** Web dashboard performance
- **Custom Alerts:** Edge Function for critical business metrics

---

## Conclusion

This GPS-Based Employee Attendance System provides a comprehensive, production-ready solution for accurate attendance tracking with robust fraud prevention. The system balances security, usability, and scalability while acknowledging real-world limitations.

**Key Strengths:**
- ✓ Accurate GPS-based geofencing
- ✓ Multi-layer fraud prevention
- ✓ Secure OTP verification
- ✓ Comprehensive admin controls
- ✓ Scalable architecture
- ✓ Offline support
- ✓ Real-time monitoring

**Recommended Next Steps:**
1. Review and approve technical specifications
2. Assemble development team
3. Start with MVP (Phase 1)
4. Conduct user testing after MVP
5. Iterate based on feedback
6. Plan full production launch

**Total Estimated Cost (First Year):**
- Development: $60,000 - $80,000 (team of 4-5 for 4 months)
- Infrastructure: $500/month (Supabase Pro, Twilio, hosting)
- Maintenance: $3,000/month (part-time developer)

**ROI:** Eliminates buddy punching, improves payroll accuracy, reduces time theft. Typical ROI is 6-12 months for companies with 100+ employees.

---

**Document Version:** 1.0
**Last Updated:** January 10, 2026
**Author:** System Architect
**Status:** Ready for Implementation

/*
  # Remove Duplicate Leave Request Notification Trigger

  1. Problem
    - TWO triggers exist on leave_requests table firing on INSERT
    - Trigger 1: `notify_leave_request_created` → uses correct schema (role, type, data)
    - Trigger 2: `leave_request_notification_trigger` → uses OLD schema (recipient_role, entity_type, entity_id)
    - When leave request is submitted, BOTH triggers fire
    - Second trigger causes error: "column recipient_role does not exist"

  2. Root Cause
    - Old trigger and function were never dropped
    - Original migration created: notify_admin_on_leave_request() function
    - New migration created: create_leave_request_notification() function
    - Both triggers remain active, causing duplicate execution

  3. Solution
    - Drop old trigger: leave_request_notification_trigger
    - Drop old function: notify_admin_on_leave_request()
    - Keep correct trigger: notify_leave_request_created
    - Keep correct function: create_leave_request_notification()

  4. Verification
    - Only ONE trigger remains on leave_requests after INSERT
    - Only correct schema columns used (role, type, data)
    - No references to deprecated columns (recipient_role, entity_type, entity_id)
*/

-- Drop the old duplicate trigger
DROP TRIGGER IF EXISTS leave_request_notification_trigger ON leave_requests;

-- Drop the old function with deprecated schema
DROP FUNCTION IF EXISTS notify_admin_on_leave_request();

-- Verification: Only notify_leave_request_created trigger should remain

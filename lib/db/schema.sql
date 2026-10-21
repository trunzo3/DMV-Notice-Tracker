CREATE TABLE employees (
 employee_id serial PRIMARY KEY, first_name text NOT NULL, last_name text NOT NULL, district integer NOT NULL CHECK(district BETWEEN 1 AND 12),
 unit text NOT NULL, job_title text NOT NULL, email text NOT NULL, supervisor_name text NOT NULL, supervisor_email text NOT NULL,
 drives_for_department boolean NOT NULL, license_number text UNIQUE NOT NULL, license_class text NOT NULL,
 license_expiration_date date NOT NULL, medical_certificate_expiration_date date
);
CREATE TABLE dmv_notices (
 notice_id serial PRIMARY KEY, received_date date NOT NULL, license_number text NOT NULL, matched_employee_id integer REFERENCES employees,
 notice_type text NOT NULL, violation_or_event_date date NOT NULL, effective_date date, description text NOT NULL,
 flag text NOT NULL, driving_impact text NOT NULL, status text NOT NULL, source text NOT NULL DEFAULT 'DMV notice'
);
CREATE TABLE memos (
 memo_id serial PRIMARY KEY, notice_id integer NOT NULL REFERENCES dmv_notices, created_by text NOT NULL, created_date timestamptz NOT NULL DEFAULT now(),
 to_employee_email text NOT NULL, cc_supervisor_email text NOT NULL, subject text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'Draft', sent_date timestamptz
);
CREATE TABLE actions (
 action_id serial PRIMARY KEY, notice_id integer UNIQUE NOT NULL REFERENCES dmv_notices, action_required text NOT NULL, due_date date NOT NULL,
 assigned_to text NOT NULL DEFAULT 'employee', status text NOT NULL DEFAULT 'Open'
);
CREATE TABLE documents (
 document_id serial PRIMARY KEY, notice_id integer NOT NULL REFERENCES dmv_notices, file_name text NOT NULL, document_type text NOT NULL,
 uploaded_by text NOT NULL, uploaded_date timestamptz NOT NULL DEFAULT now(), object_path text NOT NULL
);
CREATE TABLE activity_log (
 log_id serial PRIMARY KEY, notice_id integer NOT NULL REFERENCES dmv_notices, user_name text NOT NULL, action_text text NOT NULL,
 timestamp timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memo_templates (
 template_id serial PRIMARY KEY, notice_type text UNIQUE NOT NULL, subject text NOT NULL, body text NOT NULL
);
CREATE TABLE demo_sessions (token text PRIMARY KEY, user_id integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE demo_imports (import_date date PRIMARY KEY);
CREATE TABLE pending_uploads (object_path text PRIMARY KEY, notice_id integer NOT NULL REFERENCES dmv_notices, user_id integer NOT NULL, file_name text NOT NULL, content_type text NOT NULL, size integer NOT NULL);

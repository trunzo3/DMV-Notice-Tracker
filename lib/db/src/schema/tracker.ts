import {pgTable,serial,text,integer,boolean,date,timestamp} from "drizzle-orm/pg-core";
export const employees=pgTable("employees",{
 employee_id:serial("employee_id").primaryKey(),first_name:text("first_name").notNull(),last_name:text("last_name").notNull(),district:integer("district").notNull(),
 unit:text("unit").notNull(),job_title:text("job_title").notNull(),email:text("email").notNull(),supervisor_name:text("supervisor_name").notNull(),supervisor_email:text("supervisor_email").notNull(),
 drives_for_department:boolean("drives_for_department").notNull(),license_number:text("license_number").notNull().unique(),license_class:text("license_class").notNull(),
 license_expiration_date:date("license_expiration_date").notNull(),medical_certificate_expiration_date:date("medical_certificate_expiration_date"),
});
export const notices=pgTable("dmv_notices",{
 notice_id:serial("notice_id").primaryKey(),received_date:date("received_date").notNull(),license_number:text("license_number").notNull(),matched_employee_id:integer("matched_employee_id").references(()=>employees.employee_id),
 notice_type:text("notice_type").notNull(),violation_or_event_date:date("violation_or_event_date").notNull(),effective_date:date("effective_date"),description:text("description").notNull(),
 flag:text("flag").notNull(),driving_impact:text("driving_impact").notNull(),status:text("status").notNull(),source:text("source").notNull().default("DMV notice"),
});
export const memos=pgTable("memos",{
 memo_id:serial("memo_id").primaryKey(),notice_id:integer("notice_id").notNull().references(()=>notices.notice_id),created_by:text("created_by").notNull(),created_date:timestamp("created_date",{withTimezone:true}).notNull().defaultNow(),
 to_employee_email:text("to_employee_email").notNull(),cc_supervisor_email:text("cc_supervisor_email").notNull(),subject:text("subject").notNull(),body:text("body").notNull(),
 status:text("status").notNull().default("Draft"),sent_date:timestamp("sent_date",{withTimezone:true}),
});
export const actions=pgTable("actions",{
 action_id:serial("action_id").primaryKey(),notice_id:integer("notice_id").notNull().unique().references(()=>notices.notice_id),action_required:text("action_required").notNull(),due_date:date("due_date").notNull(),
 assigned_to:text("assigned_to").notNull().default("employee"),status:text("status").notNull().default("Open"),
});
export const documents=pgTable("documents",{
 document_id:serial("document_id").primaryKey(),notice_id:integer("notice_id").notNull().references(()=>notices.notice_id),file_name:text("file_name").notNull(),document_type:text("document_type").notNull(),
 uploaded_by:text("uploaded_by").notNull(),uploaded_date:timestamp("uploaded_date",{withTimezone:true}).notNull().defaultNow(),object_path:text("object_path").notNull(),
});
export const activityLog=pgTable("activity_log",{
 log_id:serial("log_id").primaryKey(),notice_id:integer("notice_id").notNull().references(()=>notices.notice_id),user_name:text("user_name").notNull(),action_text:text("action_text").notNull(),timestamp:timestamp("timestamp",{withTimezone:true}).notNull().defaultNow(),
});
export const templates=pgTable("memo_templates",{
 template_id:serial("template_id").primaryKey(),notice_type:text("notice_type").notNull().unique(),subject:text("subject").notNull(),body:text("body").notNull(),
});
export const sessions=pgTable("demo_sessions",{token:text("token").primaryKey(),user_id:integer("user_id").notNull(),expires_at:timestamp("expires_at",{withTimezone:true}).notNull()});
export const imports=pgTable("demo_imports",{import_date:date("import_date").primaryKey()});
export const uploads=pgTable("pending_uploads",{
 object_path:text("object_path").primaryKey(),notice_id:integer("notice_id").notNull().references(()=>notices.notice_id),user_id:integer("user_id").notNull(),file_name:text("file_name").notNull(),content_type:text("content_type").notNull(),size:integer("size").notNull(),
});

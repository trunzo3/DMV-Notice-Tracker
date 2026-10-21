import { pool } from "@workspace/db";
export type Row = Record<string, any>;
export const users = [
 {id:1,name:"Maria Lopez",role:"ODCAST Staff",district:null},
 {id:2,name:"James Chen",role:"ODCAST Staff",district:null},
 {id:3,name:"Priya Nair",role:"District Staff",district:3},
 {id:4,name:"Robert Hayes",role:"District Staff",district:4},
];
export const types = ["Conviction/Violation","Failure to Appear","Suspension","Revocation","License Expiring","License Expired","Medical Certificate Expiring","Accident Reported","Reinstatement"];
export const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function plus(date:string,days:number) {const d = new Date(date+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function business(date:string,n:number) {while(n){date=plus(date,1); if(![0,6].includes(new Date(date+"T12:00:00Z").getUTCDay()))n--;}return date;}
export const textByType:Record<string,string> = {
 "Suspension":"Stop all department driving immediately. Submit proof of valid license or reinstatement.",
 "Revocation":"Stop all department driving immediately. Submit proof of valid license or reinstatement.",
 "License Expired":"Stop all department driving immediately. Submit proof of valid license or reinstatement.",
 "Failure to Appear":"Resolve with the court and submit the court disposition.",
 "Conviction/Violation":"Acknowledge the notice and submit a current DMV record printout.",
 "Accident Reported":"Submit an accident report copy and a current DMV record printout.",
 "License Expiring":"Renew license and submit a copy of the renewed license.",
 "Medical Certificate Expiring":"Submit an updated medical certificate.",
};
const tables = ["employees","dmv_notices","memos","actions","documents","activity_log","memo_templates"];
export async function rows(table:string):Promise<Row[]> {if(!tables.includes(table))throw Error("Invalid table");return (await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t`)).rows.map(r=>r.row);}
export async function insert(table:string,values:Row):Promise<Row> {
 if(!tables.includes(table))throw Error("Invalid table");
 const keys=Object.keys(values);if(keys.some(k=>!/^[a-z_]+$/.test(k)))throw Error("Invalid key");
 const r=await pool.query(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((_,i)=>"$"+(i+1)).join(",")}) RETURNING to_jsonb(${table}.*) AS row`,Object.values(values));return r.rows[0].row;
}
export async function log(id:number,user:string,text:string){await insert("activity_log",{notice_id:id,user_name:user,action_text:text});}
export function flag(n:Row) {
 if(n.effective_date && n.effective_date>today() || ["License Expiring","Medical Certificate Expiring"].includes(n.notice_type)) return "Upcoming issue";
 if(["Suspension","Revocation","License Expired","Failure to Appear"].includes(n.notice_type))return "Current issue";
 return "Informational";
}
export function impact(n:Row,e?:Row) {
 if(e&&!e.drives_for_department)return "Not a driving position";
 if(!e)return "Review needed";
 if(n.status==="Resolved" || n.notice_type==="Reinstatement")return "Cleared to drive";
 if(flag(n)==="Current issue"&&["Suspension","Revocation","License Expired"].includes(n.notice_type))return "Not cleared to drive";
 return "Review needed";
}
export function due(n:Row,e?:Row) {
 if(n.notice_type==="Reinstatement")return null;
 if(n.notice_type.includes("Expiring"))return plus((n.notice_type==="License Expiring"?e?.license_expiration_date:e?.medical_certificate_expiration_date)||n.effective_date||plus(today(),30),-7);
 return business(n.received_date,["Suspension","Revocation","License Expired"].includes(n.notice_type)?1:n.notice_type==="Failure to Appear"?5:10);
}
export async function addNotice(n:Row,e?:Row,customDue?:string) {
 n.flag=flag(n);n.driving_impact=impact(n,e);
 const notice=await insert("dmv_notices",n);
 const date=n.notice_type==="Reinstatement"?null:customDue||due(n,e);
 if(date)await insert("actions",{notice_id:notice.notice_id,action_required:textByType[n.notice_type],due_date:date,status:n.status==="Resolved"?"Done":"Open"});
 await log(notice.notice_id,"Demo system",`Notice received; status ${n.status}`);
 return notice;
}
export const templateBody = `To: {employee_name} ({employee_id})
CC: {supervisor_name}

The Department received a DMV {notice_type} notice for your driver's license. Event date: {event_date}. Effective date: {effective_date}. Details: {description}.

Required action: {action_required}
Due date: {due_date}

Upload supporting documents through your supervisor or district staff contact. Contact {sender_name} with questions.`;
export async function generateMemo(n:Row,e:Row,user:string) {
 const template=(await rows("memo_templates")).find(t=>t.notice_type===n.notice_type)!;
 const action=(await rows("actions")).find(a=>a.notice_id===n.notice_id);
 const fields:Row={employee_name:e.first_name+" "+e.last_name,employee_id:e.employee_id,supervisor_name:e.supervisor_name,notice_type:n.notice_type,event_date:n.violation_or_event_date,effective_date:n.effective_date||"Not specified",description:n.description,action_required:action?.action_required||"No action required",due_date:action?.due_date||"Not applicable",sender_name:user};
 const fill=(s:string)=>s.replace(/\{(\w+)\}/g,(match,key)=>String(fields[key]??match));
 const memo=await insert("memos",{notice_id:n.notice_id,created_by:user,to_employee_email:e.email,cc_supervisor_email:e.supervisor_email,subject:fill(template.subject),body:fill(template.body)});
 await log(n.notice_id,user,"Memo generated");return memo;
}
let refreshing:Promise<void>|undefined;
export async function refreshDaily() {
 if(refreshing)return refreshing;
 refreshing=(async()=>{
 const es=await rows("employees"), ns=await rows("dmv_notices");
 for(const e of es)for(const [field,type] of [["license_expiration_date","License Expiring"],["medical_certificate_expiration_date","Medical Certificate Expiring"]]) {
  const expiry=e[field!];if(!expiry||expiry<today()||expiry>plus(today(),60))continue;
  if(ns.some(n=>n.matched_employee_id===e.employee_id&&n.notice_type===type&&n.effective_date===expiry))continue;
  await addNotice({received_date:today(),license_number:e.license_number,matched_employee_id:e.employee_id,notice_type:type,violation_or_event_date:today(),effective_date:expiry,description:`${type} on ${expiry}.`,status:"New",source:"Daily expiration check"},e);
 }
 for(const n of await rows("dmv_notices")) {
  const e=es.find(e=>e.employee_id===n.matched_employee_id);
  await pool.query("UPDATE dmv_notices SET flag=$1, driving_impact=$2 WHERE notice_id=$3",[flag(n),impact(n,e),n.notice_id]);
 }
 const overdue=await pool.query("UPDATE actions SET status='Overdue' WHERE status='Open' AND due_date<$1 RETURNING notice_id",[today()]);
 for(const a of overdue.rows) {await pool.query("UPDATE dmv_notices SET status='Overdue' WHERE notice_id=$1 AND status<>'Resolved'",[a.notice_id]);await log(a.notice_id,"Demo system","Action overdue; notice status changed to Overdue");}
 })().finally(()=>{refreshing=undefined;});
 return refreshing;
}

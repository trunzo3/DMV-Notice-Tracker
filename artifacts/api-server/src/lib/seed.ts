import { pool } from "@workspace/db";
import {addNotice,generateMemo,insert,plus,rows,templateBody,today,types,log} from "./tracker";
import {fileAt,newPath,pdf} from "./files";
export async function seed() {
 if((await rows("employees")).length)return;
 for(const type of types)await insert("memo_templates",{notice_type:type,subject:type==="Reinstatement"?"DMV {notice_type} notice — confirmation":"Action required: DMV {notice_type} notice — due {due_date}",body:templateBody});
 const first=["Avery","Jordan","Morgan","Taylor","Riley","Casey","Quinn","Skyler","Rowan","Parker"];
 const last=["Examplebrook","Sampleton","Fableford","Demowood"];
 for(let i=0;i<40;i++){
  const district=i<8?3:i<16?4:[1,2,5,6,7,8,9,10,11,12][(i-16)%10]!;
  await insert("employees",{first_name:first[i%10],last_name:last[Math.floor(i/10)],district,unit:["Highway Maintenance","Traffic Operations","Construction","Administration"][i%4],job_title:i<30?"Transportation Equipment Operator":"Office Technician",email:`employee${i+1}@example.invalid`,supervisor_name:`Alex Sample Supervisor ${district}`,supervisor_email:`supervisor${district}@example.invalid`,drives_for_department:i<30,license_number:`D${String(1000000+i)}`,license_class:i%3===0?"A":i%3===1?"B":"C",license_expiration_date:plus(today(),i>=20&&i<25?15+(i-20)*9:200+i),medical_certificate_expiration_date:i%3===2?null:plus(today(),i===18?25:i===19?45:180+i)});
 }
 const es=await rows("employees");
 const noticeTypes=["Suspension","Revocation","License Expired","Suspension","Failure to Appear","License Expiring","Medical Certificate Expiring","Suspension","Revocation","License Expiring","Medical Certificate Expiring","Reinstatement","Suspension","Conviction/Violation","Accident Reported","Conviction/Violation","Failure to Appear","Accident Reported","Conviction/Violation","Reinstatement","Failure to Appear","Accident Reported","Conviction/Violation","Suspension","Conviction/Violation"];
 for(let i=0;i<25;i++){
  const e=es[i===1?8:i===2?9:i]!;
  const resolved=i>=11&&i<=14;
  const type=noticeTypes[i]!;
  const upcoming=i>=5&&i<=10;
  const received=plus(today(),i<5?-12:i>=20?0:-Math.min(29,i));
  const n=await addNotice({received_date:received,license_number:i>=23?`Z${9000000+i}`:e.license_number,matched_employee_id:i>=23?null:e.employee_id,notice_type:type,violation_or_event_date:plus(received,-2),effective_date:upcoming?plus(today(),20+i):plus(today(),-4),description:`${type} reported in a fictional California county.`,status:resolved?"Resolved":i<5?"Overdue":i%3===0?"Awaiting documents":"New",source:"DMV notice"},i>=23?undefined:e,i<5?plus(today(),-i-1):plus(today(),i+2));
  if(i<5)await pool.query("UPDATE actions SET status='Overdue' WHERE notice_id=$1",[n.notice_id]);
  if(resolved){
   const memo=await generateMemo(n,e,"Maria Lopez");
   await pool.query("UPDATE memos SET status='Sent',sent_date=now() WHERE memo_id=$1",[memo.memo_id]);
   await log(n.notice_id,"Maria Lopez","Memo recorded as sent (demo — no email sent).");
   const path=newPath(),type="DMV record printout";
   await fileAt(path).save(await pdf("Sample document — demo only",`${type}\n${e.first_name} ${e.last_name}`),{contentType:"application/pdf"});
   await insert("documents",{notice_id:n.notice_id,file_name:`sample-document-${n.notice_id}.pdf`,document_type:type,uploaded_by:"Maria Lopez",object_path:path});
   await log(n.notice_id,"Maria Lopez","Sample document uploaded; case marked Resolved");
  }
 }
}

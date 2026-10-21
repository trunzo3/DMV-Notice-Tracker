import assert from "node:assert/strict";
import {createRequire} from "node:module";
if(process.env.DMV_ISOLATED_CHECK!=="1")throw Error("Run only on an unused development demo with DMV_ISOLATED_CHECK=1.");
const require=createRequire(new URL("../../lib/db/package.json",import.meta.url));
const {Pool}=require("pg");
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const base="http://localhost:80/api/demo";
const cookies={};
async function call(path,body,user=1,method=body===undefined?"GET":"POST"){
 const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(cookies[user]?{Cookie:cookies[user]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 if(path==="/session"&&method==="POST")cookies[user]=r.headers.get("set-cookie").split(";")[0];
 if(!r.ok)throw Error(`${path}: ${r.status} ${await r.text()}`);
 return r.headers.get("content-type")?.includes("json")?r.json():Buffer.from(await r.arrayBuffer());
}
const initialMax=Number((await pool.query("SELECT max(notice_id) AS id FROM dmv_notices")).rows[0].id);
let template;
try{
 for(let id=1;id<=4;id++){
  const session=await call("/session",{userId:id},id);
  const s=await call("/state",undefined,id);
  assert.equal(session.user.id,id);
  if(id>2){assert(s.employees.every(e=>e.district===id));assert(s.notices.every(n=>s.employees.some(e=>e.employee_id===n.matched_employee_id)));}
  else assert.equal(s.employees.length,40);
 }
 console.log("PASS: all four demo logins and server-side district scopes");
 const s=await call("/state");assert(Object.values(s.summary).every(n=>n>0));
 console.log("PASS: all six dashboard counts non-zero",s.summary);
 const batch=await call("/import",{});assert.equal(batch.imported,6);assert.equal((await call("/state")).summary["New today"],s.summary["New today"]+6);
 console.log("PASS: daily batch adds six notices dated today");
 const imp=await call("/import",{csv:"license_number,notice_type,violation_or_event_date,effective_date,description\nZ1111111,Suspension,"+s.today+",,Validation sample"});
 assert.equal(imp.unmatched,1);
 let state=await call("/state");
 const n=state.notices.find(n=>n.license_number==="Z1111111");
 const e=s.employees.find(e=>e.district===3&&e.drives_for_department);
 const op=(body,id=1)=>call(`/notices/${n.notice_id}/operation`,body,id);
 await op({operation:"match",employeeId:e.employee_id});
 state=await call("/state");assert.equal(state.notices.find(v=>v.notice_id===n.notice_id).matched_employee_id,e.employee_id);
 console.log("PASS: manual unmatched-notice matching");
 await op({operation:"generateMemo"},3);
 state=await call("/state");const m=state.memos.find(m=>m.notice_id===n.notice_id);
 await op({operation:"saveMemo",memoId:m.memo_id,subject:"Validation edited memo",body:"Sample memo for demo API checks."},3);
 await op({operation:"sendMemo",memoId:m.memo_id},3);
 assert.equal((await call("/state")).notices.find(v=>v.notice_id===n.notice_id).status,"Memo sent");
 const pdf=await call(`/memos/${m.memo_id}/pdf`,undefined,3);assert(pdf.subarray(0,4).toString()==="%PDF");
 console.log("PASS: generate, edit, send and download a PDF memo");
 await op({operation:"saveAction",action_required:"Submit a sample document",due_date:s.today,assigned_to:"employee",status:"Open"},3);
 assert.equal((await call("/state")).notices.find(v=>v.notice_id===n.notice_id).status,"Awaiting documents");
 const upload=await call(`/notices/${n.notice_id}/upload-url`,{name:"validation.pdf",contentType:"application/pdf",size:pdf.length},3);
 const put=await fetch(upload.uploadURL,{method:"PUT",headers:{"Content-Type":"application/pdf"},body:pdf});assert(put.ok,await put.text());
 await op({operation:"document",objectPath:upload.objectPath,file_name:"validation.pdf",document_type:"DMV record printout"},3);
 state=await call("/state");assert.equal(state.notices.find(v=>v.notice_id===n.notice_id).status,"Ready for ODCAST review");
 const d=state.documents.find(d=>d.notice_id===n.notice_id);assert.deepEqual(await call(`/documents/${d.document_id}/download`,undefined,3),pdf);
 const denied=await fetch(base+`/notices/${n.notice_id}/operation`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookies[3]},body:JSON.stringify({operation:"resolve"})});assert.equal(denied.status,403);
 await op({operation:"resolve"});
 assert.equal((await call("/state")).notices.find(v=>v.notice_id===n.notice_id).driving_impact,"Cleared to drive");
 console.log("PASS: private upload/download, ready-for-review transition, ODCAST-only resolution");
 await op({operation:"reopen"});
 await op({operation:"saveAction",due_date:"2020-01-01",status:"Open"});
 state=await call("/state");assert.equal(state.notices.find(v=>v.notice_id===n.notice_id).status,"Overdue");
 assert(state.activity.filter(a=>a.notice_id===n.notice_id).length>=12);
 console.log("PASS: overdue deadlines and activity history");
 template=state.templates.find(t=>t.notice_type==="Suspension");
 await call(`/templates/${template.template_id}`,{subject:"Changed template {employee_name}",body:template.body},1,"PUT");
 await op({operation:"generateMemo"});
 state=await call("/state");assert(state.memos.filter(m=>m.notice_id===n.notice_id).some(m=>m.subject.startsWith("Changed template ")));
 console.log("PASS: edited template affects next generated memo");
 const forbidden=await fetch(base+"/import",{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookies[4]},body:"{}"});assert.equal(forbidden.status,403);
 const inaccessible=await fetch(base+`/memos/${m.memo_id}/pdf`,{headers:{Cookie:cookies[4]}});assert.equal(inaccessible.status,404);
 console.log("PASS: district import and cross-district file access blocked");
}finally{
 if(template)await pool.query("UPDATE memo_templates SET subject=$1,body=$2 WHERE template_id=$3",[template.subject,template.body,template.template_id]);
 for(const t of ["pending_uploads","activity_log","documents","memos","actions"])await pool.query(`DELETE FROM ${t} WHERE notice_id>$1`,[initialMax]);
 await pool.query("DELETE FROM dmv_notices WHERE notice_id>$1",[initialMax]);
 await pool.query("DELETE FROM demo_imports WHERE import_date=(now() AT TIME ZONE 'America/Los_Angeles')::date");
 for(const cookie of Object.values(cookies))await pool.query("DELETE FROM demo_sessions WHERE token=$1",[cookie.split("=")[1]]);
 await pool.end();
 console.log("Restored initial demo notices and unloaded daily batch.");
}

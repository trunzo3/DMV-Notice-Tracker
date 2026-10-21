import {Router,type IRouter,type Request,type Response,type NextFunction} from "express";
import {randomBytes} from "node:crypto";
import {pool} from "@workspace/db";
import {parse} from "csv-parse/sync";
import {SignInBody,UpdateCaseBody,ImportNoticesBody,SaveTemplateBody,RequestDocumentUploadBody,GetTrackerStateResponse} from "@workspace/api-zod";
import {users,today,plus,rows,insert,log,generateMemo,addNotice,refreshDaily,impact,types,type Row} from "../lib/tracker";
import {fileAt,newPath,uploadUrl,pdf} from "../lib/files";
const router:IRouter=Router();
const token=(req:Request)=>req.headers.cookie?.split(";").map(x=>x.trim()).find(x=>x.startsWith("dmv_session="))?.slice(12);
async function user(req:Request) {const t=token(req);if(!t)return null;const r=await pool.query("SELECT user_id FROM demo_sessions WHERE token=$1 AND expires_at>now()",[t]);return users.find(u=>u.id===r.rows[0]?.user_id)||null;}
router.get("/session",async(req,res)=>{res.json({users,user:await user(req),today:today()});});
router.post("/session",async(req,res)=>{
 const {userId}=SignInBody.parse(req.body), t=randomBytes(32).toString("hex");
 await pool.query("INSERT INTO demo_sessions VALUES($1,$2,now()+interval '1 day')",[t,userId]);
 res.cookie("dmv_session",t,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:86400000,path:"/"});
 res.json({users,user:users.find(u=>u.id===userId),today:today()});
});
router.delete("/session",async(req,res)=>{await pool.query("DELETE FROM demo_sessions WHERE token=$1",[token(req)||""]);res.clearCookie("dmv_session",{path:"/"});res.json({message:"Signed out"});});
router.use(async(req,res,next)=>{const u=await user(req);if(!u){res.status(401).json({error:"Please sign in"});return;}res.locals.user=u;next();});
function admin(res:Response){if(res.locals.user.role!=="ODCAST Staff")throw Object.assign(Error("ODCAST access required"),{status:403});}
async function notice(id:number,res:Response) {
 const n=(await rows("dmv_notices")).find(n=>n.notice_id===id);
 const e=(await rows("employees")).find(e=>e.employee_id===n?.matched_employee_id);
 if(!n || res.locals.user.district!==null&&e?.district!==res.locals.user.district)throw Object.assign(Error("Notice not found"),{status:404});
 return {n,e};
}
async function status(n:Row,value:string,name:string){if(n.status!==value){await pool.query("UPDATE dmv_notices SET status=$1 WHERE notice_id=$2",[value,n.notice_id]);await log(n.notice_id,name,`Status changed from ${n.status} to ${value}`);n.status=value;}}
router.get("/state",async(_req,res)=>{
 await refreshDaily();const u=res.locals.user;
 const employees=(await rows("employees")).filter(e=>u.district===null||e.district===u.district);
 const notices=(await rows("dmv_notices")).filter(n=>u.district===null||employees.some(e=>e.employee_id===n.matched_employee_id));
 const ids=new Set(notices.map(n=>n.notice_id));
 const [actions,memos,documents,activity,templates]=await Promise.all(["actions","memos","documents","activity_log","memo_templates"].map(rows));
 const scopedActions=actions!.filter(a=>ids.has(a.notice_id));
 for(const e of employees){
  const ns=notices.filter(n=>n.matched_employee_id===e.employee_id&&n.status!=="Resolved");
  e.open_notices_count=ns.length;
  e.driving_impact=!e.drives_for_department?"Not a driving position":ns.some(n=>n.driving_impact==="Not cleared to drive")?"Not cleared to drive":ns.some(n=>n.driving_impact==="Review needed")?"Review needed":"Cleared to drive";
 }
 const active=notices.filter(n=>n.status!=="Resolved");
 const summary={"New today":notices.filter(n=>n.received_date===today()).length,"Current issues":active.filter(n=>n.flag==="Current issue").length,"Upcoming issues":active.filter(n=>n.flag==="Upcoming issue").length,"Not cleared to drive":active.filter(n=>n.driving_impact==="Not cleared to drive").length,"Overdue actions":scopedActions.filter(a=>a.status==="Overdue").length,"Awaiting documents":notices.filter(n=>n.status==="Awaiting documents").length};
 res.json(GetTrackerStateResponse.parse({today:today(),employees,notices,actions:scopedActions,memos:memos!.filter(m=>ids.has(m.notice_id)),documents:documents!.filter(d=>ids.has(d.notice_id)).map(({object_path,...d})=>d),activity:activity!.filter(a=>ids.has(a.notice_id)).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)),templates:u.district===null?templates:[],batchLoaded:(await pool.query("SELECT 1 FROM demo_imports WHERE import_date=$1",[today()])).rowCount!>0,summary}));
});
router.post("/notices/:id/operation",async(req,res)=>{
 const id=Number(req.params.id),b=UpdateCaseBody.parse(req.body),{n,e}=await notice(id,res),name=res.locals.user.name;
 if(b.operation==="match"){
  admin(res);if(n.matched_employee_id)throw Error("Notice already matched");
  const employee=(await rows("employees")).find(e=>e.employee_id===b.employeeId);if(!employee)throw Error("Select an employee");
  await pool.query("UPDATE dmv_notices SET matched_employee_id=$1 WHERE notice_id=$2",[employee.employee_id,id]);await log(id,name,`Matched to ${employee.first_name} ${employee.last_name}`);
 }else if(b.operation==="generateMemo"){
  if(!e)throw Error("Match this notice to an employee first");await generateMemo(n,e,name);
 }else if(b.operation==="saveMemo"||b.operation==="sendMemo"){
  const m=(await rows("memos")).find(m=>m.memo_id===b.memoId&&m.notice_id===id);if(!m)throw Error("Memo not found");
  await pool.query("UPDATE memos SET subject=$1,body=$2,status=$3,sent_date=CASE WHEN $3='Sent' THEN now() ELSE sent_date END WHERE memo_id=$4",[b.subject??m.subject,b.body??m.body,b.operation==="sendMemo"?"Sent":m.status,m.memo_id]);
  await log(id,name,b.operation==="sendMemo"?"Memo recorded as sent (demo — no email sent).":"Memo draft edited");
  if(b.operation==="sendMemo")await status(n,"Memo sent",name);
 }else if(b.operation==="saveAction"){
  let a=(await rows("actions")).find(a=>a.notice_id===id);
  if(!a){
   if(!b.action_required||!b.due_date)throw Error("Action text and due date are required");
   a=await insert("actions",{notice_id:id,action_required:b.action_required,due_date:b.due_date,assigned_to:b.assigned_to||"employee",status:"Open"});
   await log(id,name,"Action created");
  }
  if(b.due_date&&(!Number.isFinite(Date.parse(b.due_date))||new Date(b.due_date).toISOString().slice(0,10)!==b.due_date))throw Error("Invalid due date");
  const date=b.due_date??a.due_date,s=b.status??a.status,finalStatus=s==="Done"?"Done":date<today()?"Overdue":"Open";
  await pool.query("UPDATE actions SET action_required=$1,due_date=$2,assigned_to=$3,status=$4 WHERE notice_id=$5",[b.action_required??a.action_required,date,b.assigned_to??a.assigned_to,finalStatus,id]);
  if(date!==a.due_date)await log(id,name,`Due date changed from ${a.due_date} to ${date}`);
  await log(id,name,`Action updated; status ${finalStatus}; assigned to ${b.assigned_to??a.assigned_to}`);
  if(n.status!=="Resolved")await status(n,finalStatus==="Overdue"?"Overdue":finalStatus==="Done"?"Ready for ODCAST review":"Awaiting documents",name);
 }else if(b.operation==="resolve"){
  admin(res);await status(n,"Resolved",name);await pool.query("UPDATE actions SET status='Done' WHERE notice_id=$1",[id]);
 }else if(b.operation==="reopen"){
  admin(res);await status(n,"New",name);await pool.query("UPDATE actions SET status='Open' WHERE notice_id=$1",[id]);
 }else if(b.operation==="ready"){
  await status(n,"Ready for ODCAST review",name);
 }else if(b.operation==="document"){
  const p=(await pool.query("SELECT * FROM pending_uploads WHERE object_path=$1 AND notice_id=$2 AND user_id=$3",[b.objectPath,id,res.locals.user.id])).rows[0];
  if(!p||!b.document_type)throw Error("Upload not found");
  const f=fileAt(p.object_path),[meta]=await f.getMetadata();
  if(Number(meta.size)>10485760||Number(meta.size)!==p.size)throw Error("Invalid uploaded file size");
  await insert("documents",{notice_id:id,file_name:p.file_name,document_type:b.document_type,uploaded_by:name,object_path:p.object_path});
  await pool.query("DELETE FROM pending_uploads WHERE object_path=$1",[p.object_path]);
  await log(id,name,`Document uploaded: ${p.file_name} (${b.document_type})`);
  if(n.status==="Awaiting documents")await status(n,"Ready for ODCAST review",name);
 }
 await pool.query("UPDATE dmv_notices SET driving_impact=$1 WHERE notice_id=$2",[impact(n,e),id]);
 res.json({message:b.operation==="sendMemo"?"Memo recorded as sent (demo — no email sent).":"Changes saved"});
});
router.post("/notices/:id/upload-url",async(req,res)=>{
 const id=Number(req.params.id);await notice(id,res);const b=RequestDocumentUploadBody.parse(req.body),path=newPath();
 const url=await uploadUrl(path);
 await pool.query("INSERT INTO pending_uploads VALUES($1,$2,$3,$4,$5,$6)",[path,id,res.locals.user.id,b.name,b.contentType,b.size]);
 res.json({uploadURL:url,objectPath:path});
});
router.get("/documents/:id/download",async(req,res)=>{
 const d=(await rows("documents")).find(d=>d.document_id===Number(req.params.id));if(!d)throw Error("Document not found");await notice(d.notice_id,res);
 res.setHeader("Content-Disposition",`attachment; filename="${d.file_name.replace(/[^a-zA-Z0-9._-]/g,"_")}"`);
 const f=fileAt(d.object_path),[meta]=await f.getMetadata();res.type(meta.contentType||"application/octet-stream");res.send((await f.download())[0]);
});
router.get("/memos/:id/pdf",async(req,res)=>{
 const m=(await rows("memos")).find(m=>m.memo_id===Number(req.params.id));if(!m)throw Error("Memo not found");await notice(m.notice_id,res);
 res.type("application/pdf").attachment(`memo-${m.memo_id}.pdf`).send(await pdf(m.subject,`To: ${m.to_employee_email}\nCC: ${m.cc_supervisor_email}\nStatus: ${m.status}\n\n${m.body}`));
});
router.put("/templates/:id",async(req,res)=>{
 admin(res);const b=SaveTemplateBody.parse(req.body);
 const r=await pool.query("UPDATE memo_templates SET subject=$1,body=$2 WHERE template_id=$3 RETURNING template_id",[b.subject,b.body,Number(req.params.id)]);if(!r.rowCount)throw Error("Template not found");res.json({message:"Template saved"});
});
router.post("/import",async(req,res)=>{
 admin(res);const b=ImportNoticesBody.parse(req.body),es=await rows("employees");
 let batch:Row[];
 if(b.csv!==undefined){
  batch=parse(b.csv,{columns:true,skip_empty_lines:true,trim:true,bom:true});
  if(!batch.length||batch.length>500)throw Error("CSV must contain 1–500 notices");
  for(const n of batch){
   if(!/^[A-Z]\d{7}$/.test(n.license_number)||!types.includes(n.notice_type)||!n.description||!n.violation_or_event_date||!Object.hasOwn(n,"effective_date"))throw Error("Invalid CSV columns, license number, or notice type");
   for(const date of [n.violation_or_event_date,n.effective_date].filter(Boolean))if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error("CSV dates must be valid YYYY-MM-DD");
  }
 }else{
  const r=await pool.query("INSERT INTO demo_imports VALUES($1) ON CONFLICT DO NOTHING RETURNING import_date",[today()]);
  if(!r.rowCount){res.status(409).json({error:"Today's sample batch is already loaded"});return;}
  batch=Array.from({length:6},(_,i)=>({license_number:es[[2,3,10,11,17,26][i]!]!.license_number,notice_type:types[[0,1,2,7,4,8][i]!]!,violation_or_event_date:plus(today(),-2),effective_date:i===4?plus(today(),32):today(),description:"Sample notice from today's fictional DMV batch."}));
 }
 let matched=0;
 for(const raw of batch){
  const e=es.find(e=>e.license_number===raw.license_number);if(e)matched++;
  const n=await addNotice({received_date:today(),license_number:raw.license_number,notice_type:raw.notice_type,violation_or_event_date:raw.violation_or_event_date,effective_date:raw.effective_date||null,description:raw.description,matched_employee_id:e?.employee_id??null,status:"New",source:"DMV notice"},e);
  await log(n.notice_id,res.locals.user.name,"Notice imported"+(e?" and automatically matched":"; employee match required"));
 }
 res.json({message:"Import complete",imported:batch.length,matched,unmatched:batch.length-matched});
});
router.use((err:any,req:Request,res:Response,_next:NextFunction)=>{req.log.error({err},"Demo request failed");res.status(err.status||400).json({error:err.message||"Request failed"});});
export default router;

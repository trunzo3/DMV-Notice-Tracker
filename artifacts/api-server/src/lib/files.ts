import PDFDocument from "pdfkit";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
const storage = new Storage({projectId:"",credentials:{audience:"replit",subject_token_type:"access_token",token_url:"http://127.0.0.1:1106/token",type:"external_account",credential_source:{url:"http://127.0.0.1:1106/credential",format:{type:"json",subject_token_field_name:"access_token"}},universe_domain:"googleapis.com"}});
export function fileAt(path:string) {const [bucket,...key]=path.replace(/^\//,"").split("/");return storage.bucket(bucket!).file(key.join("/"));}
export function newPath(){return `${process.env.PRIVATE_OBJECT_DIR}/dmv/${randomUUID()}`;}
export async function uploadUrl(path:string) {
 const [bucket,...parts]=path.replace(/^\//,"").split("/");
 const response=await fetch("http://127.0.0.1:1106/object-storage/signed-object-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bucket_name:bucket,object_name:parts.join("/"),method:"PUT",expires_at:new Date(Date.now()+900000).toISOString()})});
 if(!response.ok)throw Error("Unable to prepare upload");
 return (await response.json() as {signed_url:string}).signed_url;
}
export function pdf(subject:string,body:string):Promise<Buffer>{
 return new Promise(resolve=>{const doc=new PDFDocument({margin:55});const chunks:Buffer[]=[];doc.on("data",c=>chunks.push(c));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.fontSize(10).fillColor("#005A9C").text("CALTRANS | DMV NOTICE TRACKER");doc.moveDown().fillColor("#555555").text("DEMO - sample data only, not real DMV or employee records.");doc.moveDown(2).fillColor("#111111").fontSize(17).text(subject);doc.moveDown().fontSize(11).text(body,{lineGap:5});doc.end();});
}

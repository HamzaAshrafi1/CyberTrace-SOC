const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=process.argv[2],ts=require(path.join(root,'node_modules/typescript'));
const source=fs.readFileSync(path.join(root,'src/app/(dashboard)/flows/escalation.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let allowed=true,incidentAllowed=true,found=true,existing=null,review={id:'review-A',decision:'confirmed_suspicious',evidenceHash:'hash-A',revision:2,reviewerEmail:'analyst@test',reason:'Evidence inspected.'},failAudit=false,committed=[],locks=0;
const ctx={org:{id:'org-A'},user:{id:'user-A',email:'analyst@test'}};
const flow={id:'flow-A',rawHash:'hash-A',traceId:'trace-A',rawRecord:JSON.stringify({'id.orig_h':'192.0.2.1','id.resp_h':'192.0.2.2'}),eventTime:new Date('2019-04-24'),isSimulated:false};
const prisma={$transaction:async fn=>{
 const staged=[];
 const create=kind=>async({data})=>{staged.push({kind,data});return{id:kind+'-A',...data}};
 const tx={
  $queryRawUnsafe:async(sql,org,id)=>{assert(sql.includes('$1'));assert.equal(org,'org-A');assert.equal(id,'flow-A');locks++;return[{locked:1}]},
  flowRecord:{findFirst:async({where})=>{assert.equal(where.organizationId,'org-A');assert.equal(where.id,'flow-A');return found?flow:null}},
  flowReview:{findFirst:async({where})=>{assert.equal(where.organizationId,'org-A');assert.equal(where.flowId,'flow-A');return review}},
  flowEscalation:{findFirst:async({where})=>{assert.equal(where.organizationId,'org-A');return existing},create:create('link')},
  threatEvent:{create:create('threat')},incident:{create:create('incident')},incidentActivityLog:{create:create('activity')},
  auditLog:{create:async arg=>{if(failAudit)throw Error('audit failed');return create('audit')(arg)}}};
 const result=await fn(tx);committed.push(...staged);return result;
}};
const sandbox={exports:{},console:{error:()=>{}},require:name=>{
 if(name==='@/lib/prisma')return{default:prisma};
 if(name==='@/lib/dashboard/verify-permission')return{verifyPermission:async p=>{assert(['write:threats','write:incidents'].includes(p));if(!allowed||p==='write:incidents'&&!incidentAllowed)throw Error('forbidden');return ctx}};
 if(name==='next/cache')return{revalidatePath:()=>{}};
 throw Error(name);
}};
vm.runInNewContext(code,sandbox);const action=sandbox.exports.escalateFlow;
function form(overrides={}){const data={flowId:'flow-A',reviewId:'review-A',kind:'threat',severity:'MEDIUM',title:'Investigate flow',reason:'Analyst confirmed suspicious evidence.',confirm:'yes',...overrides};return{get:k=>data[k]}}
(async()=>{
 allowed=false;await action({},form());assert.equal(locks,0);allowed=true;
 await action({},form({confirm:null}));await action({},form({severity:'invalid'}));assert.equal(locks,0);
 incidentAllowed=false;await action({},form({kind:'incident'}));assert.equal(locks,0);incidentAllowed=true;
 found=false;await action({},form());assert.equal(committed.length,0);found=true;
 review.decision='needs_investigation';await action({},form());assert.equal(committed.length,0);review.decision='confirmed_suspicious';
 await action({},form({reviewId:'stale'}));assert.equal(committed.length,0);
 review.evidenceHash='changed';await action({},form());assert.equal(committed.length,0);review.evidenceHash='hash-A';
 let r=await action({},form());assert.equal(r.href,'/threats');assert.equal(committed.length,3);
 const threat=committed.find(x=>x.kind==='threat').data;assert.equal(threat.rawPayload,flow.rawRecord);assert.equal(threat.traceId,'trace-A');assert.equal(threat.sourceEventId,'flow-escalation:flow-A');
 existing={id:'link-A',reviewId:'review-A',kind:'threat',threatId:'threat-A',incidentId:null};await action({},form());assert.equal(committed.length,3);
 r=await action({},form({kind:'incident'}));assert(r.message.includes('already linked'));assert.equal(committed.length,3);existing=null;
 failAudit=true;await action({},form({kind:'incident'}));assert.equal(committed.length,3);failAudit=false;
 flow.isSimulated=true;r=await action({},form({kind:'incident'}));assert.equal(r.href,'/incidents/incident-A');
 const inc=committed.find(x=>x.kind==='incident').data;assert(inc.title.startsWith('[SYNTHETIC]'));assert(inc.description.includes('Review ID: review-A'));assert(inc.description.includes('hash-A'));
 assert.equal(committed.filter(x=>x.kind==='threat').length,1);assert.equal(committed.filter(x=>x.kind==='incident').length,1);
 console.log('Passed escalation checks: permissions, confirmation, validation, tenant scope, review freshness, evidence binding, retry deduplication, synthetic marking, incident activity, atomic audit failure (mocked transactions).');
})().catch(e=>{console.error(e);process.exit(1)});

const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = process.argv[2];
const ts = require(path.join(root, 'node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/flows/actions.ts'), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let allowed=true, found=true, latest=null, auditFails=false, committed=[], audits=[], locks=0;
const context={org:{id:'tenant-A'},user:{id:'reviewer-A',email:'analyst@example.test'}};
const prisma={$transaction:async fn=>{
 const staged=[], stagedAudits=[];
 const tx={
  $queryRawUnsafe:async(sql,org,id)=>{assert(sql.includes('$1'));assert.equal(org,'tenant-A');assert.equal(id,'flow-A');locks++;return [{locked:1}]},
  flowRecord:{findFirst:async({where})=>{assert.deepEqual(JSON.parse(JSON.stringify(where)),{id:'flow-A',organizationId:'tenant-A'});return found?{rawHash:'evidence-hash'}:null}},
  flowReview:{findFirst:async({where})=>{assert.equal(where.organizationId,'tenant-A');return latest},create:async({data})=>{staged.push(data);return {id:'review-A',...data}}},
  auditLog:{create:async({data})=>{if(auditFails)throw Error('audit failed');stagedAudits.push(data)}}
 };
 const result=await fn(tx);committed.push(...staged);audits.push(...stagedAudits);return result;
}};
const sandbox={exports:{},require:name=>{
 if(name==='@/lib/prisma')return {default:prisma};
 if(name==='@/lib/dashboard/verify-permission')return {verifyPermission:async permission=>{assert.equal(permission,'write:threats');if(!allowed)throw Error('Forbidden');return context}};
 if(name==='next/cache')return {revalidatePath:p=>assert.equal(p,'/flows')};
 throw Error(name);
},console:{error:()=>{}}};
vm.runInNewContext(code,sandbox);
const save=sandbox.exports.saveFlowReview;
function form(expected='',reason='Reviewed the connection evidence.',decision='needs_investigation') {const map={flowId:'flow-A',expectedReviewId:expected,reason,decision};return {get:k=>map[k]}}
(async()=>{
 allowed=false;await save({},form());assert.equal(locks,0);assert.equal(committed.length,0);
 allowed=true;await save({},form('','short'));await save({},form('','Valid reason here','invalid'));assert.equal(locks,0);
 found=false;await save({},form());assert.equal(committed.length,0);
 found=true;let result=await save({},form());assert(result.message.startsWith('Review saved'));assert.equal(committed[0].revision,1);assert.equal(committed[0].reviewerId,'reviewer-A');assert.equal(committed[0].evidenceHash,'evidence-hash');assert.equal(audits.length,1);
 latest={id:'review-A',revision:1};result=await save({},form());assert(result.message.includes('Another review'));assert.equal(committed.length,1);
 await save({},form('review-A','Dismissed after evidence inspection.','dismissed'));assert.equal(committed[1].revision,2);assert.equal(committed[0].decision,'needs_investigation');
 auditFails=true;await save({},form('review-A'));assert.equal(committed.length,2);assert.equal(audits.length,2);
 console.log('Passed: authorization, validation, tenant scope, stale review, revision history, evidence binding, atomic audit failure (mocked transactions).');
})().catch(e=>{console.error(e);process.exit(1)});

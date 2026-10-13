from pathlib import Path
import hashlib,json,re,shutil,sys,datetime
root=Path(sys.argv[1]);package=Path(__file__).parent;patch=package/'patch'
def digest(p):return hashlib.sha256(p.read_text(encoding='utf-8-sig').replace('\r\n','\n').encode()).hexdigest()
manifest=json.loads((package/'before-hashes.json').read_text())
files=[p for p in patch.rglob('*') if p.is_file()]
for p in files:
 target=root/p.relative_to(patch);rel=str(p.relative_to(patch)).replace('\\','/')
 if target.exists() and digest(target)!=digest(p) and digest(target)!=manifest.get(rel):
  raise SystemExit(f'Local edits detected: {target}. No files changed.')
schema_path=root/'prisma/schema.prisma';schema=schema_path.read_text(encoding='utf-8-sig')
if 'model FlowEscalation {' not in schema:
 for name in ['FlowRecord','FlowReview','ThreatEvent','Incident']:
  pattern=r'(model '+name+r' \{)(.*?)(\n\})'
  if len(re.findall(pattern,schema,re.S))!=1:raise SystemExit(f'Unexpected {name} schema. No files changed.')
  def add(m):
   body=m[2]+'\n  escalations FlowEscalation[]\n'
   if name in ['ThreatEvent','Incident']:body+='  @@unique([id, organizationId])\n'
   if name=='FlowReview':body+='  @@unique([id, flowId, organizationId])\n'
   return m[1]+body+m[3]
  schema=re.sub(pattern,add,schema,flags=re.S)
 schema+='\n'+(package/'escalation-model.prisma').read_text()
backup=Path(r'D:\CAPSTONE\tools\flow-escalation-backups')/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');backup.mkdir(parents=True)
for target in [schema_path]+[root/p.relative_to(patch) for p in files]:
 if target.exists():
  dest=backup/target.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest)
schema_path.write_text(schema,encoding='utf-8')
for p in files:
 dest=root/p.relative_to(patch);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
print(f'Patch installed. Backup: {backup}')

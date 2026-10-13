from pathlib import Path
import hashlib,shutil,sys,datetime
root=Path(sys.argv[1]); package=Path(__file__).parent
page=root/'src/app/(dashboard)/flows/page.tsx'
def digest(p):
 return hashlib.sha256(p.read_text(encoding='utf-8-sig').replace('\r\n','\n').encode()).hexdigest()
new_page=package/'patch/src/app/(dashboard)/flows/page.tsx'
if digest(page) not in {package.joinpath('page-before.sha256').read_text().strip(),digest(new_page)}:
 raise SystemExit('Flow page has local edits. No files changed; send the current flow page for reconciliation.')
schema_path=root/'prisma/schema.prisma';schema=schema_path.read_text(encoding='utf-8-sig')
if 'model FlowReview {' not in schema:
 anchor='  @@unique([organizationId, logSourceId, captureId, zeekUid])'
 if schema.count(anchor)!=1 or schema.count('  shadowAnalysis Json?')!=1:
  raise SystemExit('Unexpected schema. No files changed.')
 schema=schema.replace('  shadowAnalysis Json?','  reviews FlowReview[]\n  shadowAnalysis Json?').replace(anchor,'  @@unique([id, organizationId])\n'+anchor)
 schema+='\n'+package.joinpath('review-model.prisma').read_text()
files=[p for p in (package/'patch').rglob('*') if p.is_file()]
for p in files:
 target=root/p.relative_to(package/'patch')
 if target.exists() and target!=page and target.read_bytes()!=p.read_bytes():
  raise SystemExit(f'Existing file differs: {target}. No files changed.')
backup=Path(r'D:\CAPSTONE\tools\flow-review-backups')/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
backup.mkdir(parents=True)
for target in [schema_path]+[root/p.relative_to(package/'patch') for p in files]:
 if target.exists():
  dest=backup/target.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest)
schema_path.write_text(schema,encoding='utf-8')
for p in files:
 target=root/p.relative_to(package/'patch');target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
print(f'Patch installed. Backup: {backup}')

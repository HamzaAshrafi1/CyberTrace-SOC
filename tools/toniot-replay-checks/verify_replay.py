"""Small authenticated ingestion/retry/storage checks. Never promotes threats."""
import argparse,json,os,sys,urllib.request,urllib.error
from collections import Counter
from pathlib import Path

def post(raw,capture,key,simulated):
 body=json.dumps({'raw_record':raw,'capture_id':capture,'is_simulated':simulated}).encode()
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*a):return None
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
 req=urllib.request.Request('http://127.0.0.1:8000/api/v1/flows/ingest',data=body,headers={'Content-Type':'application/json','Authorization':'Bearer '+key},method='POST')
 with opener.open(req,timeout=15) as response:data=json.load(response)
 if not isinstance(data,dict) or not data.get('id') or not data.get('trace_id'):raise ValueError('Invalid collection response')
 return data

def connect(project):
 sys.path.insert(0,str(project/'python-service'))
 from app.database import get_db_connection
 return get_db_connection()

def counts(conn,key):
 with conn.cursor() as c:
  c.execute('SELECT id, "organizationId" FROM "LogSource" WHERE "apiKey"=%s',(key,));source=c.fetchone()
  if not source:raise ValueError('Invalid source key')
  source_id,org=source
  c.execute('SELECT COUNT(*) FROM "ThreatEvent" WHERE "organizationId"=%s',(org,));threats=c.fetchone()[0]
  c.execute('SELECT COUNT(*) FROM "Incident" WHERE "organizationId"=%s',(org,));incidents=c.fetchone()[0]
 conn.commit()
 return source_id,org,{'threats':threats,'incidents':incidents}

def stored(conn,source,org,capture):
 with conn.cursor() as c:
  c.execute('SELECT id,"traceId","zeekUid","rawHash","rawRecord","shadowAnalysis","isSimulated" FROM "FlowRecord" WHERE "logSourceId"=%s AND "organizationId"=%s AND "captureId"=%s',(source,org,capture))
  rows=c.fetchall()
 conn.commit()
 return {r[2]:{'id':r[0],'trace_id':r[1],'raw_sha256':r[3],'raw_record':r[4],'shadow':r[5],'is_simulated':r[6]} for r in rows}

def verify_capture(conn,source,org,key,capture,records,simulated,outage=False):
 before=stored(conn,source,org,capture);states=Counter();first=[]
 for r in records:
  response=post(r['raw_record'],capture,key,simulated);shadow=response.get('shadow_analysis')
  if not isinstance(shadow,dict):raise ValueError('Missing stored shadow assessment')
  state=shadow.get('status');states[state]+=1
  if outage and (state!='unavailable' or shadow.get('prediction') is not None):raise ValueError('Expected worker-unavailable collection without a prediction')
  if not outage and state not in ('predicted_shadow','rejected'):raise ValueError('Real replay scoring was unavailable; check worker configuration')
  first.append(response)
 after=stored(conn,source,org,capture)
 if len(after)!=len(records):raise ValueError('Unexpected stored capture row count')
 for r,response in zip(records,first):
  saved=after[r['uid']]
  if saved['raw_record']!=r['raw_record'] or saved['raw_sha256']!=r['raw_sha256'] or saved['is_simulated']!=simulated:raise ValueError('Evidence storage differs')
  if saved['id']!=response['id'] or saved['trace_id']!=response['trace_id'] or saved['shadow']!=response['shadow_analysis']:raise ValueError('Stored result differs from response')
  if r['uid'] in before and saved!=before[r['uid']]:raise ValueError('Prior capture row changed')
 # Immediately retry the exact evidence and require every stored assessment to remain unchanged.
 for r in records:
  retry=post(r['raw_record'],capture,key,simulated);saved=after[r['uid']]
  if retry.get('duplicate') is not True or retry['id']!=saved['id'] or retry['trace_id']!=saved['trace_id'] or retry.get('shadow_analysis')!=saved['shadow']:raise ValueError('Retry immutability failed')
 if stored(conn,source,org,capture)!=after:raise ValueError('Stored rows changed during retry')
 return {'records':len(records),'new_rows':len(after)-len(before),'shadow_states':dict(states),'evidence_preserved':True,'retry_immutable':True,'ids':[r['id'] for r in first]}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--project',type=Path,required=True);p.add_argument('--manifest',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--outage',action='store_true');a=p.parse_args()
 key=os.getenv('AEGIS_LOG_SOURCE_KEY','')
 if not key:raise ValueError('Source key not configured')
 conn=connect(a.project)
 try:
  source,org,before=counts(conn,key);reports={}
  if a.outage:
   try:
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:8002/health',timeout=2):pass
   except urllib.error.URLError:pass
   else:raise ValueError('Model worker is still running. Stop only its terminal, then retry.')
   from app.flow_features import normalize_zeek
   raw=(a.project/'python-service'/'fixtures'/'synthetic_conn.jsonl').read_text(encoding='utf-8').splitlines()[0]
   n=normalize_zeek(raw);records=[{'raw_record':raw,'uid':n['zeek_uid'],'raw_sha256':n['raw_sha256']}]
   reports['synthetic-worker-outage-001']=verify_capture(conn,source,org,key,'synthetic-worker-outage-001',records,True,True)
  else:
   if not a.manifest:raise ValueError('Manifest required')
   data=json.loads(a.manifest.read_text(encoding='utf-8'))
   if data.get('mode')!='historical_replay' or data.get('is_simulated') is not False:raise ValueError('Unexpected replay mode')
   for cap,sample in data['captures'].items():reports[cap]=verify_capture(conn,source,org,key,cap,sample['records'],False)
  _,_,after=counts(conn,key)
  if before!=after:raise ValueError('Tenant threat/incident counts changed during the check; investigate concurrent activity before claiming no side effects')
  report={'status':'complete','mode':'worker_outage_check' if a.outage else 'real_historical_replay_check','captures':reports,'tenant_counts_before':before,'tenant_counts_after':after,'no_threat_or_incident_count_increase':True,'limitations':['Integration/storage check only, not new model accuracy evidence.','Normal/scanning predictions remain provisional.']}
  a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,indent=2))
 finally:conn.close()
if __name__=='__main__':
 try:main()
 except Exception as exc:
  print(f'Check failed: {type(exc).__name__}: {exc}',file=sys.stderr);sys.exit(1)

"""Parity checks on original TSV evidence; no training, tuning or service writes."""
import argparse,csv,importlib.util,json,random,time
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
from offline_inference import digest,load_model,infer
from prepare_toniot import records
from flow_features import FEATURE_NAMES
CAPTURES={'normal_10','normal_11','normal_12','normal_scanning5','normal_scanning6'}

def select_rows(path,limit):
 pools=defaultdict(list);seen=Counter();rng={}
 with path.open(encoding='utf-8-sig',newline='') as f:
  for row in csv.DictReader(f):
   cap=row['capture_id']
   if cap not in CAPTURES:continue
   seen[cap]+=1
   if cap not in rng:rng[cap]=random.Random('inference-parity-42:'+cap)
   pool=pools[cap]
   if len(pool)<limit:pool.append(row)
   else:
    j=rng[cap].randrange(seen[cap])
    if j<limit:pool[j]=row
 if set(pools)!=CAPTURES:raise ValueError('Missing primary test capture')
 return pools

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--model-dir',type=Path,required=True);p.add_argument('--prepared',type=Path,required=True);p.add_argument('--backend-features',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--expected-model-sha256');p.add_argument('--per-capture',type=int,default=100);a=p.parse_args()
 if a.per_capture<1:raise ValueError('Sample size must be positive')
 bundle,metrics=load_model(a.model_dir,a.expected_model_sha256)
 if metrics['versions'].get('scikit_learn')!='1.7.2':raise ValueError('Requires reviewed baseline dependency version')
 csvpath=a.prepared/'test_candidates.csv';auditpath=a.prepared/'audit.json'
 for path in (csvpath,auditpath):
  expected=metrics['input_hashes'].get(str(path))
  if expected is None or digest(path)!=expected:raise ValueError('Prepared input hash/path mismatch: '+str(path))
 audit=json.loads(auditpath.read_text(encoding='utf-8'));inputs={v['capture']:v for v in audit['inputs']}
 if audit.get('status')!='complete':raise ValueError('Incomplete prepared audit')
 spec=importlib.util.spec_from_file_location('backend_feature_contract',a.backend_features);backend=importlib.util.module_from_spec(spec);spec.loader.exec_module(backend)
 if list(backend.FEATURE_NAMES)!=list(FEATURE_NAMES) or backend.SCHEMA_VERSION!='zeek-conn-v1':raise ValueError('Backend feature schema differs')
 a.output.mkdir(parents=True,exist_ok=False);started=time.time()
 print('Selecting fixed evidence samples...',flush=True);pools=select_rows(csvpath,a.per_capture)
 report={};base_record=None
 with (a.output/'predictions.jsonl').open('w',encoding='utf-8') as out:
  for cap in sorted(CAPTURES):
   src=Path(inputs[cap]['path'])
   if digest(src)!=inputs[cap]['sha256']:raise ValueError('Original conn.log hash mismatch: '+cap)
   wanted={int(r['source_line']):r for r in pools[cap]};count=Counter()
   print('Checking original evidence: '+cap,flush=True)
   for line,raw,record,t in records(src):
    if line not in wanted:continue
    row=wanted.pop(line)
    if digest_bytes(raw)!=row['source_line_sha256']:raise ValueError('Source line evidence hash mismatch')
    rawjson=json.dumps(record,separators=(',',':'),allow_nan=False)
    actual=backend.normalize_zeek(rawjson);result=infer(rawjson,bundle)
    if result['status']!='predicted_offline':raise ValueError('Eligible sample rejected: '+str(result))
    expected=np.asarray([float(row[n]) if row[n]!='' else np.nan for n in FEATURE_NAMES],dtype=np.float64)
    normalized=np.asarray(actual['feature_vector'],dtype=np.float64)
    adapter=np.asarray(result['feature_vector'],dtype=np.float64)
    np.testing.assert_allclose(normalized,expected,rtol=0,atol=0,equal_nan=True)
    np.testing.assert_allclose(adapter,expected,rtol=0,atol=0,equal_nan=True)
    direct=float(bundle['pipeline'].predict_proba(expected.reshape(1,9))[0,1])
    if abs(direct-result['scanning_score'])>1e-12:raise ValueError('Prediction parity failed')
    if actual['quality_flags']!=result['quality_flags']:raise ValueError('Quality flag parity failed')
    count['checked']+=1;count['predicted:'+result['prediction']]+=1;count['missing_duration']+=record.get('duration') is None
    item={'capture_id':cap,'source_line':line,'source_timestamp':str(t),'source_file_sha256':inputs[cap]['sha256'],
      'source_line_sha256':row['source_line_sha256'],'reference_label':row['label'],'label_provenance':row['label_provenance'],**result}
    out.write(json.dumps(item,allow_nan=False)+'\n')
    if base_record is None:base_record=record.copy()
    if not wanted:break
   if wanted:raise ValueError('Missing source lines in '+cap)
   report[cap]=dict(count)
 tests=[]
 cases=[('missing_duration',{'duration':None},'predicted_offline'),('zero_duration',{'duration':0},'predicted_offline'),
   ('content_gap',{'missed_bytes':1},'rejected'),('missing_packet_count',{'resp_pkts':None},'rejected'),
   ('unsupported_protocol',{'proto':'sctp'},'rejected'),('negative_duration',{'duration':-1},'rejected'),
   ('invalid_ip',{'id.orig_h':'not-an-ip'},'rejected'),('missing_gap_metadata',{'missed_bytes':None},'rejected')]
 for name,changes,expected_status in cases:
  altered={**base_record,**changes};result=infer(json.dumps(altered,allow_nan=False),bundle)
  if result['status']!=expected_status:raise ValueError('Guard case failed: '+name)
  tests.append({'case':name,'expected_status':expected_status,'actual_status':result['status'],'passed':True})
 invalid=infer('{broken',bundle)
 if invalid['status']!='rejected':raise ValueError('Malformed JSON not rejected')
 tests.append({'case':'malformed_json','passed':True})
 final={'status':'complete','mode':'offline_inference_parity_only','model_sha256':metrics['model_sha256'],
   'metrics_sha256':digest(a.model_dir/'metrics.json'),'backend_features_sha256':digest(a.backend_features),
   'sample_per_capture':a.per_capture,'captures':report,'guard_checks':tests,'elapsed_seconds':round(time.time()-started),
   'limitations':['Evidence sample checks parity, not a new accuracy benchmark.','Only missing duration is supported; other missingness is unvalidated.','No predictions stored in dashboard; no model deployed.','Normal predictions do not establish that a flow is safe.']}
 (a.output/'inference_check.json').write_text(json.dumps(final,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(final,indent=2),flush=True)
def digest_bytes(raw):
 import hashlib
 return hashlib.sha256(raw).hexdigest()
if __name__=='__main__':main()

"""Balanced, fixed Random Forest checkpoint. Previously examined holdout; no deployment."""
import argparse,csv,json,random,sqlite3,time,hashlib,platform
from pathlib import Path
from collections import Counter
import numpy as np,joblib,sklearn,scipy
from baseline_common import candidates,register_seen,build_model,metrics,digest,FEATURE_NAMES,NORMAL,TRAIN_SCAN,VAL_SCAN,TEST_SCAN,SEED

LIMITATIONS=[
 'Previously examined validation/test captures: not fresh independent validation.',
 'Normal labels remain provisional capture-level labels.',
 'Nearest-second ground-truth matching was inferred; independent label verification remains incomplete.',
 'Campaign/date/environment similarity can affect performance; exact identity separation is not full independence.',
 'Scope is individual normal-versus-scanning flows, not broad attacks or confirmed malicious intent.',
 'Only missing duration is supported. Unsupported telemetry is outside scoring coverage.',
 'Balanced training and a balanced test diagnostic do not remove label uncertainty or dataset bias.',
 'Fixed threshold 0.5; no calibration, hyperparameter search or test-driven selection.',
 'Offline checkpoint only; model and worker contract have not been changed.'
]

def checked(path,split,counts):
 for r in candidates(path,split,counts):
  missing=[FEATURE_NAMES[i] for i,v in enumerate(r[0]) if np.isnan(v)]
  if set(missing)-{'duration_s'}:raise ValueError('Unsupported missing training/evaluation features: '+str(missing))
  yield r

def sample_balanced(path):
 normal=[];counts=Counter();available=Counter()
 for r in checked(path,'train',counts):
  if r[1]==0:normal.append(r)
  else:available[r[2]]+=1
 if not normal:raise ValueError('No normal training flows')
 if set(available)!=TRAIN_SCAN:raise ValueError('Required training scanning captures missing')
 caps=sorted(TRAIN_SCAN);quotas={cap:len(normal)//len(caps)+(i<len(normal)%len(caps)) for i,cap in enumerate(caps)}
 if any(available[c]<quotas[c] for c in caps):raise ValueError('Insufficient scanning records for balanced sampling')
 pools={cap:[] for cap in caps};rng={cap:random.Random(f'{SEED}:balanced:{cap}') for cap in caps};seen=Counter()
 for r in checked(path,'train',Counter()):
  if r[1]==0:continue
  cap=r[2];seen[cap]+=1;pool=pools[cap];q=quotas[cap]
  if len(pool)<q:pool.append(r)
  else:
   j=rng[cap].randrange(seen[cap])
   if j<q:pool[j]=r
 rows=normal+[r for cap in caps for r in pools[cap]];rows.sort(key=lambda r:(r[2],int(r[3])))
 return rows,{'seed':SEED,'normal_rows_retained':len(normal),'scanning_quotas':quotas,'available_scanning':dict(available),'input_counts':dict(counts)}

def fingerprint(values):
 # Exact numerical feature equality across different identities is diagnostic, not proof of leakage.
 return hashlib.sha256(json.dumps([None if np.isnan(v) else v for v in values],separators=(',',':')).encode()).hexdigest()

def evaluate(model,path,split,db,training_features):
 ys=[];ps=[];caps=[];batch=[];counts=Counter();overlap=Counter()
 def flush():
  register_seen(db,batch,split)
  x=np.asarray([r[0] for r in batch]);p=model.predict_proba(x)[:,1]
  if not np.isfinite(p).all():raise ValueError('Nonfinite scores')
  ys.extend(r[1] for r in batch);ps.extend(map(float,p));caps.extend(r[2] for r in batch)
  for r in batch:
   if fingerprint(r[0]) in training_features:overlap[str(r[1])]+=1
  batch.clear()
 for r in checked(path,split,counts):
  batch.append(r)
  if len(batch)==20000:flush();print(f'{split}: {len(ys):,} flows evaluated',flush=True)
 if batch:flush()
 expected=NORMAL[split]|(VAL_SCAN if split=='validation' else TEST_SCAN)
 if set(caps)!=expected:raise ValueError('Missing evaluation captures')
 y=np.asarray(ys);p=np.asarray(ps);caparr=np.asarray(caps)
 report=metrics(y,p);report['per_capture']={cap:metrics(y[caparr==cap],p[caparr==cap]) for cap in sorted(set(caps))}
 report['input_counts']=dict(counts);report['exact_feature_overlap_with_training_by_label']=dict(overlap)
 if set(np.unique(y))!={0,1}:raise ValueError('Both classes required')
 n=min(np.sum(y==0),np.sum(y==1));gen=np.random.default_rng(SEED)
 idx=np.concatenate([gen.choice(np.flatnonzero(y==label),size=n,replace=False) for label in [0,1]])
 report['balanced_diagnostic']=metrics(y[idx],p[idx]);report['balanced_diagnostic']['purpose']='Equal class subset only; same examined holdout, not independent evidence.'
 return report

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--prepared',type=Path,required=True);ap.add_argument('--baseline',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);ap.add_argument('--jobs',type=int,default=4);a=ap.parse_args()
 if a.jobs<1:raise ValueError('Positive jobs required')
 audit=a.prepared/'audit.json';old=json.loads((a.baseline/'metrics.json').read_text());aud=json.loads(audit.read_text())
 if aud.get('status')!='complete' or aud.get('schema')!='zeek-conn-v1' or old.get('status')!='complete':raise ValueError('Completed preparation/baseline required')
 if old.get('feature_names')!=list(FEATURE_NAMES):raise ValueError('Feature contract changed')
 paths={s:a.prepared/(s+'_candidates.csv') for s in ['train','validation','test']};hashes={}
 for f in [audit,*paths.values()]:
  h=digest(f);known=[v for k,v in old['input_hashes'].items() if k.replace('\\','/').split('/')[-1]==f.name]
  if known!=[h]:raise ValueError('Prepared input changed: '+f.name)
  hashes[f.name]=h
 a.output.mkdir(parents=True,exist_ok=False)
 report={'status':'running','scope':'provisional_normal_vs_scanning_only','evaluation_status':'previously_examined_capture_holdout','limitations':LIMITATIONS,'input_hashes':hashes,'feature_names':list(FEATURE_NAMES),'threshold':0.5,'versions':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'scikit_learn':sklearn.__version__,'joblib':joblib.__version__}}
 def save(): (a.output/'balanced_metrics.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
 save()
 try:
  rows,sampling=sample_balanced(paths['train']);x=np.asarray([r[0] for r in rows]);y=np.asarray([r[1] for r in rows]);report['sampling']=sampling;report['training_counts']={str(k):v for k,v in Counter(map(int,y)).items()}
  if np.sum(y==0)!=np.sum(y==1):raise ValueError('Training is not balanced')
  if np.isnan(x).all(axis=0).any():raise ValueError('All-missing training column')
  with (a.output/'training_sample.csv').open('w',newline='') as f:
   w=csv.writer(f);w.writerow(['capture_id','source_line','identity_sha256','raw_sha256','timestamp','label','label_provenance'])
   for r in rows:w.writerow([r[2],r[3],r[4],r[5],r[6],r[1],r[7]])
  with sqlite3.connect(a.output/'evaluated_identities.sqlite') as db:
   db.execute('CREATE TABLE seen(identity TEXT PRIMARY KEY,split TEXT)');register_seen(db,rows,'train')
   train_features={fingerprint(r[0]) for r in rows};report['training_unique_feature_vectors']=len(train_features)
   model=build_model(200,a.jobs)
   # Equal training counts: no class weights, avoiding a second balancing intervention.
   model.named_steps['classifier'].set_params(class_weight=None)
   print('Balanced training counts:',report['training_counts'],flush=True);start=time.perf_counter();model.fit(x,y);report['fit_seconds']=time.perf_counter()-start
   report['parameters']=model.named_steps['classifier'].get_params();report['training_medians']=model.named_steps['preprocess'].transformer_list[0][1].statistics_.tolist();save()
   report['validation']=evaluate(model,paths['validation'],'validation',db,train_features);save()
   report['test']=evaluate(model,paths['test'],'test',db,train_features)
  artifact=a.output/'balanced_scanning.joblib'
  joblib.dump({'pipeline':model,'feature_names':list(FEATURE_NAMES),'threshold':0.5,'model_contract':'toniot-balanced-scanning-rf-v1','scope':report['scope'],'status':'offline_candidate_not_deployed','versions':report['versions']},artifact,compress=3)
  restored=joblib.load(artifact);np.testing.assert_allclose(restored['pipeline'].predict_proba(x[:100]),model.predict_proba(x[:100]),rtol=0,atol=1e-14)
  report['model_sha256']=digest(artifact);report['training_manifest_sha256']=digest(a.output/'training_sample.csv');report['status']='complete';save()
  lines=['# Balanced scanning experiment','', 'Offline candidate only; previously examined holdout.','',f"Training counts: {report['training_counts']}"]
  for s in ['validation','test']:
   m=report[s];lines.extend(['',s,f"Accuracy: {m['accuracy']:.6f}; macro F1: {m['macro_f1']:.6f}; balanced accuracy: {m['balanced_accuracy']:.6f}",f"Confusion matrix [normal, scanning]: {m['confusion_matrix']}",f"Normal FPR: {m['normal_false_positive_rate']:.6f}; scanning FNR: {m['scanning_false_negative_rate']:.6f}",f"Exact-feature overlap rows: {m['exact_feature_overlap_with_training_by_label']}"])
  lines+=['','## Limitations',*['- '+s for s in LIMITATIONS]];(a.output/'summary.md').write_text('\n'.join(lines)+'\n')
  print(json.dumps({'output':str(a.output),'training_counts':report['training_counts'],'test':{k:report['test'][k] for k in ['accuracy','macro_f1','balanced_accuracy','confusion_matrix','normal_false_positive_rate','scanning_false_negative_rate','exact_feature_overlap_with_training_by_label']},'status':'complete','model_status':'offline_candidate_not_deployed'},indent=2))
 except Exception as e:report['status']='failed';report['error']=str(e);save();raise
if __name__=='__main__':main()

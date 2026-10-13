"""Provisional TON_IoT normal/scanning baseline. Offline; never deploys a model."""
import argparse, csv, hashlib, json, math, platform, random, sqlite3, time
from collections import Counter,defaultdict
from pathlib import Path
import joblib, numpy as np, scipy, sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer,MissingIndicator
from sklearn.pipeline import Pipeline,FeatureUnion
from sklearn.metrics import confusion_matrix,classification_report,accuracy_score,balanced_accuracy_score,f1_score,roc_auc_score,average_precision_score
from flow_features import FEATURE_NAMES

SEED=42
TRAIN_SCAN={'normal_scanning_1','normal_scanning2'}
VAL_SCAN={'normal_scanning3'}
TEST_SCAN={'normal_scanning5','normal_scanning6'}
NORMAL={'train':{'normal_'+str(i) for i in range(1,6)},'validation':{'normal_'+str(i) for i in range(6,10)},'test':{'normal_'+str(i) for i in range(10,13)}}


def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()

def candidates(path,split,counts):
 scans={'train':TRAIN_SCAN,'validation':VAL_SCAN,'test':TEST_SCAN}[split]
 with path.open(encoding='utf-8-sig',newline='') as f:
  reader=csv.DictReader(f)
  required={'capture_id','source_line','source_timestamp','source_line_sha256','flow_identity_sha256','label','label_provenance','quality_flags',*FEATURE_NAMES}
  if not required.issubset(reader.fieldnames or []) or len(reader.fieldnames)!=len(set(reader.fieldnames)):raise ValueError('Missing or duplicate CSV columns: '+str(path))
  for row in reader:
   counts['csv_rows']+=1
   if counts['csv_rows']%250000==0:print(f'  {split}: {counts["csv_rows"]:,} CSV rows read',flush=True)
   cap=row['capture_id']
   if split=='test' and cap=='normal_scanning4':counts['held_aside_scanning4']+=1;continue
   label=int(row['label'])
   if cap in NORMAL[split]:
    if label!=0 or row['label_provenance'] not in ('provisional_normal_capture_label','ground_truth_normal'):raise ValueError('Unexpected normal label/provenance')
   elif cap in scans:
    if label!=1 or row['label_provenance']!='directional_5tuple_nearest_second':raise ValueError('Unexpected scanning label/provenance')
   else:raise ValueError('Unexpected capture in '+split+': '+cap)
   flags=json.loads(row['quality_flags'])
   if not isinstance(flags,list) or any(not isinstance(flag,str) or not flag.startswith('missing:') for flag in flags):raise ValueError('Candidate contains excluded quality flags')
   values=[]
   for name in FEATURE_NAMES:
    text=row[name];v=float(text) if text!='' else float('nan')
    if text!='' and (not math.isfinite(v) or v<0):raise ValueError('Nonfinite or negative feature: '+name)
    if name=='protocol_code' and v not in (1,6,17):raise ValueError('Unsupported protocol')
    values.append(v)
   identity=row['flow_identity_sha256']
   if len(identity)!=64 or any(c not in '0123456789abcdef' for c in identity):raise ValueError('Invalid flow identity hash')
   counts['included_rows']+=1;counts['capture:'+cap]+=1;counts['label:'+str(label)]+=1
   yield (tuple(values),label,cap,row['source_line'],identity,row['source_line_sha256'],row['source_timestamp'],row['label_provenance'])

def sample_training(path,per_capture):
 seen=Counter();pools=defaultdict(list);rngs={};normal=[];counts=Counter()
 for r in candidates(path,'train',counts):
  if r[1]==0:normal.append(r);continue
  cap=r[2];seen[cap]+=1
  if cap not in rngs:rngs[cap]=random.Random(f'{SEED}:{cap}')
  pool=pools[cap]
  if len(pool)<per_capture:pool.append(r)
  else:
   j=rngs[cap].randrange(seen[cap])
   if j<per_capture:pool[j]=r
 if set(pools)!=TRAIN_SCAN:raise ValueError('Missing scanning training capture')
 result=normal+[r for cap in sorted(pools) for r in pools[cap]]
 result.sort(key=lambda r:(r[2],int(r[3])))
 if set(r[1] for r in result)!={0,1}:raise ValueError('Training requires both labels')
 return result,{'read':dict(counts),'sampled_per_capture':dict(Counter(r[2] for r in result)),'seed':SEED,'scanning_limit_per_capture':per_capture}

def register_seen(c,rows,split):
 try:
  c.executemany('INSERT INTO seen VALUES(?,?)',[(r[4],split) for r in rows]);c.commit()
 except sqlite3.IntegrityError as e:raise ValueError('Repeated evaluated/sampled flow identity detected; refusing leakage') from e

def build_model(trees,jobs):
 # Fixed indicators for all nine columns; model input remains the nine raw features.
 preprocess=FeatureUnion([('median',SimpleImputer(strategy='median',keep_empty_features=True)),('missing',MissingIndicator(features='all',error_on_new=False))])
 return Pipeline([('preprocess',preprocess),('classifier',RandomForestClassifier(n_estimators=trees,max_depth=16,min_samples_leaf=5,max_features='sqrt',class_weight='balanced_subsample',random_state=SEED,n_jobs=jobs))])

def metrics(y,p):
 predicted=(p>=0.5).astype(np.int8);cm=confusion_matrix(y,predicted,labels=[0,1]);tn,fp,fn,tp=map(int,cm.ravel())
 result={'rows':int(len(y)),'class_counts':{'normal':int(np.sum(y==0)),'scanning':int(np.sum(y==1))},
  'threshold':0.5,'confusion_matrix_order':['normal','scanning'],'confusion_matrix':cm.tolist(),
  'accuracy':float(accuracy_score(y,predicted)),'balanced_accuracy':float(balanced_accuracy_score(y,predicted)) if len(np.unique(y))==2 else None,
  'macro_f1':float(f1_score(y,predicted,labels=[0,1],average='macro',zero_division=0)),
  'normal_false_positive_rate':fp/(tn+fp) if tn+fp else None,
  'scanning_false_negative_rate':fn/(fn+tp) if fn+tp else None,
  'classification_report':classification_report(y,predicted,labels=[0,1],target_names=['normal','scanning'],output_dict=True,zero_division=0)}
 both=len(np.unique(y))==2
 result['roc_auc']=float(roc_auc_score(y,p)) if both else None
 result['average_precision_scanning']=float(average_precision_score(y,p)) if both else None
 result['average_precision_normal']=float(average_precision_score(1-y,1-p)) if both else None
 result['always_scanning_baseline']={'accuracy':float(np.mean(y==1)),'macro_f1':float(f1_score(y,np.ones_like(y),labels=[0,1],average='macro',zero_division=0)),'normal_false_positive_rate':1.0 if np.any(y==0) else None}
 return result

def evaluate(model,path,split,c,batch_size=20000):
 counts=Counter();ys=[];ps=[];caps=[];batch=[]
 def flush(rows):
  register_seen(c,rows,split)
  x=np.asarray([r[0] for r in rows],dtype=np.float64)
  prob=model.predict_proba(x)[:,1]
  ys.append(np.asarray([r[1] for r in rows],dtype=np.int8));ps.append(prob)
  caps.extend(r[2] for r in rows)
  print(f'  {split}: {sum(len(y) for y in ys):,} predictions evaluated',flush=True)
 for r in candidates(path,split,counts):
  batch.append(r)
  if len(batch)>=batch_size:flush(batch);batch=[]
 if batch:flush(batch)
 if not ys:raise ValueError('No evaluation rows: '+split)
 y=np.concatenate(ys);p=np.concatenate(ps);caps=np.asarray(caps)
 if set(np.unique(y))!={0,1}:raise ValueError('Evaluation requires both classes')
 expected=NORMAL[split]|({'validation':VAL_SCAN,'test':TEST_SCAN}[split])
 if set(caps)!=expected:raise ValueError('Missing evaluation capture')
 report=metrics(y,p);report['input_counts']=dict(counts);report['per_capture']={cap:metrics(y[caps==cap],p[caps==cap]) for cap in sorted(set(caps))}
 return report

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--prepared',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--scan-per-capture',type=int,default=50000);p.add_argument('--trees',type=int,default=200);p.add_argument('--jobs',type=int,default=4);a=p.parse_args()
 if a.scan_per_capture<1 or a.trees<1 or a.jobs<1:raise ValueError('Limits must be positive')
 audit=a.prepared/'audit.json';report=json.loads(audit.read_text(encoding='utf-8'))
 if report.get('status')!='complete' or report.get('schema')!='zeek-conn-v1':raise ValueError('Requires complete stage-2 audit with zeek-conn-v1 schema')
 paths={s:a.prepared/(s+'_candidates.csv') for s in ('train','validation','test')}
 for path in paths.values():
  if not path.is_file():raise FileNotFoundError(path)
 a.output.mkdir(parents=True,exist_ok=False);start=time.time();c=sqlite3.connect(a.output/'evaluated_identities.sqlite');c.execute('CREATE TABLE seen(identity TEXT PRIMARY KEY,split TEXT)')
 try:
  print('Sampling training captures...',flush=True);rows,sampling=sample_training(paths['train'],a.scan_per_capture)
  register_seen(c,rows,'train');x=np.asarray([r[0] for r in rows],dtype=np.float64);y=np.asarray([r[1] for r in rows],dtype=np.int8)
  if np.isnan(x).all(axis=0).any():raise ValueError('A training feature is entirely missing; contract needs review')
  with (a.output/'training_sample.csv').open('w',newline='',encoding='utf-8') as f:
   w=csv.writer(f);w.writerow(['capture_id','source_line','flow_identity_sha256','source_line_sha256','source_timestamp','label','label_provenance'])
   for r in rows:w.writerow([r[2],r[3],r[4],r[5],r[6],r[1],r[7]])
  print('Training counts: '+json.dumps(dict(Counter(map(int,y)))),flush=True)
  model=build_model(a.trees,a.jobs);print('Fitting Random Forest...',flush=True);model.fit(x,y)
  print('Evaluating validation (fixed threshold 0.5; no tuning)...',flush=True);validation=evaluate(model,paths['validation'],'validation',c)
  print('Evaluating primary test (scanning4 held aside)...',flush=True);test=evaluate(model,paths['test'],'test',c)
  bundle={'pipeline':model,'feature_names':list(FEATURE_NAMES),'source_schema':'zeek-conn-v1','model_contract':'toniot-binary-rf-median-missing-v1','classes':{'0':'normal','1':'scanning'},'threshold':0.5,'status':'offline_provisional_not_deployed','classification_scope':'normal_vs_scanning_only',
   'missing_value_policy':'train_median_with_all_feature_indicators','hard_quality_policy':'exclude_non_missing_quality_flags',
   'score_kind':'uncalibrated_random_forest_score','dependency_versions':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'scikit_learn':sklearn.__version__,'joblib':joblib.__version__}}
  model_path=a.output/'baseline.joblib';joblib.dump(bundle,model_path,compress=3)
  # Confirm saved preprocessing and estimator produce the same outputs.
  reloaded=joblib.load(model_path)
  np.testing.assert_allclose(reloaded['pipeline'].predict_proba(x[:100]),model.predict_proba(x[:100]),rtol=0,atol=1e-14)
  report={'status':'complete','model_status':'offline_provisional_not_deployed','feature_names':list(FEATURE_NAMES),'model_contract':bundle['model_contract'],
   'versions':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'scikit_learn':sklearn.__version__,'joblib':joblib.__version__},
   'input_hashes':{str(path):digest(path) for path in [audit,*paths.values()]},'model_sha256':digest(model_path),
   'sampling':sampling,'parameters':model.named_steps['classifier'].get_params(),
   'imputer_training_medians':model.named_steps['preprocess'].transformer_list[0][1].statistics_.tolist(),
   'transformed_feature_names':list(FEATURE_NAMES)+['missing:'+n for n in FEATURE_NAMES],
   'feature_importance':dict(zip(list(FEATURE_NAMES)+['missing:'+n for n in FEATURE_NAMES],map(float,model.named_steps['classifier'].feature_importances_))),
   'validation':validation,'test':test,'elapsed_seconds':round(time.time()-start),
   'limitations':['Normal labels are provisional capture-level assumptions.','The benchmark covers normal versus scanning only.','Normal and scanning were captured on different dates; campaign/date confounding remains.','scanning4 was held aside because label coverage was incomplete before model training.','Random Forest scores are not calibrated probabilities.','Model contract adds train-fitted imputation and missingness indicators; live compatibility is not validated.','Test results are one benchmark observation, not proof of real-world detection.']}
  (a.output/'metrics.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf-8')
  summary={s:{k:report[s][k] for k in ('rows','class_counts','accuracy','macro_f1','normal_false_positive_rate','scanning_false_negative_rate','confusion_matrix','always_scanning_baseline')} for s in ('validation','test')}
  print(json.dumps({'output':str(a.output),'results':summary},indent=2),flush=True)
 finally:c.close()
if __name__=='__main__':main()

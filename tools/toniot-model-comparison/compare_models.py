"""Offline fixed TON_IoT experiment; never selects or deploys a live model."""
import argparse,csv,json,platform,sqlite3,time,warnings
from pathlib import Path
from collections import Counter
import numpy as np,joblib,sklearn,scipy,xgboost
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.exceptions import ConvergenceWarning
from threadpoolctl import threadpool_limits
from baseline_common import (FEATURE_NAMES,SEED,NORMAL,VAL_SCAN,TEST_SCAN,digest,candidates,sample_training,register_seen,build_model,metrics)

NAMES=['Logistic Regression','Decision Tree','Random Forest','Extra Trees','XGBoost']
LIMITATIONS=[
 'Normal labels are provisional capture labels, not individually verified benign flows.',
 'Scope is normal versus scanning only; normal and scanning captures have date/campaign confounding.',
 'Capture-based partitions are reused. The test holdout was previously examined; this is a retrospective comparison, not a fresh untouched benchmark.',
 'normal_scanning4 remains excluded because its ground-truth coverage was incomplete.',
 'Fixed configurations and threshold 0.5; no search, early stopping, calibration or test-driven tuning.',
 'Class imbalance affects accuracy. Inspect macro F1, class precision/recall and false-positive/negative rates.',
 'Timing excludes CSV parsing and metrics, uses CPU batch inference, and is machine-dependent.',
 'No comparison model is deployed. Scores are uncalibrated.'
]

def safe_parameters(value):
 if isinstance(value, dict):return {k:safe_parameters(v) for k,v in value.items()}
 if isinstance(value, (list,tuple)):return [safe_parameters(v) for v in value]
 if isinstance(value,np.generic):value=value.item()
 if isinstance(value,float) and not np.isfinite(value):return str(value)
 return value

def models(y,jobs):
 def prep():return build_model(200,jobs).named_steps['preprocess']
 return [
  (NAMES[0],Pipeline([('preprocess',prep()),('scale',StandardScaler()),('classifier',LogisticRegression(C=1.0,max_iter=3000,class_weight='balanced',random_state=SEED,solver='lbfgs'))])),
  (NAMES[1],Pipeline([('preprocess',prep()),('classifier',DecisionTreeClassifier(max_depth=16,min_samples_leaf=5,class_weight='balanced',random_state=SEED))])),
  (NAMES[2],build_model(200,jobs)),
  (NAMES[3],Pipeline([('preprocess',prep()),('classifier',ExtraTreesClassifier(n_estimators=200,max_depth=16,min_samples_leaf=5,max_features='sqrt',class_weight='balanced',random_state=SEED,n_jobs=jobs))])),
  (NAMES[4],Pipeline([('preprocess',prep()),('classifier',xgboost.XGBClassifier(n_estimators=200,max_depth=6,learning_rate=0.1,subsample=1.0,colsample_bytree=1.0,reg_lambda=1.0,tree_method='hist',device='cpu',objective='binary:logistic',eval_metric='logloss',scale_pos_weight=float(np.sum(y==0)/np.sum(y==1)),random_state=SEED,n_jobs=jobs))]))
 ]

def training_manifest(path,rows):
 with path.open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f);w.writerow(['capture_id','source_line','flow_identity_sha256','source_line_sha256','source_timestamp','label','label_provenance'])
  for r in rows:w.writerow([r[2],r[3],r[4],r[5],r[6],r[1],r[7]])

def load_split(path,split,c,batch_size=20000):
 counts=Counter();xs=[];ys=[];caps=[];batch=[]
 def flush(rows):
  register_seen(c,rows,split)
  xs.append(np.asarray([r[0] for r in rows],dtype=np.float64));ys.append(np.asarray([r[1] for r in rows],dtype=np.int8));caps.extend(r[2] for r in rows)
 for r in candidates(path,split,counts):
  batch.append(r)
  if len(batch)==batch_size:flush(batch);batch=[]
 if batch:flush(batch)
 if not xs:raise ValueError('Empty evaluation split')
 expected=NORMAL[split]|({'validation':VAL_SCAN,'test':TEST_SCAN}[split])
 if set(caps)!=expected:raise ValueError('Capture set differs from audited baseline')
 return np.concatenate(xs),np.concatenate(ys),np.asarray(caps),dict(counts)

def score(model,x,y,caps,counts):
 # Warm-up excludes first-call overhead; each model uses identical batch sizes.
 model.predict_proba(x[:min(100,len(x))])
 start=time.perf_counter();prob=np.concatenate([model.predict_proba(x[i:i+20000])[:,1] for i in range(0,len(x),20000)]);seconds=time.perf_counter()-start
 if not np.isfinite(prob).all() or ((prob<0)|(prob>1)).any():raise ValueError('Invalid probability output')
 r=metrics(y,prob);r['input_counts']=counts;r['per_capture']={str(cap):metrics(y[caps==cap],prob[caps==cap]) for cap in sorted(set(caps))}
 r['inference_seconds']=seconds;r['microseconds_per_flow']=seconds/len(y)*1e6;r['flows_per_second']=len(y)/seconds
 return r

def main():
 p=argparse.ArgumentParser();p.add_argument('--prepared',type=Path,required=True);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--jobs',type=int,default=4);a=p.parse_args()
 if a.jobs<1:raise ValueError('jobs must be positive')
 old=json.loads((a.baseline/'metrics.json').read_text());audit=a.prepared/'audit.json';aud=json.loads(audit.read_text())
 if old.get('status')!='complete' or aud.get('status')!='complete' or aud.get('schema')!='zeek-conn-v1':raise ValueError('Requires complete original audit and baseline')
 if old.get('feature_names')!=list(FEATURE_NAMES) or old['sampling']['scanning_limit_per_capture']!=50000 or old['sampling']['seed']!=SEED:raise ValueError('Unexpected baseline contract/sample')
 paths={s:a.prepared/(s+'_candidates.csv') for s in ('train','validation','test')}
 print('Verifying original input hashes...',flush=True)
 hashes={}
 for path in [audit,*paths.values()]:
  hashes[path.name]=digest(path)
  known=[v for k,v in old['input_hashes'].items() if k.replace('\\','/').split('/')[-1]==path.name]
  if known!=[hashes[path.name]]:raise ValueError('Input changed since baseline: '+path.name)
 a.output.mkdir(parents=True,exist_ok=False)
 report={'status':'running','scope':'provisional_normal_vs_scanning_only','feature_names':list(FEATURE_NAMES),'input_hashes':hashes,'limitations':LIMITATIONS,'versions':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'scikit_learn':sklearn.__version__,'xgboost':xgboost.__version__,'joblib':joblib.__version__},'model_order':NAMES,'jobs':a.jobs,'results':{}}
 output=a.output/'comparison.json'
 def save():output.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf-8')
 save()
 try:
  with sqlite3.connect(a.output/'evaluated_identities.sqlite') as c:
   c.execute('CREATE TABLE seen(identity TEXT PRIMARY KEY,split TEXT)')
   rows,sampling=sample_training(paths['train'],50000);training_manifest(a.output/'training_sample.csv',rows)
   original_sample=a.baseline/'training_sample.csv'
   if digest(a.output/'training_sample.csv')!=digest(original_sample):raise ValueError('Training sample differs from original baseline')
   register_seen(c,rows,'train');x=np.asarray([r[0] for r in rows],dtype=np.float64);y=np.asarray([r[1] for r in rows],dtype=np.int8)
   if np.isnan(x).all(axis=0).any():raise ValueError('Entirely missing training feature')
   report['sampling']=sampling;report['training_sample_sha256']=digest(original_sample);report['training_counts']=dict(Counter(map(int,y)));save()
   validation=load_split(paths['validation'],'validation',c);test=load_split(paths['test'],'test',c)
   del rows
   with threadpool_limits(limits=a.jobs):
    for name,model in models(y,a.jobs):
     print('Fitting '+name+'...',flush=True)
     with warnings.catch_warnings(record=True) as recorded:
      warnings.simplefilter('always');start=time.perf_counter();model.fit(x,y);fit_seconds=time.perf_counter()-start
     warning_text=[str(w.message) for w in recorded];converged=not any(issubclass(w.category,ConvergenceWarning) for w in recorded)
     print('Evaluating '+name+'...',flush=True)
     result={'fit_seconds':fit_seconds,'converged':converged,'fit_warnings':warning_text,'parameters':safe_parameters(model.named_steps['classifier'].get_params()),'validation':score(model,*validation),'test':score(model,*test)}
     artifact=a.output/(name.lower().replace(' ','_')+'.joblib');joblib.dump({'pipeline':model,'feature_names':list(FEATURE_NAMES),'scope':report['scope'],'status':'offline_comparison_not_deployed','threshold':0.5},artifact,compress=3)
     result['model_sha256']=digest(artifact);report['results'][name]=result;save()
     print(json.dumps({'model':name,'test_accuracy':result['test']['accuracy'],'test_macro_f1':result['test']['macro_f1'],'converged':converged}),flush=True)
   with (a.output/'comparison.csv').open('w',newline='',encoding='utf-8') as f:
    fields=['model','split','rows','accuracy','balanced_accuracy','macro_f1','normal_precision','normal_recall','normal_f1','scanning_precision','scanning_recall','scanning_f1','normal_false_positive_rate','scanning_false_negative_rate','roc_auc','average_precision_scanning','fit_seconds','inference_seconds','microseconds_per_flow','converged']
    w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
    for name,r in report['results'].items():
     for split in ['validation','test']:
      m=r[split];row={k:m[k] for k in fields if k in m};row.update(model=name,split=split,fit_seconds=r['fit_seconds'],converged=r['converged'])
      for label in ['normal','scanning']:
       for metric,suffix in [('precision','precision'),('recall','recall'),('f1-score','f1')]:row[label+'_'+suffix]=m['classification_report'][label][metric]
      w.writerow(row)
   report['status']='complete';save();print('Completed comparison: '+str(output),flush=True)
 except Exception as e:
  report['status']='failed';report['error']=str(e);save();raise
if __name__=='__main__':main()

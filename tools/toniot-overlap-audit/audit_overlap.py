import argparse,csv,json,sqlite3,hashlib
from pathlib import Path
from collections import Counter,defaultdict
import numpy as np,joblib
from baseline_common import digest,register_seen,FEATURE_NAMES
from train_balanced import checked,fingerprint
PIN='1a93e4a2751856af9e3e21c99e71f8ec08776eac2bf9f56b678ddf3f24074143'
def summarize(cm):
 tn,fp,fn,tp=map(int,cm);n=tn+fp+fn+tp
 def div(a,b):return a/b if b else None
 nf=div(2*tn,2*tn+fp+fn);sf=div(2*tp,2*tp+fp+fn)
 return {'rows':n,'class_counts':{'normal':tn+fp,'scanning':fn+tp},'confusion_matrix':[[tn,fp],[fn,tp]],'accuracy':div(tn+tp,n),'normal_false_positive_rate':div(fp,tn+fp),'scanning_false_negative_rate':div(fn,fn+tp),'normal_f1':nf,'scanning_f1':sf,'macro_f1':(nf+sf)/2 if tn+fp and fn+tp and nf is not None and sf is not None else None,'balanced_accuracy':(tn/(tn+fp)+tp/(fn+tp))/2 if tn+fp and fn+tp else None}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--prepared',type=Path,required=True);ap.add_argument('--model-dir',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);a=ap.parse_args()
 r=json.loads((a.model_dir/'balanced_metrics.json').read_text());artifact=a.model_dir/'balanced_scanning.joblib'
 if r.get('status')!='complete' or r['model_sha256']!=PIN or digest(artifact)!=PIN:raise ValueError('Unexpected or changed model artifact; refusing deserialization')
 if r['feature_names']!=list(FEATURE_NAMES):raise ValueError('Feature order mismatch')
 manifest=a.model_dir/'training_sample.csv'
 if digest(manifest)!=r['training_manifest_sha256']:raise ValueError('Changed training manifest')
 for name,h in r['input_hashes'].items():
  if digest(a.prepared/name)!=h:raise ValueError('Changed prepared input '+name)
 ids={}
 with manifest.open(newline='') as f:
  for row in csv.DictReader(f):
   k=row['identity_sha256']
   if k in ids:raise ValueError('Duplicate manifest identity')
   ids[k]=int(row['label'])
 train={};selected=[]
 for row in checked(a.prepared/'train_candidates.csv','train',Counter()):
  if row[4] in ids:
   if ids[row[4]]!=row[1]:raise ValueError('Manifest label mismatch')
   train.setdefault(fingerprint(row[0]),set()).add(row[1]);selected.append(row)
 if len(selected)!=len(ids):raise ValueError('Manifest records not reconstructed')
 bundle=joblib.load(artifact);model=bundle['pipeline']
 if bundle['feature_names']!=list(FEATURE_NAMES) or bundle['threshold']!=.5:raise ValueError('Unexpected scoring contract')
 a.output.mkdir(parents=True,exist_ok=False)
 report={'status':'running','model_sha256':PIN,'training_rows':len(selected),'training_unique_feature_vectors':len(train),'training_vectors_with_both_labels':sum(len(v)==2 for v in train.values()),'splits':{},'limitations':['Exact feature equality is not duplicate evidence or proof of leakage.','Non-overlapping exact vectors can still be near duplicates or share campaigns.','This analysis reuses examined captures and does not establish independent accuracy.','Single-class group macro F1 and balanced accuracy are undefined and reported null.','No model retraining or promotion occurs.']}
 out=a.output/'overlap_report.json'
 def save():out.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
 save()
 try:
  with sqlite3.connect(a.output/'identities.sqlite') as db:
   db.execute('CREATE TABLE seen(identity TEXT PRIMARY KEY,split TEXT)');register_seen(db,selected,'train');del selected
   for split in ['validation','test']:
    counts=defaultdict(lambda:[0,0,0,0]);batch=[];opposite=Counter()
    def flush():
     register_seen(db,batch,split);prob=model.predict_proba(np.asarray([x[0] for x in batch]))[:,1]
     for row,p in zip(batch,prob):
      if not np.isfinite(p):raise ValueError('Nonfinite score')
      k=fingerprint(row[0]);g='overlap' if k in train else 'non_overlap';j=row[1]*2+int(p>=.5)
      for group in ['all',g,'capture:'+row[2]+':'+g]:counts[group][j]+=1
      if k in train and row[1] not in train[k]:opposite[str(row[1])]+=1
     batch.clear()
    for row in checked(a.prepared/(split+'_candidates.csv'),split,Counter()):
     batch.append(row)
     if len(batch)==20000:flush();print(split,sum(counts['all']),'evaluated',flush=True)
    if batch:flush()
    actual=summarize(counts['all'])
    if actual['confusion_matrix']!=r[split]['confusion_matrix']:raise ValueError('Original predictions not reproduced')
    report['splits'][split]={'original_confusion_matrix_reproduced':True,'groups':{k:summarize(v) for k,v in counts.items()},'overlap_rows_with_only_opposite_training_label':dict(opposite)};save()
  report['status']='complete';save();print(json.dumps({'output':str(out),'test':{k:v for k,v in report['splits']['test']['groups'].items() if k in ['all','overlap','non_overlap']}},indent=2))
 except Exception as e:report['status']='failed';report['error']=str(e);save();raise
if __name__=='__main__':main()

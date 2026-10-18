import unittest,tempfile,csv,json,hashlib,subprocess,sys
from pathlib import Path
import numpy as np
from train_balanced import sample_balanced,fingerprint
from baseline_common import FEATURE_NAMES,NORMAL,TRAIN_SCAN,VAL_SCAN,TEST_SCAN,digest,build_model

def fixture(root):
 p=root/'prepared';b=root/'baseline';p.mkdir();b.mkdir();audit=p/'audit.json';audit.write_text(json.dumps({'status':'complete','schema':'zeek-conn-v1'}))
 fields=['capture_id','source_line','source_timestamp','source_line_sha256','flow_identity_sha256','label','label_provenance','quality_flags',*FEATURE_NAMES]
 for split,scans in [('train',TRAIN_SCAN),('validation',VAL_SCAN),('test',TEST_SCAN)]:
  with (p/(split+'_candidates.csv')).open('w',newline='') as f:
   w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
   for cap in sorted(NORMAL[split]|scans):
    label=int(cap in scans);n=41 if label else 11
    for i in range(n):
     h=hashlib.sha256(f'{split}:{cap}:{i}'.encode()).hexdigest()
     v=[None if i%7==0 else i*.01,2+label,1,100+100*label,50,3+label,150+100*label,(2+label)/(3+label),6]
     r=dict(zip(FEATURE_NAMES,v));r.update(capture_id=cap,source_line=i+1,source_timestamp=i,source_line_sha256=h,flow_identity_sha256=h,label=label,label_provenance='directional_5tuple_nearest_second' if label else 'provisional_normal_capture_label',quality_flags='["missing:duration"]' if v[0] is None else '[]');w.writerow(r)
 files=[audit,*[p/(s+'_candidates.csv') for s in ['train','validation','test']]]
 (b/'metrics.json').write_text(json.dumps({'status':'complete','feature_names':list(FEATURE_NAMES),'input_hashes':{str(f):digest(f) for f in files}}))
 return p,b
class Tests(unittest.TestCase):
 def test_balance_and_determinism(self):
  with tempfile.TemporaryDirectory() as d:
   p,b=fixture(Path(d));r,s=sample_balanced(p/'train_candidates.csv');r2,s2=sample_balanced(p/'train_candidates.csv')
   self.assertEqual(sum(x[1]==0 for x in r),55);self.assertEqual(sum(x[1]==1 for x in r),55);self.assertEqual([x[4] for x in r],[x[4] for x in r2]);self.assertEqual(sorted(s['scanning_quotas'].values()),[27,28])
 def test_train_only_preprocessing(self):
  x=np.array([[np.nan,2,1,100,50,3,150,.66,6],[2,3,1,200,50,4,250,.75,6],[4,2,1,100,50,3,150,.66,6],[6,3,1,200,50,4,250,.75,6]]*5)
  m=build_model(10,1);m.fit(x,np.array([0,1,0,1]*5));im=m.named_steps['preprocess'].transformer_list[0][1];before=im.statistics_.copy();m.predict_proba(np.full_like(x,1000));np.testing.assert_array_equal(im.statistics_,before)
 def test_full_run_and_hash_refusal(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p,b=fixture(root);out=root/'results';script=Path(__file__).with_name('train_balanced.py')
   args=[sys.executable,str(script),'--prepared',str(p),'--baseline',str(b),'--output',str(out),'--jobs','1']
   r=subprocess.run(args,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
   report=json.loads((out/'balanced_metrics.json').read_text());self.assertEqual(report['status'],'complete');self.assertEqual(report['training_counts'],{'0':55,'1':55})
   for s in ['validation','test']:
    m=report[s];self.assertEqual(sum(map(sum,m['confusion_matrix'])),m['rows']);self.assertEqual(m['balanced_diagnostic']['class_counts']['normal'],m['balanced_diagnostic']['class_counts']['scanning'])
   self.assertGreater(sum(report['test']['exact_feature_overlap_with_training_by_label'].values()),0)
   with (p/'test_candidates.csv').open('a') as f:f.write('\n')
   args[args.index(str(out))]=str(root/'changed');r=subprocess.run(args,capture_output=True,text=True);self.assertNotEqual(r.returncode,0);self.assertFalse((root/'changed').exists())
if __name__=='__main__':unittest.main(verbosity=2)

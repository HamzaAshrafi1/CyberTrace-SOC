import csv,json,sqlite3,tempfile,unittest
from collections import Counter
from pathlib import Path
import numpy as np
from train_baseline import FEATURE_NAMES,build_model,candidates,metrics,register_seen,sample_training
HEADER=['capture_id','source_line','source_timestamp','source_line_sha256','flow_identity_sha256','label','label_provenance',*FEATURE_NAMES,'quality_flags']

def row(cap,i,label,duration=''):
 return [cap,str(i),'1.0','b'*64,f'{i:064x}',str(label),'provisional_normal_capture_label' if label==0 else 'directional_5tuple_nearest_second',duration,1,1,48,48,2,96,0.5,6,'["missing:duration"]' if duration=='' else '[]']

class BaselineTests(unittest.TestCase):
 def test_train_only_preprocessing_and_fixed_indicators(self):
  x=np.asarray([[1,1,1,48,48,2,96,.5,6],[3,2,1,96,48,3,144,2/3,6],[np.nan,4,1,192,48,5,240,.8,6],[5,2,1,96,48,3,144,2/3,6]])
  model=build_model(5,1);model.fit(x,np.array([0,0,1,1]))
  prep=model.named_steps['preprocess'];medians=prep.transformer_list[0][1].statistics_.copy()
  self.assertEqual(medians[0],3)
  eval_x=x.copy();eval_x[0,0]=1000000;eval_x[1,1]=np.nan
  transformed=prep.transform(eval_x)
  self.assertEqual(transformed.shape,(4,18));self.assertEqual(transformed[1,10],1)
  np.testing.assert_array_equal(medians,prep.transformer_list[0][1].statistics_)
 def test_sampling_reproducibility_and_leakage_guard(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'train.csv'
   with p.open('w',newline='') as f:
    w=csv.writer(f);w.writerow(HEADER)
    w.writerow(row('normal_1',1,0))
    for cap,offset in [('normal_scanning_1',100),('normal_scanning2',200)]:
     for i in range(10):w.writerow(row(cap,offset+i,1))
   a,_=sample_training(p,3);b,_=sample_training(p,3)
   self.assertEqual([r[4] for r in a],[r[4] for r in b]);self.assertEqual(len(a),7)
   self.assertEqual(sum(r[1]==0 for r in a),1)
   c=sqlite3.connect(':memory:');c.execute('CREATE TABLE seen(identity TEXT PRIMARY KEY,split TEXT)')
   register_seen(c,a,'train')
   with self.assertRaises(ValueError):register_seen(c,a[:1],'test')
   c.close()
 def test_test_capture_scope_and_missing_zero(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'test.csv'
   with p.open('w',newline='') as f:
    w=csv.writer(f);w.writerow(HEADER);w.writerow(row('normal_scanning4',1,1));w.writerow(row('normal_scanning5',2,1));w.writerow(row('normal_10',3,0,0))
   counts=Counter();r=list(candidates(p,'test',counts))
   self.assertEqual(len(r),2);self.assertTrue(np.isnan(r[0][0][0]));self.assertEqual(r[1][0][0],0)
   self.assertEqual(counts['held_aside_scanning4'],1)
 def test_false_positive_metrics(self):
  m=metrics(np.array([0,0,1,1]),np.array([.6,.1,.9,.2]))
  self.assertEqual(m['confusion_matrix'],[[1,1],[1,1]])
  self.assertEqual(m['normal_false_positive_rate'],.5);self.assertEqual(m['macro_f1'],.5)
if __name__=='__main__':unittest.main()

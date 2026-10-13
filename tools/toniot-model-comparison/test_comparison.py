import unittest,tempfile,csv,json,sqlite3,subprocess,sys
from pathlib import Path
import numpy as np
from compare_models import models,training_manifest,NAMES
from baseline_common import FEATURE_NAMES,metrics,register_seen,sample_training,digest,NORMAL,TRAIN_SCAN,VAL_SCAN,TEST_SCAN

class ComparisonTests(unittest.TestCase):
 def test_metrics_under_imbalance(self):
  r=metrics(np.array([0,0,1,1,1,1]),np.ones(6))
  self.assertEqual(r['normal_false_positive_rate'],1)
  self.assertEqual(r['scanning_false_negative_rate'],0)
  self.assertLess(r['macro_f1'],r['accuracy'])
 def test_identity_leakage_rejected(self):
  with sqlite3.connect(':memory:') as c:
   c.execute('CREATE TABLE seen(identity TEXT PRIMARY KEY,split TEXT)')
   row=((),0,'cap','1','a'*64,'b'*64,'1','normal')
   register_seen(c,[row],'train')
   with self.assertRaises(ValueError):register_seen(c,[row],'test')
 def test_all_models_and_train_only_preprocessing(self):
  x=np.array([[np.nan,1,0,48,0,1,48,1,6],[1,2,1,96,48,3,144,2/3,6],[2,3,2,144,96,5,240,.6,17],[3,4,2,192,96,6,288,2/3,17]]*8)
  y=np.array([0,0,1,1]*8)
  self.assertEqual([n for n,_ in models(y,1)],NAMES)
  for name,m in models(y,1):
   m.fit(x,y);imputer=m.named_steps['preprocess'].transformer_list[0][1]
   med=imputer.statistics_.copy();probe=x.copy();probe[:,0]=100000
   p=m.predict_proba(probe)
   np.testing.assert_array_equal(med,imputer.statistics_)
   self.assertTrue(np.isfinite(p).all(),name)
 def test_complete_experiment_fixture(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);prepared=root/'prepared';base=root/'baseline';out=root/'results';prepared.mkdir();base.mkdir()
   audit=prepared/'audit.json';audit.write_text(json.dumps({'status':'complete','schema':'zeek-conn-v1'}))
   fields=['capture_id','source_line','source_timestamp','source_line_sha256','flow_identity_sha256','label','label_provenance','quality_flags',*FEATURE_NAMES]
   scans={'train':TRAIN_SCAN,'validation':VAL_SCAN,'test':TEST_SCAN}
   for split in scans:
    with (prepared/(split+'_candidates.csv')).open('w',newline='') as f:
     w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
     for cap in sorted(NORMAL[split]|scans[split]):
      label=int(cap in scans[split])
      for i in range(12):
       import hashlib
       identity=hashlib.sha256(f'{split}:{cap}:{i}'.encode()).hexdigest()
       values=[.01+i*.001,2+label,1,100+label*100,50,3+label,150+label*100,(2+label)/(3+label),6]
       row=dict(zip(FEATURE_NAMES,values));row.update(capture_id=cap,source_line=str(i+1),source_timestamp=str(i),source_line_sha256=identity,flow_identity_sha256=identity,label=label,label_provenance='directional_5tuple_nearest_second' if label else 'provisional_normal_capture_label',quality_flags='[]');w.writerow(row)
   rows,sampling=sample_training(prepared/'train_candidates.csv',50000);training_manifest(base/'training_sample.csv',rows)
   files=[audit,*[prepared/(s+'_candidates.csv') for s in scans]]
   (base/'metrics.json').write_text(json.dumps({'status':'complete','feature_names':list(FEATURE_NAMES),'sampling':sampling,'input_hashes':{str(p):digest(p) for p in files}}))
   result=subprocess.run([sys.executable,str(Path(__file__).with_name('compare_models.py')),'--prepared',str(prepared),'--baseline',str(base),'--output',str(out),'--jobs','1'],capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr)
   report=json.loads((out/'comparison.json').read_text());self.assertEqual(report['status'],'complete');self.assertEqual(len(report['results']),5)
   with (out/'comparison.csv').open() as f:self.assertEqual(len(list(csv.DictReader(f))),10)
   self.assertEqual(digest(base/'training_sample.csv'),digest(out/'training_sample.csv'))
if __name__=='__main__':unittest.main(verbosity=2)

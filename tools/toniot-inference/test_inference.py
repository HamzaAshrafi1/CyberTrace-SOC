import csv,json,platform,subprocess,sys,tempfile,unittest
from pathlib import Path
import joblib,numpy as np,scipy,sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer,MissingIndicator
from sklearn.pipeline import Pipeline,FeatureUnion
from offline_inference import CONTRACT,digest,infer,load_model
from flow_features import FEATURE_NAMES,normalize_zeek

BASE={'ts':1.25,'uid':'check-1','id.orig_h':'192.0.2.1','id.orig_p':1000,'id.resp_h':'192.0.2.2','id.resp_p':80,'proto':'tcp','duration':0,'orig_pkts':2,'resp_pkts':1,'orig_ip_bytes':96,'resp_ip_bytes':48,'missed_bytes':0}

def make_model(root):
 model=Pipeline([('preprocess',FeatureUnion([('median',SimpleImputer(strategy='median',keep_empty_features=True)),('missing',MissingIndicator(features='all',error_on_new=False))])),('classifier',RandomForestClassifier(n_estimators=5,max_depth=3,random_state=42,n_jobs=1))])
 x=np.asarray([normalize_zeek(json.dumps({**BASE,'duration':d,'orig_pkts':n,'orig_ip_bytes':n*48}))['feature_vector'] for d,n in [(0,2),(None,2),(1,4),(None,4)]],dtype=np.float64)
 model.fit(x,[0,0,1,1])
 bundle={'pipeline':model,'model_contract':CONTRACT,'source_schema':'zeek-conn-v1','feature_names':list(FEATURE_NAMES),'threshold':.5,'classes':{'0':'normal','1':'scanning'},'status':'offline_provisional_not_deployed'}
 root.mkdir();joblib.dump(bundle,root/'baseline.joblib')
 metrics={'status':'complete','model_status':'offline_provisional_not_deployed','model_contract':CONTRACT,'feature_names':list(FEATURE_NAMES),'model_sha256':digest(root/'baseline.joblib'),'versions':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'scikit_learn':sklearn.__version__,'joblib':joblib.__version__}}
 (root/'metrics.json').write_text(json.dumps(metrics))
 return bundle,metrics

class InferenceTests(unittest.TestCase):
 def test_contract_hash_and_missingness(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)/'model';bundle,metrics=make_model(root);loaded,_=load_model(root)
   with self.assertRaises(ValueError):load_model(root,'0'*64)
   for duration in (None,0):
    result=infer(json.dumps({**BASE,'duration':duration}),loaded)
    self.assertEqual(result['status'],'predicted_offline')
    self.assertEqual(result['feature_valid'],duration is not None)
   for change in ({'resp_pkts':None},{'missed_bytes':1},{'duration':-1},{'proto':'sctp'}):
    self.assertEqual(infer(json.dumps({**BASE,**change}),loaded)['status'],'rejected')
   self.assertEqual(infer('{bad',loaded)['status'],'rejected')
   bad=metrics.copy();bad['feature_names']=list(reversed(FEATURE_NAMES));(root/'metrics.json').write_text(json.dumps(bad))
   with self.assertRaises(ValueError):load_model(root)
   metrics['model_sha256']='0'*64;(root/'metrics.json').write_text(json.dumps(metrics))
   with self.assertRaises(ValueError):load_model(root)
 def test_original_evidence_end_to_end(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);modeldir=root/'model';_,metrics=make_model(modeldir);prepared=root/'prepared';prepared.mkdir();inputs=[]
   header=['capture_id','source_line','source_timestamp','source_line_sha256','flow_identity_sha256','label','label_provenance',*FEATURE_NAMES,'quality_flags']
   with (prepared/'test_candidates.csv').open('w',newline='') as f:
    w=csv.writer(f);w.writerow(header)
    for cap in ['normal_10','normal_11','normal_12','normal_scanning5','normal_scanning6']:
     src=root/(cap+'.log');r={**BASE,'uid':cap,'duration':None if cap=='normal_scanning6' else 0}
     fields=list(r);types=['time','string','addr','port','addr','port','enum','interval','count','count','count','count','count']
     raw=('\t'.join('-' if r[n] is None else str(r[n]) for n in fields)+'\n').encode()
     src.write_bytes(('#separator \\x09\n#fields\t'+'\t'.join(fields)+'\n#types\t'+'\t'.join(types)+'\n').encode()+raw)
     import hashlib
     sha=hashlib.sha256(raw).hexdigest();n=normalize_zeek(json.dumps(r))
     w.writerow([cap,4,r['ts'],sha,'a'*64,int(cap.startswith('normal_scanning')),'synthetic_test_only',*n['feature_vector'],json.dumps(n['quality_flags'])])
     inputs.append({'capture':cap,'path':str(src),'sha256':digest(src)})
   (prepared/'audit.json').write_text(json.dumps({'status':'complete','inputs':inputs}))
   metrics['input_hashes']={str(p):digest(p) for p in [prepared/'audit.json',prepared/'test_candidates.csv']};(modeldir/'metrics.json').write_text(json.dumps(metrics))
   script=Path(__file__).parent/'check_inference.py'
   subprocess.run([sys.executable,str(script),'--model-dir',str(modeldir),'--prepared',str(prepared),'--backend-features',str(script.parent/'flow_features.py'),'--output',str(root/'output'),'--per-capture','1'],check=True,capture_output=True,text=True)
   report=json.loads((root/'output'/'inference_check.json').read_text())
   self.assertEqual(report['status'],'complete');self.assertEqual(sum(c['checked'] for c in report['captures'].values()),5)
   self.assertTrue(all(c['passed'] for c in report['guard_checks']))
if __name__=='__main__':unittest.main()

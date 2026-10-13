import importlib.util,json,os,threading,time,unittest,urllib.error,urllib.request
from pathlib import Path
from unittest.mock import patch
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer,MissingIndicator
from sklearn.pipeline import FeatureUnion,Pipeline
from shadow_worker import make_server,sign
from flow_features import normalize_zeek,FEATURE_NAMES
RAW=json.dumps({'ts':1,'uid':'worker-test','id.orig_h':'192.0.2.1','id.orig_p':1234,'id.resp_h':'192.0.2.2','id.resp_p':80,'proto':'tcp','duration':0,'orig_pkts':1,'resp_pkts':1,'orig_ip_bytes':48,'resp_ip_bytes':48,'missed_bytes':0})
SECRET='worker-unit-'+'x'*40;MODEL='a'*64;CONTRACT='toniot-binary-rf-median-missing-v1'

class WorkerTests(unittest.TestCase):
 def setUp(self):
  x=np.array([normalize_zeek(RAW)['feature_vector']]*4,dtype=float);x[1,0]=np.nan;x[2:,1]=5;x[2:,5]=6
  pipeline=Pipeline([('preprocess',FeatureUnion([('median',SimpleImputer(strategy='median',keep_empty_features=True)),('missing',MissingIndicator(features='all'))])),('classifier',RandomForestClassifier(n_estimators=5,random_state=42,n_jobs=1))]);pipeline.fit(x,[0,0,1,1])
  bundle={'pipeline':pipeline,'model_contract':CONTRACT}
  self.server=make_server(0,bundle,MODEL,SECRET);threading.Thread(target=self.server.serve_forever,daemon=True).start();self.addCleanup(self.server.server_close);self.addCleanup(self.server.shutdown)
  self.url=f'http://127.0.0.1:{self.server.server_port}'
 def request(self,line,nonce='a'*32,bad=False):
  body=json.dumps({'raw_record':line}).encode();timestamp=str(int(time.time()))
  signature='bad' if bad else sign(SECRET,'shadow-request-v1',timestamp,nonce,body)
  return urllib.request.Request(self.url+'/predict',data=body,headers={'Content-Type':'application/json','X-Aegis-ML-Time':timestamp,'X-Aegis-ML-Nonce':nonce,'X-Aegis-ML-Signature':signature},method='POST'),timestamp,nonce
 def test_authentication_and_nonce_replay(self):
  req,ts,nonce=self.request(RAW)
  with urllib.request.urlopen(req) as response:
   body=response.read();self.assertEqual(json.loads(body)['status'],'predicted_shadow');self.assertEqual(response.headers['X-Aegis-ML-Signature'],sign(SECRET,'shadow-response-v1',ts,nonce,body))
  with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(req)
  self.assertEqual(e.exception.code,401)
  bad,_,_=self.request(RAW,'b'*32,True)
  with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(bad)
  self.assertEqual(e.exception.code,401)
 def test_guarded_record(self):
  r=json.loads(RAW);r['missed_bytes']=1;req,_,_=self.request(json.dumps(r))
  with urllib.request.urlopen(req) as response:
   data=json.load(response);self.assertEqual(data['status'],'rejected');self.assertIsNone(data['prediction'])
 def test_actual_backend_client_and_worker_parity(self):
  path=Path(__file__).resolve().parents[1]/'patch/python-service/app/services/ml_shadow.py'
  spec=importlib.util.spec_from_file_location('actual_shadow_client',path);client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
  with patch.dict(os.environ,{'AEGIS_ML_SHADOW_ENABLED':'true','AEGIS_SERVICE_SECRET':SECRET,'AEGIS_ML_MODEL_SHA256':MODEL,'AEGIS_ML_WORKER_URL':self.url}):
   actual=client.assess_shadow(RAW,normalize_zeek(RAW));self.assertEqual(actual['status'],'predicted_shadow');self.assertEqual(actual['model_sha256'],MODEL)
if __name__=='__main__':unittest.main()

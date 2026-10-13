import importlib.util,json,os,sys,threading,types,unittest
from pathlib import Path
from unittest.mock import MagicMock,patch
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from app.flow_features import normalize_zeek
from app.services.ml_shadow import assess_shadow,sign,CONTRACT
RAW=json.dumps({'ts':1,'uid':'shadow-test','id.orig_h':'192.0.2.1','id.orig_p':1234,'id.resp_h':'192.0.2.2','id.resp_p':80,'proto':'tcp','duration':0,'orig_pkts':1,'resp_pkts':1,'orig_ip_bytes':48,'resp_ip_bytes':48,'missed_bytes':0})
SECRET='test-secret-'+'x'*40;MODEL='a'*64
class ShadowClientTests(unittest.TestCase):
 def env(self,url):return {'AEGIS_ML_SHADOW_ENABLED':'true','AEGIS_SERVICE_SECRET':SECRET,'AEGIS_ML_MODEL_SHA256':MODEL,'AEGIS_ML_WORKER_URL':url}
 def server(self,mode='valid'):
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*a):pass
   def do_POST(self):
    body=self.rfile.read(int(self.headers['Content-Length']));ts=self.headers['X-Aegis-ML-Time'];nonce=self.headers['X-Aegis-ML-Nonce']
    if self.headers['X-Aegis-ML-Signature']!=sign(SECRET,'shadow-request-v1',ts,nonce,body):self.send_response(401);self.end_headers();return
    raw=json.loads(body)['raw_record'];data={'status':'predicted_shadow','model_sha256':MODEL,'model_contract':CONTRACT,'raw_sha256':normalize_zeek(raw)['raw_sha256'],'prediction':'scanning','scanning_score':.8}
    if mode=='wrong_model':data['model_sha256']='b'*64
    if mode=='wrong_label':data['prediction']='normal'
    if mode=='nan':data['scanning_score']=float('nan')
    payload=json.dumps(data).encode();self.send_response(200);self.send_header('X-Aegis-ML-Signature','bad' if mode=='bad_signature' else sign(SECRET,'shadow-response-v1',ts,nonce,payload));self.end_headers();self.wfile.write(payload)
  s=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=s.serve_forever,daemon=True).start();self.addCleanup(s.server_close);self.addCleanup(s.shutdown);return f'http://127.0.0.1:{s.server_port}'
 def test_signed_prediction_and_missing_duration(self):
  with patch.dict(os.environ,self.env(self.server())):
   self.assertEqual(assess_shadow(RAW,normalize_zeek(RAW))['status'],'predicted_shadow')
   missing=json.loads(RAW);missing.pop('duration');line=json.dumps(missing);r=assess_shadow(line,normalize_zeek(line));self.assertEqual(r['status'],'predicted_shadow');self.assertFalse(r['feature_valid'])
 def test_failures_have_no_prediction(self):
  for mode in ('wrong_model','wrong_label','nan','bad_signature'):
   with self.subTest(mode=mode),patch.dict(os.environ,self.env(self.server(mode))):
    r=assess_shadow(RAW,normalize_zeek(RAW));self.assertEqual(r['status'],'unavailable');self.assertIsNone(r['prediction'])
 def test_disabled_guard_and_remote_refusal(self):
  with patch.dict(os.environ,{'AEGIS_ML_SHADOW_ENABLED':'false'}):self.assertEqual(assess_shadow(RAW,normalize_zeek(RAW))['status'],'disabled')
  with patch.dict(os.environ,self.env('http://example.com')):
   self.assertEqual(assess_shadow(RAW,normalize_zeek(RAW))['reason'],'worker_url_must_be_loopback')
   r=json.loads(RAW);r['missed_bytes']=1;line=json.dumps(r);self.assertEqual(assess_shadow(line,normalize_zeek(line))['status'],'rejected')
 def test_worker_offline(self):
  with patch.dict(os.environ,self.env('http://127.0.0.1:1')):self.assertEqual(assess_shadow(RAW,normalize_zeek(RAW))['status'],'unavailable')
class ShadowStorageTests(unittest.TestCase):
 def setUp(self):
  db=types.ModuleType('app.database');db.get_db_connection=MagicMock()
  with patch.dict(sys.modules,{'app.database':db}):
   spec=importlib.util.spec_from_file_location('shadow_flow_storage',Path(__file__).parents[1]/'app/services/flow_service.py');self.service=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.service)
  self.conn=MagicMock();self.cur=self.conn.cursor.return_value.__enter__.return_value;self.service.get_db_connection=MagicMock(return_value=self.conn)
  self.service.assess_shadow=MagicMock(return_value={'status':'predicted_shadow','prediction':'scanning','scanning_score':.8})
 def test_auth_before_scoring(self):
  self.cur.fetchone.return_value=None
  with self.assertRaises(self.service.FlowUnauthorized):self.service.ingest_flow(RAW,'capture','bad')
  self.service.assess_shadow.assert_not_called()
 def test_tenant_evidence_and_shadow_only_storage(self):
  self.cur.fetchone.side_effect=[('source','tenant'),None];r=self.service.ingest_flow(RAW,'capture','key');insert=next(c for c in self.cur.execute.call_args_list if 'INSERT INTO "FlowRecord"' in c.args[0])
  self.assertEqual(insert.args[1][1:3],('tenant','source'));self.assertEqual(insert.args[1][7],RAW);self.assertEqual(json.loads(insert.args[1][14])['prediction'],'scanning');self.assertEqual(insert.args[1][-1],'collected');self.assertEqual(r['shadow_analysis']['status'],'predicted_shadow')
  self.assertFalse(any('INSERT INTO "Threat"' in c.args[0] or 'INSERT INTO "Incident"' in c.args[0] for c in self.cur.execute.call_args_list))
 def test_retry_preserves_original_without_rescoring(self):
  original={'status':'unavailable','prediction':None};self.cur.fetchone.side_effect=[('source','tenant'),('id','trace',normalize_zeek(RAW)['raw_sha256'],False,'zeek-conn-v1',original)]
  r=self.service.ingest_flow(RAW,'capture','key');self.assertTrue(r['duplicate']);self.assertEqual(r['shadow_analysis'],original);self.service.assess_shadow.assert_not_called()
 def test_exception_still_stores_flow(self):
  self.cur.fetchone.side_effect=[('source','tenant'),None];self.service.assess_shadow.side_effect=RuntimeError('test failure')
  r=self.service.ingest_flow(RAW,'capture','key');self.assertEqual(r['shadow_analysis']['status'],'unavailable');self.conn.commit.assert_called_once()
if __name__=='__main__':unittest.main()

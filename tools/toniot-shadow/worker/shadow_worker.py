"""Private CPU model worker; bind only to 127.0.0.1. No database or action access."""
import argparse,hmac,json,threading,time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from offline_inference import infer,load_model
import hashlib

def sign(secret,domain,timestamp,nonce,body):
 message=f'{domain}\n{timestamp}\n{nonce}\n{hashlib.sha256(body).hexdigest()}'.encode()
 return hmac.new(secret.encode(),message,hashlib.sha256).hexdigest()

def read_secret(path):
 for line in path.read_text(encoding='utf-8-sig').splitlines():
  name,sep,value=line.partition('=')
  if sep and name.strip()=='AEGIS_SERVICE_SECRET':
   value=value.strip()
   if value.startswith(('"',"'")) and value.endswith(value[0]):value=value[1:-1]
   if len(value)>=32 and 'replace-with' not in value:return value
 raise ValueError('AEGIS_SERVICE_SECRET must be configured in the project .env')

def make_server(port,bundle,model_sha,secret):
 nonce_lock=threading.Lock();nonces=OrderedDict();slots=threading.BoundedSemaphore(4);model_lock=threading.Lock()
 class Handler(BaseHTTPRequestHandler):
  def setup(self):
   super().setup();self.connection.settimeout(5)
  def log_message(self,*args):pass
  def send_json(self,status,data,timestamp=None,nonce=None):
   body=json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
   self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)))
   self.send_header('Cache-Control','no-store')
   if timestamp is not None:self.send_header('X-Aegis-ML-Signature',sign(secret,'shadow-response-v1',timestamp,nonce,body))
   self.end_headers();self.wfile.write(body)
  def do_GET(self):
   if self.path!='/health':self.send_json(404,{'error':'not_found'});return
   self.send_json(200,{'status':'ready','mode':'shadow','model_sha256':model_sha,'model_contract':bundle['model_contract']})
  def do_POST(self):
   if self.path!='/predict':self.send_json(404,{'error':'not_found'});return
   try:
    if self.headers.get('Transfer-Encoding'):raise ValueError()
    size=int(self.headers.get('Content-Length','0'))
    if not 0<size<=262144:raise ValueError()
    body=self.rfile.read(size)
    if len(body)!=size:raise ValueError()
    timestamp=self.headers.get('X-Aegis-ML-Time','');nonce=self.headers.get('X-Aegis-ML-Nonce','');sig=self.headers.get('X-Aegis-ML-Signature','')
    if abs(time.time()-int(timestamp))>30 or len(nonce)!=32 or any(c not in '0123456789abcdef' for c in nonce):raise ValueError()
    if not hmac.compare_digest(sig,sign(secret,'shadow-request-v1',timestamp,nonce,body)):raise ValueError()
    with nonce_lock:
     cutoff=time.time()-60
     while nonces and next(iter(nonces.values()))<cutoff:nonces.popitem(last=False)
     if nonce in nonces or len(nonces)>=4096:raise ValueError()
     nonces[nonce]=time.time()
   except Exception:
    self.send_json(401,{'error':'invalid_worker_request'});return
   if not slots.acquire(blocking=False):self.send_json(503,{'error':'worker_busy'});return
   try:
    payload=json.loads(body)
    if not isinstance(payload,dict) or set(payload)!={'raw_record'} or not isinstance(payload['raw_record'],str):
     self.send_json(422,{'error':'invalid_record'});return
    with model_lock:result=infer(payload['raw_record'],bundle)
    if result['status']=='predicted_offline':result['status']='predicted_shadow'
    result['model_sha256']=model_sha;result['model_contract']=bundle['model_contract']
    self.send_json(200,result,timestamp,nonce)
   except Exception:self.send_json(503,{'error':'scoring_unavailable'})
   finally:slots.release()
 server=ThreadingHTTPServer(('127.0.0.1',port),Handler);server.daemon_threads=True
 return server

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--model-dir',type=Path,required=True);p.add_argument('--project-env',type=Path,required=True);p.add_argument('--port',type=int,default=8002);p.add_argument('--expected-model-sha256',required=True);a=p.parse_args()
 secret=read_secret(a.project_env);bundle,metrics=load_model(a.model_dir,a.expected_model_sha256)
 server=make_server(a.port,bundle,metrics['model_sha256'],secret)
 print(f'Shadow worker ready at http://127.0.0.1:{server.server_port}; model {metrics["model_sha256"][:12]}; no threat/incident actions',flush=True)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
if __name__=='__main__':main()

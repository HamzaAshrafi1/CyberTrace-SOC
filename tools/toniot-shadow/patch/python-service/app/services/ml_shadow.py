"""Optional loopback-only shadow scoring. Storage must survive worker failures."""
import hashlib,hmac,json,math,os,time,uuid
from datetime import datetime,timezone
from urllib import request,parse
CONTRACT='toniot-binary-rf-median-missing-v1'

def sign(secret,domain,timestamp,nonce,body):
 message=f'{domain}\n{timestamp}\n{nonce}\n{hashlib.sha256(body).hexdigest()}'.encode()
 return hmac.new(secret.encode(),message,hashlib.sha256).hexdigest()

def assess_shadow(raw_line,flow):
 assessed=datetime.now(timezone.utc).isoformat()
 expected=os.getenv('AEGIS_ML_MODEL_SHA256','')
 base={'mode':'shadow','scope':'provisional_normal_vs_scanning_only','model_contract':CONTRACT,
       'model_sha256':expected or None,'assessed_at':assessed,'prediction':None,
       'feature_valid':flow['feature_valid'],'quality_flags':flow['quality_flags'],
       'raw_sha256':flow['raw_sha256']}
 def failure(reason):return {**base,'status':'unavailable','reason':reason}
 if os.getenv('AEGIS_ML_SHADOW_ENABLED','false').lower()!='true':
  return {**base,'status':'disabled','reason':'shadow_mode_disabled'}
 if any(flag!='missing:duration' for flag in flow['quality_flags']):
  return {**base,'status':'rejected','reason':'unsupported_quality_or_missingness'}
 secret=os.getenv('AEGIS_SERVICE_SECRET','')
 if len(secret)<32 or 'replace-with' in secret:return failure('worker_auth_not_configured')
 if len(expected)!=64 or any(c not in '0123456789abcdef' for c in expected):return failure('model_hash_not_configured')
 url=os.getenv('AEGIS_ML_WORKER_URL','http://127.0.0.1:8002')
 parsed=parse.urlsplit(url)
 if parsed.scheme!='http' or parsed.hostname!='127.0.0.1' or parsed.username or parsed.password or parsed.path not in ('','/') or parsed.query or parsed.fragment:
  return failure('worker_url_must_be_loopback')
 try:
  body=json.dumps({'raw_record':raw_line},ensure_ascii=False,separators=(',',':')).encode()
  timestamp=str(int(time.time()));nonce=uuid.uuid4().hex
  headers={'Content-Type':'application/json','X-Aegis-ML-Time':timestamp,'X-Aegis-ML-Nonce':nonce,
           'X-Aegis-ML-Signature':sign(secret,'shadow-request-v1',timestamp,nonce,body)}
  class NoRedirect(request.HTTPRedirectHandler):
   def redirect_request(self,*unused):return None
  # Bypass machine HTTP proxies for the private loopback worker.
  opener=request.build_opener(request.ProxyHandler({}),NoRedirect())
  with opener.open(request.Request(url.rstrip('/')+'/predict',data=body,headers=headers,method='POST'),timeout=3) as response:
   payload=response.read(32769)
   signature=response.headers.get('X-Aegis-ML-Signature','')
   if len(payload)>32768 or not hmac.compare_digest(signature,sign(secret,'shadow-response-v1',timestamp,nonce,payload)):
    return failure('worker_response_not_authenticated')
  result=json.loads(payload)
  if not isinstance(result,dict) or result.get('model_sha256')!=expected or result.get('model_contract')!=CONTRACT or result.get('raw_sha256')!=flow['raw_sha256']:
   return failure('worker_response_contract_mismatch')
  if result.get('status')!='predicted_shadow':return failure('worker_did_not_score_eligible_record')
  score=result.get('scanning_score')
  if isinstance(score,bool) or not isinstance(score,(int,float)) or not math.isfinite(score) or not 0<=score<=1:return failure('worker_score_invalid')
  prediction='scanning' if score>=.5 else 'normal'
  if result.get('prediction')!=prediction:return failure('worker_label_mismatch')
  return {**base,'status':'predicted_shadow','prediction':prediction,'scanning_score':score,
          'score_kind':'uncalibrated_random_forest_score','threshold':.5,
          'compatibility':'sample_parity_verified_only'}
 except Exception:
  # No transport/configuration secrets or library errors are exposed or persisted.
  return failure('worker_unavailable')

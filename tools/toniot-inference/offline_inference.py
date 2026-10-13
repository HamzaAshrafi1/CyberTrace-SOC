"""Guarded adapter for the locally trained provisional normal/scanning model."""
import hashlib,json,platform
from pathlib import Path
import joblib,numpy as np,scipy,sklearn
from flow_features import FEATURE_NAMES,normalize_zeek,FlowValidationError
CONTRACT='toniot-binary-rf-median-missing-v1'

def digest(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()

def load_model(model_dir,expected_sha256=None):
 model_dir=Path(model_dir);metrics=json.loads((model_dir/'metrics.json').read_text(encoding='utf-8'))
 if metrics.get('status')!='complete' or metrics.get('model_status')!='offline_provisional_not_deployed':raise ValueError('Unexpected metrics status')
 if metrics.get('model_contract')!=CONTRACT or metrics.get('feature_names')!=list(FEATURE_NAMES):raise ValueError('Model feature contract mismatch')
 versions={'numpy':np.__version__,'scipy':scipy.__version__,'scikit_learn':sklearn.__version__,'joblib':joblib.__version__}
 if any(metrics['versions'].get(k)!=v for k,v in versions.items()):raise ValueError('ML dependency versions differ from training')
 if metrics['versions']['python'].split('.')[:2]!=platform.python_version().split('.')[:2]:raise ValueError('Python major/minor differs from training')
 path=model_dir/'baseline.joblib'
 actual_sha=digest(path)
 if actual_sha!=metrics['model_sha256']:raise ValueError('Saved model hash mismatch')
 if expected_sha256 is not None and actual_sha!=expected_sha256:raise ValueError('Model differs from the reviewed artifact')
 # Load only the user's locally produced artifact after checking its recorded hash.
 bundle=joblib.load(path)
 if bundle.get('model_contract')!=CONTRACT or bundle.get('source_schema')!='zeek-conn-v1' or bundle.get('feature_names')!=list(FEATURE_NAMES):raise ValueError('Serialized model contract mismatch')
 if bundle.get('threshold')!=0.5 or bundle.get('classes')!={'0':'normal','1':'scanning'}:raise ValueError('Unexpected classification mapping')
 if bundle.get('status')!='offline_provisional_not_deployed':raise ValueError('Unexpected model status')
 model=bundle['pipeline']
 if model.n_features_in_!=9 or list(model.classes_)!=[0,1]:raise ValueError('Estimator input/classes mismatch')
 if not np.isfinite(model.named_steps['preprocess'].transformer_list[0][1].statistics_).all():raise ValueError('Nonfinite trained medians')
 return bundle,metrics

def infer(raw,bundle):
 try:normalized=normalize_zeek(raw)
 except (FlowValidationError,ValueError,TypeError) as e:
  return {'status':'rejected','reason':'invalid_record','detail':str(e),'prediction':None}
 flags=normalized['quality_flags']
 # Only duration was missing in the fitted data. Other unseen missingness is unvalidated.
 if any(flag!='missing:duration' for flag in flags):
  return {'status':'rejected','reason':'unsupported_quality_or_missingness','quality_flags':flags,'prediction':None,'raw_sha256':normalized['raw_sha256']}
 vector=np.asarray(normalized['feature_vector'],dtype=np.float64).reshape(1,9)
 score=float(bundle['pipeline'].predict_proba(vector)[0,1])
 if not np.isfinite(score) or not 0<=score<=1:raise ValueError('Invalid model score')
 return {'status':'predicted_offline','prediction':'scanning' if score>=0.5 else 'normal',
   'scanning_score':score,'score_kind':'uncalibrated_random_forest_score','threshold':0.5,
   'quality_flags':flags,'feature_valid':normalized['feature_valid'],'raw_sha256':normalized['raw_sha256'],
   'model_contract':CONTRACT,'scope':'provisional_normal_vs_scanning_only','feature_names':normalized['feature_names'],
   'feature_vector':normalized['feature_vector']}

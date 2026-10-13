"""Prepare historical TON_IoT replay evidence, not a new performance benchmark."""
import argparse,hashlib,json
from pathlib import Path
from prepare_toniot import records,digest
from flow_features import normalize_zeek

def extract(path,capture,limit):
 items=[];seen=set();filehash=digest(path)
 for line,raw,r,t in records(path):
  if r['uid'] in seen:raise ValueError('Duplicate UID in sample')
  if '_aegis_replay_provenance' in r:raise ValueError('Source metadata collision')
  seen.add(r['uid'])
  r['_aegis_replay_provenance']={'dataset':'TON_IoT','mode':'historical_file_replay','source_capture':capture,
   'source_file_sha256':filehash,'source_line':line,'source_line_sha256':hashlib.sha256(raw).hexdigest(),
   'original_timestamp_decimal':str(t),'original_tsv':raw.decode('utf-8')}
  text=json.dumps(r,ensure_ascii=False,separators=(',',':'),allow_nan=False)
  normalized=normalize_zeek(text)
  items.append({'raw_record':text,'uid':r['uid'],'raw_sha256':normalized['raw_sha256'],'source_line':line,
                'source_line_sha256':hashlib.sha256(raw).hexdigest(),'feature_valid':normalized['feature_valid'],
                'quality_flags':normalized['quality_flags']})
  if len(items)==limit:break
 if len(items)!=limit:raise ValueError('Not enough source records')
 return {'source_path':str(path),'source_file_sha256':filehash,'records':items}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--dataset-root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 bro=a.dataset_root/'Raw_datasets'/'network_data'/'Network_dataset_Bro'
 inputs={'toniot-normal13-small-001':bro/'normal_Bro'/'normal_13'/'conn.log',
         'toniot-scanning6-small-001':bro/'normal_attack_Bro'/'normal_scanning'/'normal_scanning6'/'conn.log'}
 result={'mode':'historical_replay','is_simulated':False,'captures':{cap:extract(path,cap,20) for cap,path in inputs.items()}}
 a.output.mkdir(parents=True,exist_ok=True)
 target=a.output/'sample_manifest.json';encoded=json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False)+'\n'
 if target.exists() and target.read_text(encoding='utf-8')!=encoded:raise ValueError('Existing replay evidence differs; refusing overwrite')
 target.write_text(encoded,encoding='utf-8')
 for cap,data in result['captures'].items():
  (a.output/(cap+'.jsonl')).write_text(''.join(r['raw_record']+'\n' for r in data['records']),encoding='utf-8')
 print(json.dumps({'manifest':str(target),'captures':{cap:len(v['records']) for cap,v in result['captures'].items()}},indent=2))
if __name__=='__main__':main()

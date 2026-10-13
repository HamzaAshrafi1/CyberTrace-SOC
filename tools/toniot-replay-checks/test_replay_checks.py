import hashlib,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from prepare_small_replay import extract
from verify_replay import verify_capture
from flow_features import normalize_zeek
class ReplayCheckTests(unittest.TestCase):
 def test_original_timestamp_missingness_and_provenance(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'conn.log'
   fields=['ts','uid','id.orig_h','id.orig_p','id.resp_h','id.resp_p','proto','duration','orig_pkts','resp_pkts','orig_ip_bytes','resp_ip_bytes','missed_bytes']
   types=['time','string','addr','port','addr','port','enum','interval','count','count','count','count','count']
   raw=b'1.123456\tu\t192.0.2.1\t1234\t192.0.2.2\t80\ttcp\t-\t1\t0\t48\t0\t0\n'
   p.write_bytes(('#separator \\x09\n#fields\t'+'\t'.join(fields)+'\n#types\t'+'\t'.join(types)+'\n').encode()+raw)
   sample=extract(p,'capture',1);record=json.loads(sample['records'][0]['raw_record']);prov=record['_aegis_replay_provenance']
   self.assertIsNone(record['duration']);self.assertEqual(prov['original_timestamp_decimal'],'1.123456');self.assertEqual(prov['original_tsv'].encode(),raw)
   self.assertEqual(prov['source_line_sha256'],hashlib.sha256(raw).hexdigest())
   self.assertEqual(normalize_zeek(sample['records'][0]['raw_record'])['quality_flags'],['missing:duration'])
 def test_storage_and_retry_check(self):
  raw='source-json';r={'uid':'u','raw_record':raw,'raw_sha256':hashlib.sha256(raw.encode()).hexdigest()};shadow={'status':'unavailable','prediction':None}
  saved={'u':{'id':'id','trace_id':'trace','raw_record':raw,'raw_sha256':r['raw_sha256'],'shadow':shadow,'is_simulated':True}}
  responses=[{'id':'id','trace_id':'trace','duplicate':False,'shadow_analysis':shadow},{'id':'id','trace_id':'trace','duplicate':True,'shadow_analysis':shadow}]
  with patch('verify_replay.stored',side_effect=[{},saved,saved]),patch('verify_replay.post',side_effect=responses):
   result=verify_capture(None,'source','org','key','cap',[r],True,True)
  self.assertEqual(result['new_rows'],1);self.assertTrue(result['retry_immutable'])
 def test_changed_retry_rejected(self):
  raw='source-json';r={'uid':'u','raw_record':raw,'raw_sha256':hashlib.sha256(raw.encode()).hexdigest()};shadow={'status':'predicted_shadow','prediction':'normal'}
  saved={'u':{'id':'id','trace_id':'trace','raw_record':raw,'raw_sha256':r['raw_sha256'],'shadow':shadow,'is_simulated':False}}
  responses=[{'id':'id','trace_id':'trace','shadow_analysis':shadow},{'id':'id','trace_id':'trace','duplicate':True,'shadow_analysis':{'status':'predicted_shadow','prediction':'scanning'}}]
  with patch('verify_replay.stored',side_effect=[{},saved]),patch('verify_replay.post',side_effect=responses):
   with self.assertRaises(ValueError):verify_capture(None,'source','org','key','cap',[r],False)
if __name__=='__main__':unittest.main()

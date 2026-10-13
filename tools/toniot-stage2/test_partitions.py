import csv,json,sqlite3,tempfile,unittest
from pathlib import Path
from build_partitions import initialize,import_flows,import_ground_truth,export,annotate,QUERY

FIELDS=['ts','uid','id.orig_h','id.orig_p','id.resp_h','id.resp_p','proto','duration','orig_pkts','resp_pkts','orig_ip_bytes','resp_ip_bytes','missed_bytes']
TYPES=['time','string','addr','port','addr','port','enum','interval','count','count','count','count','count']
def write_conn(p, rows):
 p.write_text('#separator \\x09\n#fields\t'+'\t'.join(FIELDS)+'\n#types\t'+'\t'.join(TYPES)+'\n'+''.join('\t'.join(map(str,r))+'\n' for r in rows))
def flow(ts,uid='x',duration='-'):
 return [ts,uid,'192.0.2.1',1,'192.0.2.2',2,'tcp',duration,1,0,48,0,0]

class PartitionTests(unittest.TestCase):
 def test_normal_ground_truth_conflict_and_quality(self):
  r={'category':'normal','gt_type':'scanning','distinct_labels':1,'repeated_identity_rows':None,'hard_quality':0}
  self.assertIn('normal_capture_ground_truth_conflict',annotate(r)[2])
  r.update(gt_type=None,hard_quality=1)
  self.assertIn('non_missing_feature_quality_flag',annotate(r)[2])
  r.update(gt_type='normal',hard_quality=0)
  self.assertEqual(annotate(r),(0,'ground_truth_normal',[]))
 def test_join_missingness_duplicates_and_provisional_normal(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); c=sqlite3.connect(root/'db.sqlite'); initialize(c)
   # Same exact flow in train and validation: exclude both even with different UID.
   selected=[]
   for split,cat,name,rows in [
    ('train','normal','n1',[flow('1.1','a')]),
    ('validation','normal','n2',[flow('1.100','b')]),
    ('test','normal','n3',[flow('2.1')]),
    ('train','scan','s1',[flow('10.6'),flow('11.6'),flow('12.10','u1'),flow('12.11','u2'),flow('14.6'),flow('15.6'),flow('16.6'),flow('17.6','zero',0),flow('18.6')])]:
    p=root/(name+'.log');write_conn(p,rows);selected.append((split,cat,name,p))
   _,windows=import_flows(c,selected)
   gt=root/'gt.csv'
   with gt.open('w',newline='') as f:
    w=csv.writer(f);w.writerow(['ts','src_ip','src_port','dst_ip','dst_port','proto','type'])
    for ts,label in [(11,'scanning'),(12,'scanning'),(12,'scanning'),(12,'dos'),(15,'scanning'),(16,'scanning'),(16,'scanning'),(17,'dos'),(18,'scanning')]:
     w.writerow([ts,'192.0.2.1',1,'192.0.2.2',2,'tcp',label])
   import_ground_truth(c,[gt],windows); stats=export(c,root)
   c.row_factory=sqlite3.Row
   rows=list(c.execute(QUERY))
   train_normal=next(r for r in rows if r['capture']=='n1')
   self.assertIn('cross_split_repeated_flow',annotate(train_normal)[2])
   self.assertEqual(stats['train']['candidate_rows'],3)
   self.assertEqual(stats['test']['provenance:provisional_normal_capture_label'],1)
   scan=[r for r in rows if r['capture']=='s1']
   self.assertEqual(annotate(scan[0]),(1,'directional_5tuple_nearest_second',[]))
   self.assertIsNone(json.loads(scan[0]['features'])[0])
   self.assertIn('conflicting_ground_truth_labels',annotate(scan[1])[2])
   self.assertIn('multiple_flows_share_ground_truth_key',annotate(scan[2])[2])
   self.assertIn('duplicate_ground_truth_key',annotate(scan[5])[2])
   self.assertIn('ground_truth_not_scanning',annotate(scan[6])[2])
   self.assertEqual(json.loads(scan[7]['features'])[0],0)
   self.assertFalse(annotate(scan[7])[2])
   self.assertIn('no_ground_truth_match',annotate(scan[8])[2])
   c.close()
if __name__=='__main__':unittest.main()

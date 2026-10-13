"""Disk-backed TON_IoT binary benchmark preparation; no training or inference."""
import argparse, bisect, csv, hashlib, ipaddress, json, sqlite3, time
from collections import Counter
from pathlib import Path
from decimal import Decimal
from prepare_toniot import records, digest, flow_key
from flow_features import normalize_zeek, FEATURE_NAMES

PLAN = {
 'train': {'normal':['normal_'+str(i) for i in range(1,6)], 'scan':['normal_scanning_1','normal_scanning2']},
 'validation': {'normal':['normal_'+str(i) for i in range(6,10)], 'scan':['normal_scanning3']},
 'test': {'normal':['normal_'+str(i) for i in range(10,13)], 'scan':['normal_scanning4','normal_scanning5','normal_scanning6']}
}

def hash_key(key):
 return hashlib.sha256(json.dumps(key,separators=(',',':')).encode()).hexdigest()

def identity(r,t):
 # Lossless numeric timestamp, direction and tuple; UID excluded because regeneration can change it.
 return hash_key((str(t.normalize()), *flow_key(r,t)[1:]))

def select_inputs(root):
 found={}
 for p in root.rglob('conn.log'):
  name=p.parent.name
  if name in found: raise ValueError('Multiple conn.log files named '+name)
  found[name]=p
 selected=[]
 for split,groups in PLAN.items():
  for category,names in groups.items():
   for name in names:
    if name not in found: raise FileNotFoundError('Required capture missing: '+name)
    selected.append((split,category,name,found[name]))
 return selected

def initialize(c):
 c.executescript('''
 CREATE TABLE flows(id INTEGER PRIMARY KEY,split TEXT,category TEXT,capture TEXT,line INTEGER,
 ts TEXT,keyhash TEXT,identityhash TEXT,raw_sha256 TEXT,features TEXT,quality TEXT,hard_quality INTEGER);
 CREATE TABLE source_files(capture TEXT PRIMARY KEY,path TEXT,sha256 TEXT);
 CREATE TABLE gt(keyhash TEXT,type TEXT,n INTEGER,PRIMARY KEY(keyhash,type));
 CREATE TEMP TABLE gt_batch(keyhash TEXT,type TEXT);
 ''')

def import_flows(c, selected):
 manifest=[]; windows=[]
 sql='INSERT INTO flows(split,category,capture,line,ts,keyhash,identityhash,raw_sha256,features,quality,hard_quality) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
 for split,category,name,path in selected:
  print('Reading '+name,flush=True); batch=[]; lo=hi=None; count=0
  for line,raw,r,t in records(path):
   normalized=normalize_zeek(json.dumps(r,separators=(',',':'),allow_nan=False))
   flags=normalized['quality_flags']
   hard=any(not f.startswith('missing:') for f in flags)
   batch.append((split,category,name,line,str(t),hash_key(flow_key(r,t)),identity(r,t),
     hashlib.sha256(raw).hexdigest(),json.dumps(normalized['feature_vector']),json.dumps(flags),int(hard)))
   sec=flow_key(r,t)[0]; lo=sec if lo is None else min(lo,sec); hi=sec if hi is None else max(hi,sec);count+=1
   if len(batch)>=10000:c.executemany(sql,batch);c.commit();batch=[]
   if count%100000==0:print(f'  {count:,} flows processed',flush=True)
  if batch:c.executemany(sql,batch);c.commit()
  sha=digest(path); c.execute('INSERT INTO source_files VALUES(?,?,?)',(name,str(path),sha));c.commit()
  manifest.append({'capture':name,'split':split,'category':category,'rows':count,'path':str(path),'sha256':sha,'start_second':lo,'end_second':hi})
  if lo is not None:windows.append((lo,hi))
  print(f'  Stored {count:,} flows',flush=True)
 print('Indexing flow keys and identities...',flush=True)
 c.executescript('''CREATE INDEX flow_key_idx ON flows(keyhash);
 CREATE INDEX flow_identity_idx ON flows(identityhash);
 CREATE TABLE flow_keys(keyhash TEXT PRIMARY KEY);
 INSERT INTO flow_keys SELECT DISTINCT keyhash FROM flows;
 CREATE TABLE repeated_identity(identityhash TEXT PRIMARY KEY,cross_split INTEGER,n INTEGER);
 INSERT INTO repeated_identity SELECT identityhash,COUNT(DISTINCT split)>1,COUNT(*) FROM flows GROUP BY identityhash HAVING COUNT(*)>1;
 CREATE TABLE ambiguous_key(capture TEXT,keyhash TEXT,n INTEGER,PRIMARY KEY(capture,keyhash));
 INSERT INTO ambiguous_key SELECT capture,keyhash,COUNT(*) FROM flows GROUP BY capture,keyhash HAVING COUNT(*)>1;
 ''');c.commit()
 merged=[]
 for lo,hi in sorted(windows):
  if merged and lo<=merged[-1][1]+1:merged[-1]=(merged[-1][0],max(hi,merged[-1][1]))
  else:merged.append((lo,hi))
 return manifest,merged

def flush_gt(c,batch):
 if not batch:return
 c.execute('DELETE FROM gt_batch');c.executemany('INSERT INTO gt_batch VALUES(?,?)',batch)
 c.execute('''INSERT INTO gt SELECT b.keyhash,b.type,COUNT(*) FROM gt_batch b
 JOIN flow_keys k ON k.keyhash=b.keyhash GROUP BY b.keyhash,b.type
 HAVING 1 ON CONFLICT(keyhash,type) DO UPDATE SET n=gt.n+excluded.n''')
 c.commit()

def import_ground_truth(c,paths,windows):
 starts=[w[0] for w in windows]; manifest=[]
 for path in paths:
  print('Joining '+path.name,flush=True); batch=[]; rows=in_window=0
  with path.open(encoding='utf-8-sig',newline='') as f:
   reader=csv.DictReader(f)
   if not {'ts','src_ip','src_port','dst_ip','dst_port','proto','type'}.issubset(reader.fieldnames or []):raise ValueError('Bad GT header: '+str(path))
   for r in reader:
    rows+=1
    if rows%250000==0:print(f'  {rows:,} GT rows read',flush=True)
    t=Decimal(r['ts'])
    if not t.is_finite() or t!=t.to_integral_value():raise ValueError('Ground truth timestamp not an integer second')
    sec=int(t);i=bisect.bisect_right(starts,sec)-1
    if i<0 or sec>windows[i][1]:continue
    in_window+=1
    key=(sec,str(ipaddress.ip_address(r['src_ip'])),int(r['src_port']),str(ipaddress.ip_address(r['dst_ip'])),int(r['dst_port']),r['proto'])
    if not r['type']:raise ValueError('Empty GT type')
    batch.append((hash_key(key),r['type']))
    if len(batch)>=10000:flush_gt(c,batch);batch=[]
  flush_gt(c,batch)
  manifest.append({'path':str(path),'sha256':digest(path),'rows':rows,'rows_in_capture_windows':in_window})
  print(f'  Read {rows:,}; {in_window:,} in selected time windows',flush=True)
 c.execute('CREATE TABLE gt_summary AS SELECT keyhash,MIN(type) AS type,COUNT(*) AS distinct_labels,SUM(n) AS n FROM gt GROUP BY keyhash')
 c.execute('CREATE UNIQUE INDEX gt_summary_idx ON gt_summary(keyhash)');c.commit()
 return manifest

QUERY='''SELECT f.*,g.type AS gt_type,g.distinct_labels,g.n AS gt_rows,
 a.n AS shared_key_rows,d.n AS repeated_identity_rows,d.cross_split
 FROM flows f LEFT JOIN gt_summary g ON f.keyhash=g.keyhash
 LEFT JOIN ambiguous_key a ON f.capture=a.capture AND f.keyhash=a.keyhash
 LEFT JOIN repeated_identity d ON f.identityhash=d.identityhash'''

def annotate(row):
 reasons=[];label=None;provenance='unlabelled'
 if row['category']=='scan':
  provenance='directional_5tuple_nearest_second'
  if row['gt_type'] is None:reasons.append('no_ground_truth_match')
  else:
   if row['distinct_labels']!=1:reasons.append('conflicting_ground_truth_labels')
   elif row['gt_type']=='scanning':label=1
   else:reasons.append('ground_truth_not_scanning')
   if row['gt_rows']>1:reasons.append('duplicate_ground_truth_key')
   if row['shared_key_rows']:reasons.append('multiple_flows_share_ground_truth_key')
 else:
  label=0;provenance='provisional_normal_capture_label'
  if row['gt_type'] is not None:
   if row['distinct_labels']!=1 or row['gt_type']!='normal':reasons.append('normal_capture_ground_truth_conflict')
   else:provenance='ground_truth_normal'
 if row['repeated_identity_rows']:reasons.append('cross_split_repeated_flow' if row['cross_split'] else 'within_split_repeated_flow')
 if row['hard_quality']:reasons.append('non_missing_feature_quality_flag')
 return label,provenance,reasons

def export(c,out):
 c.row_factory=sqlite3.Row;counts={s:Counter() for s in PLAN};handles={};writers={}
 header=['capture_id','source_line','source_timestamp','source_line_sha256','flow_identity_sha256','label','label_provenance',*FEATURE_NAMES,'quality_flags']
 try:
  for s in PLAN:
   handles[s]=(out/(s+'_candidates.csv')).open('w',encoding='utf-8',newline='');writers[s]=csv.writer(handles[s]);writers[s].writerow(header)
  for row in c.execute(QUERY):
   count=counts[row['split']];count['input_rows']+=1
   label,provenance,reasons=annotate(row)
   if reasons:
    count['excluded_rows']+=1
    for reason in reasons:count['reason:'+reason]+=1
   else:
    count['candidate_rows']+=1;count['label:'+str(label)]+=1;count['provenance:'+provenance]+=1
    flags=json.loads(row['quality']);count['candidate_missing_features']+=bool(flags)
    writers[row['split']].writerow([row['capture'],row['line'],row['ts'],row['raw_sha256'],row['identityhash'],label,provenance,*json.loads(row['features']),row['quality']])
 finally:
  for h in handles.values():h.close()
 return {s:dict(v) for s,v in counts.items()}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--dataset-root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 selected=select_inputs(a.dataset_root/'Raw_datasets'/'network_data'/'Network_dataset_Bro')
 paths=sorted((a.dataset_root/'SecurityEvents_GroundTruth_datasets'/'SecurityEvents_Network_datasets').glob('*.csv'))
 if not paths:raise FileNotFoundError('No ground-truth CSV files found')
 required={f'GroundTruth_Network_{i}.csv' for i in range(1,19)}
 missing=required-{p.name for p in paths}
 if missing:raise FileNotFoundError('Missing required ground-truth files: '+', '.join(sorted(missing)))
 a.output.mkdir(parents=True,exist_ok=False);started=time.time()
 c=sqlite3.connect(a.output/'audit.sqlite');c.execute('PRAGMA cache_size=-65536');c.execute('PRAGMA temp_store=FILE')
 try:
  initialize(c);manifest,windows=import_flows(c,selected);gt=import_ground_truth(c,paths,windows)
  print('Exporting candidate CSVs...',flush=True);stats=export(c,a.output)
  report={'status':'complete','schema':'zeek-conn-v1','plan':PLAN,'inputs':manifest,'ground_truth':gt,'partitions':stats,
    'elapsed_seconds':round(time.time()-started),
    'limitations':['Normal capture labels remain provisional.','Timestamp rounding inferred from scanning6 sample, not verified for all captures.','Normal and scanning originate from different dates; this is a within-dataset binary benchmark.','Missing features are retained; preprocessing must be fit on training only.','No training or ML verdict performed.','Excluded flows remain available in audit.sqlite.']}
  (a.output/'audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
  print(json.dumps({'output':str(a.output),'partitions':stats},indent=2),flush=True)
 finally:c.close()
if __name__=='__main__':main()

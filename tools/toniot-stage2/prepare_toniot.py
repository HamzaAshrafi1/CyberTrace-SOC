"""Offline TON_IoT audit. Python 3.10+, standard library only; no model training."""
import argparse, csv, hashlib, ipaddress, json
from collections import Counter, defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from flow_features import normalize_zeek

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024), b''): h.update(block)
    return h.hexdigest()

def records(path):
    fields=types=None; sep='\t'; unset='-'; empty='(empty)'
    with path.open('rb') as f:
        for line_no, raw in enumerate(f,1):
            line=raw.decode('utf-8').rstrip('\r\n')
            if line.startswith('#separator '):
                sep=bytes(line.split(' ',1)[1],'ascii').decode('unicode_escape'); continue
            if line.startswith('#'):
                parts=line.split(sep); name=parts[0]
                if name=='#fields': fields=parts[1:]
                elif name=='#types': types=parts[1:]
                elif name=='#unset_field': unset=parts[1]
                elif name=='#empty_field': empty=parts[1]
                continue
            if not line: continue
            if fields is None or types is None or len(fields)!=len(types): raise ValueError('Missing or invalid Zeek header')
            values=line.split(sep)
            if len(values)!=len(fields): raise ValueError(f'{path}:{line_no}: wrong column count')
            r={}
            for name,typ,value in zip(fields,types,values):
                if value==unset: r[name]=None
                elif value==empty: r[name]=[] if typ.startswith(('set[','vector[')) else ''
                elif typ in ('count','port','int'): r[name]=int(value)
                elif typ in ('time','interval','double'): r[name]=float(value)
                elif typ=='bool':
                    if value not in ('T','F'): raise ValueError(f'Invalid bool at line {line_no}')
                    r[name]=value=='T'
                elif typ.startswith(('set[','vector[')): r[name]=value.split(',')
                else: r[name]=value
            # Use the original timestamp token for lossless join precision.
            timestamp=Decimal(values[fields.index('ts')])
            if not timestamp.is_finite() or timestamp<0: raise ValueError('Invalid timestamp')
            yield line_no,raw,r,timestamp

def flow_key(r,t):
    return (int(t.to_integral_value(rounding=ROUND_HALF_UP)),str(ipaddress.ip_address(r['id.orig_h'])),int(r['id.orig_p']),str(ipaddress.ip_address(r['id.resp_h'])),int(r['id.resp_p']),r['proto'])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--scan-conn',type=Path,required=True)
    p.add_argument('--normal-conn',type=Path,required=True)
    p.add_argument('--ground-truth',type=Path,nargs='+',required=True)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    # Refuse overwrite, so previous audits remain reviewable.
    a.output.mkdir(parents=True,exist_ok=False)
    scan_counts=Counter(flow_key(r,t) for _,_,r,t in records(a.scan_conn))
    labels=defaultdict(Counter); origins=defaultdict(set); gt_stats={}
    for path in a.ground_truth:
        c=Counter()
        with path.open(encoding='utf-8-sig',newline='') as f:
            reader=csv.DictReader(f)
            needed={'ts','src_ip','src_port','dst_ip','dst_port','proto','type'}
            if not needed.issubset(reader.fieldnames or []): raise ValueError(f'{path}: missing ground-truth columns')
            for row in reader:
                c['rows']+=1
                t=Decimal(row['ts'])
                if not t.is_finite() or t!=t.to_integral_value(): raise ValueError('Ground truth must have integer-second timestamps')
                key=(int(t),str(ipaddress.ip_address(row['src_ip'])),int(row['src_port']),str(ipaddress.ip_address(row['dst_ip'])),int(row['dst_port']),row['proto'])
                if key in scan_counts:
                    if not row['type']: raise ValueError('Empty ground-truth label')
                    labels[key][row['type']]+=1;origins[key].add(path.name);c['candidate_rows']+=1
        gt_stats[path.name]=dict(c)
    stats={}; manifest=[]
    for capture,path in [('normal_scanning6',a.scan_conn),('normal_13',a.normal_conn)]:
        c=Counter(); source_hash=digest(path)
        manifest.append({'capture_id':capture,'filename':path.name,'sha256':source_hash})
        with (a.output/(capture+'.jsonl')).open('w',encoding='utf-8',newline='\n') as out:
            for line_no,raw,r,t in records(path):
                converted=json.dumps(r,ensure_ascii=False,separators=(',',':'),allow_nan=False)
                normalized=normalize_zeek(converted); key=flow_key(r,t)
                flags=[]; observed=None; eligible=False; provenance='unlabelled'; gt_files=[]
                if capture=='normal_13':
                    observed='normal';provenance='dataset_normal_capture_directory'
                    # Capture-level normal label is provisional pending documentation/contamination review.
                    flags.append('provisional_capture_label')
                elif key in labels:
                    gt_files=sorted(origins[key]);provenance='directional_5tuple_nearest_second'
                    if len(labels[key])>1: flags.append('conflicting_ground_truth_labels')
                    else: observed=next(iter(labels[key]))
                    if sum(labels[key].values())>1: flags.append('duplicate_ground_truth_key')
                    if scan_counts[key]>1: flags.append('multiple_flows_share_ground_truth_key')
                    eligible=observed is not None and not flags
                else: flags.append('no_ground_truth_match')
                item={'capture_id':capture,'source_file_sha256':source_hash,'source_line':line_no,
                      'source_line_sha256':hashlib.sha256(raw).hexdigest(),'source_timestamp':str(t),
                      'raw_zeek_tsv':raw.decode('utf-8'),'zeek_record':r,
                      'normalized':normalized,'observed_label':observed,'label_provenance':provenance,
                      'ground_truth_files':gt_files,'label_flags':flags,'label_eligible':eligible}
                out.write(json.dumps(item,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
                c['rows']+=1;c['feature_valid']+=normalized['feature_valid'];c['label_eligible']+=eligible
                c['observed_label:'+str(observed)]+=1
                for flag in flags:c['label_flag:'+flag]+=1
                for flag in normalized['quality_flags']:c['quality:'+flag]+=1
        stats[capture]=dict(c)
    for path in a.ground_truth:manifest.append({'filename':path.name,'sha256':digest(path)})
    report={'version':'toniot-audit-v1','feature_schema':'zeek-conn-v1','timestamp_join':'nearest_second_decimal_half_up',
            'warning':'Join convention inferred from this sample; capture normal labels provisional. No split, training or verdict generated.',
            'inputs':manifest,'ground_truth':gt_stats,'captures':stats}
    (a.output/'audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(a.output),'captures':stats},indent=2))
if __name__=='__main__': main()

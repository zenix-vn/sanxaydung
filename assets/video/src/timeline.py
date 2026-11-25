import subprocess,json
LEAD=[0.6,1.3,0.7,0.7,0.7,0.7,0.8]; TAIL=[0.6,0.7,0.8,0.8,0.8,0.8,2.4]
t=0;out=[]
for i in range(7):
    d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f'voice/l{i+1}.wav']))
    out.append(dict(start=round(t,3),voice=round(t+LEAD[i],3),vdur=d,end=round(t+LEAD[i]+d+TAIL[i],3))); t=out[-1]['end']
json.dump(out,open('timeline.json','w')); print(json.dumps(out,indent=0)); print('total',t)

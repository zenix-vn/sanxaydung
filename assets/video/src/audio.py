import numpy as np, json, wave, subprocess
SR=44100; T=json.load(open('timeline.json')); total=T[-1]['end']; N=int(total*SR)
rng=np.random.default_rng(7)
L=np.zeros(N+SR*4); R=np.zeros(N+SR*4)
def add(s,t,g=1,pan=0):
    i=int(t*SR)
    if i>=N: return
    s=s[:len(L)-i]
    L[i:i+len(s)]+=s*g*np.sqrt((1-pan)/2); R[i:i+len(s)]+=s*g*np.sqrt((1+pan)/2)
f=lambda m:440*2**((m-69)/12)
def tt(d): return np.arange(int(d*SR))/SR
def pad(ms,d):
    x=tt(d); s=0
    for m in ms:
        for det in(-.06,.06):
            for h,a in((1,1),(2,.3),(3,.12)): s=s+a*np.sin(2*np.pi*f(m+det)*h*x+rng.random()*6)
    e=np.minimum(1,x/.5)*np.minimum(1,(d-x)/.4); return s*e/len(ms)/2
def pluck(m,d=.7):
    x=tt(d); return sum(a*np.sin(2*np.pi*f(m)*h*x)*np.exp(-x*(6+h*3)) for h,a in((1,1),(2,.5),(3,.25),(4,.12)))*np.minimum(1,x/.004)
def bass(m,d):
    x=tt(d); return (np.sin(2*np.pi*f(m)*x)+.35*np.sin(4*np.pi*f(m)*x))*np.minimum(1,x/.01)*np.exp(-x*2.2)*np.minimum(1,(d-x)/.02)
def kick():
    x=tt(.35); return np.sin(2*np.pi*(48*x+ 9*(1-np.exp(-x*28))))*np.exp(-x*10)
def hp(n): return np.diff(n,prepend=0)
def hat():
    x=tt(.07); return hp(rng.normal(size=len(x)))*np.exp(-x*70)
def clap():
    x=tt(.2); return hp(rng.normal(size=len(x)))*np.exp(-x*24)
def whoosh():
    x=tt(.7); n=rng.normal(size=len(x)); n=np.convolve(n,np.ones(14)/14,'same'); return n*np.sin(np.pi*x/.7)**3
BPM=112; b=60/BPM; bar=4*b
CH=[(48,[60,64,67,71]),(55,[59,62,67,74]),(57,[60,64,69,72]),(53,[60,65,69,72])]
K,H,C=kick(),hat(),clap()
t=0;k=0; drop=T[1]['start']; end=T[-1]['end']-1.6
while t<total:
    root,ch=CH[k%4]
    add(pad(ch,bar+.4),t,.16)
    for s in range(8):
        ts=t+s*b/2
        if ts>=drop and ts<end:
            m=ch[[0,2,1,3,2,1,3,2][s]]+12; add(pluck(m),ts,.15,.5 if s%2 else -.5); add(pluck(m,.5),ts+b*.75,.05,-.5 if s%2 else .5)
            add(H,ts+b/4,.10,.2)
            if s%2==0: add(K,ts,.55)
            if s in(2,6): add(C,ts,.13)
            if s in(0,3,6): add(bass(root-12,b*1.1),ts,.34)
    t+=bar;k+=1
for s in T[1:]: add(whoosh(),s['start']-.4,.55)
# chuông kết ở cảnh cuối
for j,m in enumerate([72,76,79,84]): add(pluck(m,1.6),T[-1]['start']+.15+j*.09,.16)
mus=np.stack([L[:N],R[:N]]); mus/=np.abs(mus).max()
x=np.arange(N)/SR
mus*=np.minimum(1,x/.6)*np.clip((total-x)/1.8,0,1)
voice=np.zeros(N); duck=np.ones(N)
for i,s in enumerate(T):
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',f'voice/l{i+1}.wav','-af','highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2','-ar',str(SR),'-ac','1','-f','f32le','-'])
    v=np.frombuffer(raw,dtype=np.float32); a=int(s['voice']*SR); v=v[:N-a]; voice[a:a+len(v)]+=v
    duck[max(0,a-SR//6):a+len(v)+SR//6]=.32
kern=SR//5; duck=np.convolve(duck,np.ones(kern)/kern,'same'); 
voice/=np.abs(voice).max()
def save(fn,d):
    d=np.clip(d,-1,1); w=wave.open(fn,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((d.T*32767).astype('<i2').tobytes()); w.close()
save('mix_voice.wav',(mus*duck*.5+voice*.85)*.92)
save('mix_music.wav',mus*.8)

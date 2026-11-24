import json
s=open('src/template.html').read()
data=open('src/data.json').read().replace('</','<\\/')
import glob
he={}
for f in sorted(glob.glob('src/he/*.txt')):
    for l in open(f, encoding='utf-8'):
        l=l.rstrip('\n')
        if '|' in l:
            i,h=l.split('|',1); he[int(i)]=h.strip()
n=len(json.loads(open('src/data.json').read()))
s=s.replace('/*HE*/', json.dumps([he.get(i) for i in range(n)], ensure_ascii=False).replace('</','<\\/'))
s=s.replace('/*PARSER*/',open('src/parser.js').read()).replace('/*DATA*/',data)
if not s.lstrip().lower().startswith('<!doctype'):
    s=s.replace('<title>Oblath Product Finder</title>\n','',1)
    s='<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Oblath Product Finder</title></head><body>\n'+s+'\n</body></html>\n'
open('site/index.html','w').write(s)

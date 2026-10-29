"""Inspeciona códigos oficiais da folha de mão de obra horista (XLSX)."""
import io,zipfile,xml.etree.ElementTree as ET
from urllib.request import Request,urlopen
host="https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/"
files={"sem":"onerada-sem-des-mobra-horista-julho-2026-1-xlsx"}
ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for regime,f in files.items():
 print('== HORISTAS',regime,f,flush=True)
 req=Request(host+f,headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'})
 try:
  with urlopen(req,timeout=50) as r: contents=r.read(10000000);print('HTTP',r.status,'bytes',len(contents),flush=True)
  z=zipfile.ZipFile(io.BytesIO(contents))
  shared=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   rt=ET.fromstring(z.read('xl/sharedStrings.xml'))
   for si in rt.findall('x:si',ns):shared.append(''.join(t.text or '' for t in si.findall('.//x:t',ns)))
  sheets=[x for x in z.namelist() if x.startswith('xl/worksheets/sheet') and x.endswith('.xml')]
  print('SHEETS',sheets[:12],flush=True)
  for sheet in sheets[:2]:
   rt=ET.fromstring(z.read(sheet))
   for row in rt.findall('.//x:sheetData/x:row',ns)[:35]:
    values=[]
    for c in row.findall('x:c',ns):
     v=c.find('x:v',ns)
     inline=c.find('x:is',ns)
     if v is not None:val=shared[int(v.text)] if c.attrib.get('t')=='s' else v.text
     elif inline is not None:val=''.join(t.text or '' for t in inline.findall('.//x:t',ns))
     else:continue
     if val:values.append(str(c.attrib.get('r'))+'='+str(val)[:90])
    if values:print('ROW',row.attrib.get('r'),' | '.join(values[:12]),flush=True)
 except Exception as e:print('ERROR',type(e).__name__,str(e),flush=True)

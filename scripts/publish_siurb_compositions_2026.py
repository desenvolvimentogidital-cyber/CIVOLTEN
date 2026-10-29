#!/usr/bin/env python3
"""Extrai fichas oficiais das composições SIURB jul/2026.
Mantém mão de obra DIRETA segregada de equipamentos, materiais e auxiliares.
Não publica horas como prazo validado; exige conferência técnica.
"""
import hashlib, io, json, math, xml.etree.ElementTree as ET, zipfile
from pathlib import Path
from urllib.request import Request, urlopen
import xlrd

BASE="https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/"
FILES=[
("Edificações","Sem desoneração","onerada-sem-des-comp-custos-unit-edif-julho-2026-2-xls"),
("Infraestrutura","Sem desoneração","onerada-sem-des-comp-custos-unit-infra-julho-2026-2-xls"),
("Edificações","Com desoneração","desonerada-com-des-comp-custos-unit-edif-jul26-2-xls"),
("Infraestrutura","Com desoneração","desonerada-com-des-comp-custos-unid-infra-jul26-2-xls")
]
LABOR={
"Sem desoneração":["onerada-sem-des-mobra-horista-julho-2026-1-xlsx","onerada-sem-des-mobra-mensalista-julho-2026-1-xlsx"],
"Com desoneração":["desonerada-com-des-mobra-horista-julho-2026-1-xlsx","desonerada-com-des-mobra-mensalista-julho-2026-1-xlsx"]
}
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
OUT=Path('public/data/siurb-compositions-2026-07.json')
def get(filename):
    req=Request(BASE+filename,headers={
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      "Referer":"https://smartsampa.prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179"})
    with urlopen(req,timeout=100) as response: result=response.read(20000000)
    if len(result)<1000:raise ValueError('Download incompleto '+filename)
    return result
def ascode(v):
    if isinstance(v,(float,int)):
        if not math.isfinite(v) or not float(v).is_integer():return ''
        return str(int(v))
    v=str(v or '').strip()
    if v.endswith('.0') and v[:-2].isdigit():v=v[:-2]
    return v if v.isdigit() else ''
def numeric(v):
    try:
        x=float(v) if isinstance(v,(float,int)) else float(str(v).strip().replace(',','.'))
        return x if math.isfinite(x) else None
    except (ValueError,TypeError):return None
def excel_rows(contents):
    workbook=zipfile.ZipFile(io.BytesIO(contents))
    shared=[]
    if 'xl/sharedStrings.xml' in workbook.namelist():
        root=ET.fromstring(workbook.read('xl/sharedStrings.xml'))
        shared=[''.join(t.text or '' for t in si.findall('.//m:t',NS)) for si in root.findall('m:si',NS)]
    sheets=[name for name in workbook.namelist() if name.startswith('xl/worksheets/sheet') and name.endswith('.xml')]
    if not sheets:raise ValueError('Nenhuma aba XLSX')
    root=ET.fromstring(workbook.read(sheets[0]))
    for node in root.findall('.//m:sheetData/m:row',NS):
        cells={}
        for c in node.findall('m:c',NS):
            pos=c.attrib.get('r','')
            col=''.join(x for x in pos if x.isalpha())
            value=c.find('m:v',NS);inline=c.find('m:is',NS)
            if value is not None and value.text is not None:
                val=shared[int(value.text)] if c.attrib.get('t')=='s' else value.text
            elif inline is not None:
                val=''.join(t.text or '' for t in inline.findall('.//m:t',NS))
            else:continue
            cells[col]=val
        yield int(node.attrib['r']),cells
def workforce(regime):
    roles={}
    origins=[]
    for filename in LABOR[regime]:
        blob=get(filename)
        origins.append({'url':BASE+filename,'sha256':hashlib.sha256(blob).hexdigest()})
        lines=list(excel_rows(blob))
        if 'JUL/26' not in ' '.join(str(x) for i,row in lines[:5] for x in row.values()).upper():
            raise ValueError('Data-base incorreta na mão de obra '+filename)
        count=0
        for index,row in lines:
            if index<5:continue
            code=ascode(row.get('A'))
            name=str(row.get('B') or '').strip()
            if not code or not name or len(code)>6:continue
            if code in roles and roles[code]!=name:
                raise ValueError('Nome profissional duplicado inconsistente '+code)
            roles[code]=name;count+=1
        print('Mão de obra',regime,filename,len(roles),'códigos acumulados',flush=True)
        if count<15:raise ValueError('Planilha de mão de obra sem profissionais suficientes')
    return roles,origins
def parse_compositions(raw,cat,regime,labor,official):
    book=xlrd.open_workbook(file_contents=raw,on_demand=True)
    if len(book.sheet_names())!=1:raise ValueError('Número de abas alterado')
    sheet=book.sheet_by_index(0)
    if 'JUL/2026' not in str(sheet.cell_value(1,7)).upper():
        raise ValueError('Composições com data-base inesperada')
    rows=[];current=None
    for i in range(4,sheet.nrows):
        row=sheet.row_values(i)
        code=ascode(row[0])
        if code and str(row[1]).strip() and numeric(row[9]) is not None:
            if current:rows.append(current)
            key=f'{cat}|{regime}|{code}'
            if key not in official:raise ValueError('Composição sem preço na planilha de custos: '+key)
            expected=official[key]
            quoted=round(float(row[9]),2)
            if abs(quoted-expected)>0.02:raise ValueError(f'Preço divergente {key}: {quoted} != {expected}')
            current={'code':code,'category':cat,'regime':regime,'unit':str(row[7]).strip(),
                     'cost':expected,'labor':[],'other':[]}
            continue
        ingredient=ascode(row[2]);name=str(row[3] or '').strip()
        coef=numeric(row[6]);unit=str(row[4] or '').strip()
        if current is None or not ingredient or not name or coef is None or coef<=0:continue
        line={'code':ingredient,'name':name,'unit':unit,'coef':coef}
        if ingredient in labor:
            if unit.upper()!='H':raise ValueError('Profissional com unidade não horária '+ingredient+' '+unit)
            line['group']='mão de obra'
            current['labor'].append(line)
        else:
            line['group']='material/equipamento/auxiliar'
            current['other'].append(line)
    if current:rows.append(current)
    book.release_resources()
    if len(rows)<400:raise ValueError('Número suspeito de composições '+cat+regime)
    for entry in rows:
        entry['direct_hh_per_unit']=round(sum(x['coef'] for x in entry['labor']),6)
        entry['labor_validation']='horas diretas identificadas; complementos auxiliares, operações e produtividade real pendentes'
    return rows
def main():
    base=json.loads(Path('public/data/siurb-2026-07.json').read_text(encoding='utf-8'))
    expected={(r['category']+'|'+r['regime']+'|'+r['code']):r['cost'] for r in base['items']}
    all_records=[];origins=[]
    roles={};labor_origins=[]
    for regime in LABOR:
        roles[regime], sources=workforce(regime)
        labor_origins.extend(sources)
    for category,regime,filename in FILES:
        raw=get(filename)
        records=parse_compositions(raw,category,regime,roles[regime],expected)
        all_records.extend(records)
        print('Composições',category,regime,len(records),flush=True)
        origins.append({'category':category,'regime':regime,'url':BASE+filename,'sha256':hashlib.sha256(raw).hexdigest(),'count':len(records)})
    keys=[x['category']+'|'+x['regime']+'|'+x['code'] for x in all_records]
    if len(set(keys))!=len(keys):raise ValueError('Composições duplicadas')
    if len(all_records)<6500:raise ValueError('Poucas composições extraídas: '+str(len(all_records)))
    OUT.parent.mkdir(parents=True,exist_ok=True)
    data={'meta':{'source':'SIURB São Paulo','reference_month':'2026-07','count':len(all_records),
      'validation':'Apenas composição direta. Não representa prazo certificado nem considera insumos auxiliares recursivos e equipamentos em horas.',
      'origins':origins,'labor_sources':labor_origins},'items':all_records}
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print('RESULTADO',len(all_records),'composições;',OUT.stat().st_size,'bytes',flush=True)
if __name__=='__main__':main()

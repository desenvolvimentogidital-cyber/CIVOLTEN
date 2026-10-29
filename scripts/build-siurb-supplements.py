#!/usr/bin/env python3
"""Normaliza custos SIURB de planilhas públicas auditadas. NÃO importa para o banco.

Requer os 8 arquivos e o manifesto SHA-256 obtidos por audit-siurb-supplements.py.
Lê XLSX sem dependências externas; XLS usa xlrd==2.0.2 já fixado em CI.
Mantém separado: profissionais (com encargos), equipamentos em operação/à
disposição, insumos e fichas auxiliares. Não estima tributos, lucro ou duração.
"""
import argparse
from collections import Counter
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import re
import zipfile
from xml.etree import ElementTree as ET

NS={"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
CELL_RE=re.compile(r"^([A-Z]+)")
CODE_RE=re.compile(r"^\\d{3,9}$")
MAX_ITEMS=20000

def scalar(value):
    if value is None:return ""
    return str(value).strip()

def number(value,places=2,allow_zero=False):
    v=scalar(value)
    if not v or v==".":return None
    try:
        x=Decimal(v.replace(",","."))
        if not x.is_finite() or x<0 or (x==0 and not allow_zero):return None
        if x>Decimal("100000000"):raise ValueError("Preço além do limite")
        return format(x.quantize(Decimal(10)**-places,rounding=ROUND_HALF_UP),"f")
    except InvalidOperation:return None

def code(value):
    v=scalar(value)
    if not v:return None
    try:
        n=Decimal(v)
        if n.is_finite() and n==n.to_integral_value():
            v=str(int(n))
    except InvalidOperation:pass
    return v if CODE_RE.fullmatch(v) else None

def colidx(ref):
    match=CELL_RE.match(ref)
    if not match:raise ValueError("Referência de célula inválida")
    idx=0
    for ch in match.group(1):idx=idx*26+ord(ch)-64
    return idx-1

def read_xlsx(path):
    with zipfile.ZipFile(path) as book:
        names=set(book.namelist())
        if "xl/worksheets/sheet1.xml" not in names:raise ValueError("Aba principal não encontrada")
        shared=[]
        if "xl/sharedStrings.xml" in names:
            root=ET.fromstring(book.read("xl/sharedStrings.xml"))
            shared=["".join(si.itertext()) for si in root.findall("m:si",NS)]
        with book.open("xl/worksheets/sheet1.xml") as stream:
            for _,row in ET.iterparse(stream,events=("end",)):
                if row.tag!="{"+NS["m"]+"}row":continue
                fields=[""]*max(12,len(row))
                for cell in row.findall("m:c",NS):
                    index=colidx(cell.attrib.get("r",""))
                    if index>50:raise ValueError("Planilha com colunas inesperadas")
                    if index>=len(fields):fields.extend([""]*(index+1-len(fields)))
                    val=cell.find("m:v",NS)
                    raw=val.text if val is not None else ""
                    if cell.attrib.get("t")=="s" and raw:
                        raw=shared[int(raw)]
                    elif cell.attrib.get("t")=="inlineStr":
                        raw="".join(cell.itertext())
                    fields[index]=scalar(raw)
                yield fields
                row.clear()

def read_xls(path):
    import xlrd
    book=xlrd.open_workbook(path,on_demand=True)
    try:
        if len(book.sheet_names())!=1:raise ValueError("Esperava uma aba auxiliar")
        sh=book.sheet_by_index(0)
        for i in range(sh.nrows):
            yield [scalar(v) for v in sh.row_values(i)]
    finally:
        book.release_resources()

def field(row,i):
    return scalar(row[i]) if len(row)>i else ""

def item(code_,description,unit,price,kind,regime,sha,variant="padrao"):
    if not code_ or not description or not unit or price is None:return None
    return {"code":code_,"description":description,"unit":unit,
            "unit_cost":price,"kind":kind,"variant":variant,
            "regime":regime,"reference_month":"2026-07","source_sha256":sha}

def parse_one(path,kind,regime,sha):
    rows=read_xls(path) if path.suffix==".xls" else read_xlsx(path)
    entries=[];aux=[];seen=set();group=None
    header=3 if kind in ("horista","equipamentos") else 2
    for idx,row in enumerate(rows):
        if idx<=header:continue
        c=code(field(row,0));description=field(row,1)
        if kind=="insumos":
            current=item(c,description,field(row,2),number(field(row,3)),kind,regime,sha)
            if current:entries.append(current)
        elif kind in ("horista","equipamentos"):
            if not c or not description:continue
            for variant,slot in ([("sem_encargos",2),("com_encargos",3)] if kind=="horista" else [("operacao",2),("disponibilidade",3)]):
                current=item(c,description,"H",number(field(row,slot)),kind,regime,sha,variant)
                if current:entries.append(current)
        elif kind=="auxiliares":
            # Colunas oficiais: A código, B nome, H unidade, J total.
            total=number(field(row,9))
            if c and description and field(row,7) and total is not None:
                group={"code":c,"description":description,"unit":field(row,7),
                       "official_unit_cost":total,"regime":regime,
                       "reference_month":"2026-07","source_sha256":sha,"components":[]}
                aux.append(group)
            # Componente: C código, D descrição, E unidade, F preço, G coef., I parcial.
            child_code=code(field(row,2))
            if child_code and group is not None and field(row,3):
                component={"code":child_code,"description":field(row,3),
                           "unit":field(row,4),"unit_cost":number(field(row,5)),
                           "coefficient":number(field(row,6),8),
                           "partial_cost":number(field(row,8),2,allow_zero=True)}
                group["components"].append(component)
        else:raise ValueError("Categoria não permitida")
        if len(entries)+len(aux)>MAX_ITEMS:raise ValueError("Planilha além do limite esperado")
    if kind=="auxiliares":
        for record in aux:
            key=record["code"]
            if key in seen:raise ValueError("Composição auxiliar duplicada: "+key)
            seen.add(key)
            subtotal=Decimal(0)
            complete=bool(record["components"])
            for part in record["components"]:
                if part["unit_cost"] is None or part["coefficient"] is None or not part["unit"]:
                    complete=False
                if part["partial_cost"] is not None:subtotal+=Decimal(part["partial_cost"])
                else:complete=False
            record["sum_official_partials"]=format(subtotal.quantize(Decimal(".01")),"f")
            record["difference_to_official"]=format(Decimal(record["official_unit_cost"])-subtotal,"f")
            record["arithmetically_reconciled"]=bool(complete and abs(subtotal-Decimal(record["official_unit_cost"]))<=Decimal(".02"))
            record["commercially_approved"]=False
        return entries,aux
    for rec in entries:
        key=(rec["code"],rec["variant"])
        if key in seen:raise ValueError("Preço duplicado no mesmo regime: "+str(key))
        seen.add(key)
    return entries,aux

def build(base,manifest):
    source=json.loads(manifest.read_text(encoding="utf-8"))
    if not source.get("all_files_verified") or len(source["files"])!=8:
        raise ValueError("A auditoria completa dos oito arquivos é obrigatória")
    entries=[];auxiliaries=[];source_hashes=[]
    for file in source["files"]:
        regime=file["regime"];kind=file["kind"]
        extension="xls" if kind=="auxiliares" else "xlsx"
        path=base/f"{regime}-{kind}.{extension}"
        if not path.is_file():raise ValueError("Fonte ausente: "+str(path))
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if digest!=file["sha256"]:raise ValueError("SHA-256 divergente: "+str(path))
        parsed,aux=parse_one(path,kind,regime,digest)
        if len(parsed)<30 and kind!="auxiliares":raise ValueError("Poucos itens: "+kind+"/"+regime)
        if kind=="auxiliares" and len(aux)<10:raise ValueError("Poucas auxiliares: "+regime)
        entries.extend(parsed);auxiliaries.extend(aux)
        source_hashes.append({"kind":kind,"regime":regime,"sha256":digest,"url":file["url"],
                              "price_rows":len(parsed),"auxiliary_rows":len(aux)})
    return {"reference_month":"2026-07","source_page":source["source_page"],
            "sources":source_hashes,"prices":entries,"auxiliaries":auxiliaries,
            "counts":{"prices":len(entries),"auxiliaries":len(auxiliaries),
                "auxiliaries_reconciled":sum(1 for a in auxiliaries if a["arithmetically_reconciled"])},
            "commercial_release":False,"note":"Reconciliação aritmética não substitui revisão técnica, tributária e comercial."}

if __name__=="__main__":
    cli=argparse.ArgumentParser()
    cli.add_argument("--sources-dir",default="artifacts/siurb-source-files")
    cli.add_argument("--manifest",default="artifacts/siurb-supplements-audit.json")
    cli.add_argument("--output",default="artifacts/siurb-supplements-normalized.json")
    args=cli.parse_args()
    result=build(Path(args.sources_dir),Path(args.manifest))
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("SIURB suplementos normalizados:",json.dumps(result["counts"]))
    for x in result["sources"]:print(x["regime"],x["kind"],x["price_rows"],x["auxiliary_rows"])
    print("Aviso: sem autorização comercial automática")

#!/usr/bin/env python3
"""Importa custos unitários oficiais SIURB jul/2026, preservando proveniência.
O arquivo de custos NÃO fornece h-h/unidade; produtividade permanece sem validação.
Dependência de CI: xlrd==2.0.2.
"""
import hashlib
import json
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import xlrd

HOST = "https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/"
TABLES = [
 ("Edificações","Sem desoneração","onerada-sem-des-custos-unit-edif-julho-2026-2-xls"),
 ("Infraestrutura","Sem desoneração","onerada-sem-des-custos-unit-infra-julho-2026-2-xls"),
 ("Edificações","Com desoneração","desonerada-com-des-custos-unit-edif-julho-2026-2-xls"),
 ("Infraestrutura","Com desoneração","desonerada-com-des-custos-unid-infra-julho-2026-2-xls"),
]
OFFICIAL = "https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179"
OUT = Path("public/data/siurb-2026-07.json")

def codigo(value):
    if isinstance(value,(float,int)):
        if not math.isfinite(value) or not float(value).is_integer():return None
        return str(int(value))
    s=str(value or "").strip()
    if s.endswith(".0") and s[:-2].isdigit():s=s[:-2]
    return s if s.isdigit() else None

def custo(value):
    try:
        number=float(value) if isinstance(value,(int,float)) else float(str(value).replace(".","").replace(",","."))
    except (ValueError,TypeError):return None
    return round(number,2) if math.isfinite(number) and number>0 else None

def download(url):
    req=Request(url,headers={
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      "Accept":"application/vnd.ms-excel,application/octet-stream,*/*",
      "Referer":"https://smartsampa.prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179"
    })
    with urlopen(req,timeout=90) as reply:
        if reply.status!=200:raise RuntimeError(f"HTTP {reply.status}: {url}")
        data=reply.read(18_000_000)
    if not data.startswith(bytes.fromhex("D0CF11E0A1B11AE1")):
        raise RuntimeError("A origem não retornou um arquivo XLS válido")
    return data

def parse(data,grupo,regime):
    with tempfile.NamedTemporaryFile(suffix=".xls",delete=False) as output:
        output.write(data);name=output.name
    try:
        book=xlrd.open_workbook(name,on_demand=True)
        if len(book.sheet_names())!=1:raise RuntimeError("Quantidade de abas inesperada")
        sheet=book.sheet_by_index(0)
        headline=str(sheet.cell_value(1,0)).upper()
        stamp=str(sheet.cell_value(1,2)).upper()
        expected="SEM DESONERAÇÃO" if regime=="Sem desoneração" else "COM DESONERAÇÃO"
        if expected not in headline or "JUL/26" not in stamp:
            raise RuntimeError(f"Data-base/regime não conferem: {headline} | {stamp}")
        header=[str(sheet.cell_value(2,i)).upper() for i in range(4)]
        if not all(token in cell for token,cell in zip(("CÓDIGO","DESCRIÇÃO","UNIDADE","CUSTO"),header)):
            raise RuntimeError(f"Cabeçalho diferente do esperado: {header}")
        result=[]
        seen=set()
        for index in range(3,sheet.nrows):
            raw=sheet.row_values(index)
            code=codigo(raw[0])
            description=str(raw[1] or "").strip()
            unit=str(raw[2] or "").strip()
            price=custo(raw[3])
            if price is None:continue  # exclui cabeçalhos de grupos e serviços sem preço
            if not code or len(code)!=7 or not description or not unit or unit==".":
                raise RuntimeError(f"Linha {index+1} com preço e dados inconsistentes: {raw[:4]}")
            if code in seen:raise RuntimeError(f"Código duplicado na mesma planilha: {code}")
            seen.add(code)
            result.append({
                "code":code,"description":description,"unit":unit,"cost":price,
                "hh_per_unit":None,"source":"SIURB","reference_month":"2026-07",
                "regime":regime,"category":grupo
            })
        if len(result)<400 or len(result)>5000:
            raise RuntimeError(f"Quantidade suspeita em {grupo}/{regime}: {len(result)}")
        book.release_resources()
        return result
    finally:
        os.unlink(name)

def main():
    items=[]
    origins=[]
    for group,regime,file in TABLES:
        url=HOST+file
        raw=download(url)
        parsed=parse(raw,group,regime)
        origins.append({"group":group,"regime":regime,"source_url":url,
                        "sha256":hashlib.sha256(raw).hexdigest(),"count":len(parsed)})
        items.extend(parsed)
        print(group,regime,len(parsed),"registros validados",flush=True)
    if len(items)<5000:raise RuntimeError("Catálogo total inesperadamente pequeno")
    for i,entry in enumerate(items):
        entry["id"]=-(i+1)  # IDs virtuais: não conflitam com os registros locais
    obj={"meta":{"source":"SIURB São Paulo","reference_month":"2026-07",
                 "official_page":OFFICIAL,"publication_revision":"2026-10-01",
                 "notice":"Custos unitários oficiais. Coeficientes h-h não incluídos; não calcular cronograma sem composição validada.",
                 "origins":origins,"total":len(items)},"items":items}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("Arquivo:",OUT,"total:",len(items),"bytes:",OUT.stat().st_size,flush=True)

if __name__=="__main__":
    main()

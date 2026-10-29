#!/usr/bin/env python3
"""Auditoria SEM escrita no banco de planilhas suplementares da SIURB jul/2026.

Obtém arquivos oficiais, confere assinatura, calcula SHA-256 e emite apenas
metadados e amostras de cabeçalhos para validar o esquema antes da importação.
Não considera preço homologado nem publica dados de cliente.
"""
import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

HOST = "https://prefeitura.sp.gov.br/documents/d/obras/"
SOURCES = [
    ("sem", "horista", "onerada-sem-des-mobra-horista-julho-2026-1-xlsx", "xlsx"),
    ("sem", "equipamentos", "onerada-sem-des-equip-custos-unit-julho-2026-1-xlsx", "xlsx"),
    ("sem", "insumos", "onerada-sem-des-insumos-julho-2026-1-xlsx", "xlsx"),
    ("sem", "auxiliares", "onerada-sem-des-composicoes-auxiliares-julho-2026-1-xls", "xls"),
    ("com", "horista", "desonerada-com-des-mobra-horista-julho-2026-1-xlsx", "xlsx"),
    ("com", "equipamentos", "desonerada-com-des-equip-custos-unitarios-julho-26-1-xlsx", "xlsx"),
    ("com", "insumos", "desonerada-com-des-insumos-julho-2026-1-xlsx", "xlsx"),
    ("com", "auxiliares", "desonerada-com-des-composicoes-auxiliares-jul26-2-xls", "xls"),
]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "p": "http://schemas.openxmlformats.org/package/2006/relationships"}
LIMIT_BYTES = 25_000_000

def download(url):
    if not url.startswith(HOST) or not re.match(r"^[a-z0-9./:_-]+$", url):
        raise ValueError("Origem não permitida")
    req = Request(url, headers={"User-Agent": "CIVOLTEN-QA-SIURB/1.0",
                                "Accept": "application/octet-stream,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*"})
    with urlopen(req, timeout=45) as response:
        actual = response.geturl()
        if not actual.startswith("https://prefeitura.sp.gov.br/") and not actual.startswith("https://smartsampa.prefeitura.sp.gov.br/"):
            raise ValueError("Redirecionamento fora da origem oficial")
        data = response.read(LIMIT_BYTES + 1)
    if len(data)>LIMIT_BYTES:
        raise ValueError("Arquivo maior que limite")
    return data

def read_xlsx(data, sample_rows=6):
    if not data.startswith(b"PK"):
        raise ValueError("Não é XLSX")
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        files = set(book.namelist())
        shared = []
        if "xl/sharedStrings.xml" in files:
            strings = ET.fromstring(book.read("xl/sharedStrings.xml"))
            shared = ["".join(n.itertext()) for n in strings.findall("m:si",NS)]
        wb = ET.fromstring(book.read("xl/workbook.xml"))
        rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.attrib["Id"]:rel.attrib["Target"] for rel in rels}
        sheets=[]
        for sheet in wb.findall("m:sheets/m:sheet",NS):
            rel = sheet.attrib.get("{" + NS["r"] + "}id")
            target = targets.get(rel,"")
            path = (target.lstrip("/") if target.startswith("/") else "xl/"+target.lstrip("/"))
            path = path.replace("xl/xl/","xl/")
            if path not in files:
                raise ValueError("Planilha XLSX sem caminho válido")
            with book.open(path) as stream:
                rows=[]
                for _, elem in ET.iterparse(stream,events=("end",)):
                    if elem.tag != "{"+NS["m"]+"}row":
                        continue
                    values=[]
                    for cell in elem.findall("m:c",NS):
                        kind = cell.attrib.get("t")
                        v = cell.find("m:v",NS)
                        inline = cell.find("m:is",NS)
                        val = v.text if v is not None else ""
                        if kind=="s" and val:
                            val=shared[int(val)]
                        elif kind=="inlineStr" and inline is not None:
                            val="".join(inline.itertext())
                        values.append(str(val or "").strip()[:100])
                    if any(values): rows.append(values[:16])
                    elem.clear()
                    if len(rows)>=sample_rows:break
            sheets.append({"name":sheet.attrib.get("name"),"sample_rows":rows})
        return sheets

def read_xls(data, sample_rows=6):
    if not data.startswith(bytes.fromhex("d0cf11e0a1b11ae1")):
        raise ValueError("Não é XLS")
    import xlrd
    book=xlrd.open_workbook(file_contents=data,on_demand=True)
    sheets=[]
    for tab in book.sheets():
        rows=[]
        for i in range(min(tab.nrows, min(sample_rows+10,24))):
            row=[str(v).strip()[:100] for v in tab.row_values(i)[:16]]
            if any(row): rows.append(row)
            if len(rows)>=sample_rows:break
        sheets.append({"name":tab.name,"sample_rows":rows})
    book.release_resources()
    return sheets

def audit():
    records=[]
    errors=[]
    for regime,kind,slug,extension in SOURCES:
        url=HOST+slug
        try:
            data=download(url)
            sheet_info=read_xlsx(data) if extension=="xlsx" else read_xls(data)
            if not sheet_info:
                raise ValueError("Sem abas")
            record={"regime":regime,"kind":kind,"url":url,"sha256":hashlib.sha256(data).hexdigest(),
                    "bytes":len(data),"sheets":sheet_info}
            records.append(record)
            print(f"OK {regime}/{kind}: {len(data)} bytes, {len(sheet_info)} abas, sha={record['sha256'][:12]}",flush=True)
        except Exception as exc:
            errors.append({"regime":regime,"kind":kind,"error":str(exc)[:240]})
            print(f"FALHA {regime}/{kind}: {exc}",flush=True)
    return {"source_page":"https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179",
            "reference_month":"2026-07","files":records,"errors":errors,"all_files_verified":len(records)==len(SOURCES)}

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="artifacts/siurb-supplements-audit.json")
    args=parser.parse_args()
    result=audit()
    path=Path(args.output)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    if not result["all_files_verified"]:
        raise SystemExit("Auditoria INCOMPLETA; não importar componentes.")
    print("Auditoria de arquivos concluída. Isto NÃO homologa custos nem tributação.")

#!/usr/bin/env python3
"""Verifica as duas tabelas oficiais mensalistas SIURB julho/2026.

NUNCA grava preços no Neon e não homologa salário, encargos ou imposto.
Importa apenas planilhas da origem oficial e registra SHA-256 e estrutura
para posterior parser do esquema mensalista.
"""
import hashlib
import json
from pathlib import Path
import runpy

audit=runpy.run_path("scripts/audit-siurb-supplements.py",run_name="siurb_monthly_audit")
build=runpy.run_path("scripts/build-siurb-supplements.py",run_name="siurb_monthly_builder")
download=audit["download"]
read_xlsx=build["read_xlsx"]
prefix="https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/"
sources=[
 ("sem","onerada-sem-des-mobra-mensalista-julho-2026-1-xlsx"),
 ("com","desonerada-com-des-mobra-mensalista-julho-2026-1-xlsx"),
]
records=[]
target=Path("artifacts/siurb-monthly-source-files")
target.mkdir(parents=True,exist_ok=True)
for regime,slug in sources:
 url=prefix+slug
 data=download(url)
 if not data.startswith(b"PK"):
  raise ValueError("Fonte mensalista nao e XLSX "+regime)
 path=target/(regime+"-mensalista.xlsx")
 path.write_bytes(data)
 rows=list(read_xlsx(path))
 samples=[{"line":i,"cells":[str(v)[:120] for v in row[:11]]}
   for i,row in enumerate(rows[:13])]
 numeric_rows=[{"line":i,"code":row[0],"name":row[1],"fields":row[2:8]}
   for i,row in enumerate(rows) if len(row)>3 and str(row[0]).strip().isdigit()]
 meta={"regime":regime,"kind":"mensalista","url":url,
   "source_sha256":hashlib.sha256(data).hexdigest(),
   "bytes":len(data),"physical_rows":len(rows),
   "numeric_rows":len(numeric_rows),
   "samples":samples,"numeric_examples":numeric_rows[:8]}
 records.append(meta)
 print(json.dumps({"regime":regime,"sha256":meta["source_sha256"],
   "rows":len(rows),"numeric_rows":len(numeric_rows),"samples":samples,
   "numeric_examples":numeric_rows[:8]},ensure_ascii=False),flush=True)
result={"source_month":"2026-07","all_verified":len(records)==2,
 "source_page":"https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179",
 "sources":records,"commercial_release":False}
Path("artifacts/siurb-monthly-audit.json").write_text(
 json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if not result["all_verified"] or any(x["numeric_rows"]<10 for x in records):
 raise SystemExit("Planilha mensalista ausente ou incompleta")
print("Apenas auditoria mensalista; importacao para banco NAO realizada")

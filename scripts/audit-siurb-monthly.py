#!/usr/bin/env python3
"""Verifica as duas tabelas oficiais mensalistas SIURB julho/2026.

NUNCA grava preços no Neon e não homologa salário, encargos ou imposto.
Importa apenas planilhas da origem oficial e registra SHA-256 e estrutura
para posterior parser do esquema mensalista.
"""
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
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
monthly_export=Path("data/siurb-monthly-2026-07")
monthly_export.mkdir(parents=True,exist_ok=True)
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
 if len(numeric_rows)!=49:
  raise ValueError("Esperava exatamente 49 profissoes mensalistas por regime")
 prices=[]
 seen=set()
 for row in numeric_rows:
  code=str(row["code"]).strip()
  name=str(row["name"]).strip()
  if not code.isdigit() or not name or code in seen:
   raise ValueError("Codigo mensalista invalido ou duplicado: "+code)
  seen.add(code)
  for variant,index in [("sem_encargos",0),("com_encargos",1)]:
   raw=str(row["fields"][index]).strip().replace(",",".")
   cost=Decimal(raw)
   if not cost.is_finite() or cost<=0 or cost>Decimal("1000000"):
    raise ValueError("Custo mensalista invalido: "+code)
   price=format(cost.quantize(Decimal(".0001"),rounding=ROUND_HALF_UP),"f")
   prices.append({"code":code,"description":name,"kind":"mensalista",
     "variant":variant,"unit":"H","unit_cost":price,
     "regime":regime,"source_sha256":meta["source_sha256"]})
 monthly_group={"reference_month":"2026-07","regime":regime,"kind":"mensalista",
  "source":{"url":url,"sha256":meta["source_sha256"]},
  "rows":prices,"commercially_approved":False}
 (monthly_export/(regime+"-mensalista.json")).write_text(
   json.dumps(monthly_group,ensure_ascii=False,separators=(",",":"))+"\\n",
   encoding="utf-8")
 meta["normalized_prices"]=len(prices)
 records.append(meta)
 print(json.dumps({"regime":regime,"sha256":meta["source_sha256"],
   "rows":len(rows),"numeric_rows":len(numeric_rows),"samples":samples,
   "numeric_examples":numeric_rows[:8]},ensure_ascii=False),flush=True)
result={"source_month":"2026-07","all_verified":len(records)==2,
 "source_page":"https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179",
 "sources":records,"commercial_release":False}
Path("artifacts/siurb-monthly-audit.json").write_text(
 json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if not result["all_verified"] or any(x["numeric_rows"]!=49 or x["normalized_prices"]!=98 for x in records):
 raise SystemExit("Planilha mensalista ausente ou incompleta")
monthly_manifest={"reference_month":"2026-07","commercial_release":False,
 "sources":[{"regime":x["regime"],"kind":"mensalista",
  "source_sha256":x["source_sha256"],"source_url":x["url"],
  "file":x["regime"]+"-mensalista.json","rows":x["normalized_prices"]}
  for x in records],"prices":sum(x["normalized_prices"] for x in records)}
(monthly_export/"manifest.json").write_text(
 json.dumps(monthly_manifest,ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
print("Duas fontes mensalistas oficiais normalizadas; 196 precos horarios verificaveis. Nada gravado no Neon.")

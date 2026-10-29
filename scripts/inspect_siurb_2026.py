"""Inspeciona o formato dos custos SIURB julho/2026, sem publicar preços."""
from urllib.request import Request, urlopen
import os, tempfile
import xlrd
BASE="https://prefeitura.sp.gov.br/documents/d/obras/"
FILES={
 "edif_sem_des":"onerada-sem-des-custos-unit-edif-julho-2026-2-xls",
 "infra_sem_des":"onerada-sem-des-custos-unit-infra-julho-2026-2-xls",
 "edif_com_des":"desonerada-com-des-custos-unit-edif-julho-2026-2-xls",
 "infra_com_des":"desonerada-com-des-custos-unid-infra-julho-2026-2-xls",
}
def short(value):
 return str(value if value is not None else "").replace("\n"," ").strip()[:85]
for nome, arquivo in FILES.items():
 print("=== ",nome,arquivo," ===",flush=True)
 try:
  req=Request(BASE+arquivo,headers={"User-Agent":"Mozilla/5.0"})
  with urlopen(req,timeout=80) as response:
   contents=response.read()
   print("status",response.status,"bytes",len(contents),"content-type",response.headers.get("Content-Type"),flush=True)
  if not contents.startswith(bytes.fromhex("D0CF11E0A1B11AE1")):
   print("unexpected format",repr(contents[:100]));continue
  with tempfile.NamedTemporaryFile(suffix=".xls",delete=False) as temp:
   temp.write(contents);fname=temp.name
  book=xlrd.open_workbook(fname,on_demand=True)
  for name in book.sheet_names()[:7]:
   sh=book.sheet_by_name(name)
   print("SHEET",name,"rows",sh.nrows,"cols",sh.ncols,flush=True)
   for row_ix in list(range(min(sh.nrows,30)))+[n for n in (60,100,300,1000) if n<sh.nrows]:
    vals=[f"{i}:{short(v)}" for i,v in enumerate(sh.row_values(row_ix)[:11]) if short(v)]
    if vals:print("ROW",row_ix+1," | ".join(vals),flush=True)
  book.release_resources()
  os.unlink(fname)
 except Exception as exc:
  print("ERROR",type(exc).__name__,str(exc)[:400],flush=True)

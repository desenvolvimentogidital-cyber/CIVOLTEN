"""Inspeção SEM importação das composições oficiais: identifica coeficientes reais."""
from urllib.request import Request,urlopen
import io
import xlrd
SOURCE="https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/"
FILES={
"edificacoes_sem":"onerada-sem-des-comp-custos-unit-edif-julho-2026-2-xls",
"infra_sem":"onerada-sem-des-comp-custos-unit-infra-julho-2026-2-xls",
"edificacoes_com":"desonerada-com-des-comp-custos-unit-edif-jul26-2-xls",
"infra_com":"desonerada-com-des-comp-custos-unid-infra-jul26-2-xls"
}
for category,filename in FILES.items():
 print("###",category,filename,flush=True)
 try:
  req=Request(SOURCE+filename,headers={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36","Referer":"https://smartsampa.prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179"})
  with urlopen(req,timeout=80) as r:
   data=r.read(20000000)
   print("HTTP",r.status,"bytes",len(data),flush=True)
  book=xlrd.open_workbook(file_contents=data,on_demand=True)
  print("SHEETS",[(x,book.sheet_by_name(x).nrows,book.sheet_by_name(x).ncols) for x in book.sheet_names()[:10]],flush=True)
  for name in book.sheet_names()[:2]:
   sheet=book.sheet_by_name(name)
   print("SHEET",name,flush=True)
   for index in list(range(min(sheet.nrows,35)))+[i for i in (60,100,500) if i<sheet.nrows]:
    values=[str(v).replace("\n"," ")[:65] for v in sheet.row_values(index)[:12]]
    if any(x.strip() for x in values):
     print("ROW",index+1," | ".join(f"{i}:{x}" for i,x in enumerate(values) if x.strip()),flush=True)
  book.release_resources()
 except Exception as e:
  print("ERROR",category,type(e).__name__,str(e)[:350],flush=True)

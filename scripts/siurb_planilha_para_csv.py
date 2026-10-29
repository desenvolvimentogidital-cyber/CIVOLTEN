#!/usr/bin/env python3
"""Converter .xls (legado) ou .xlsx em CSV do CIVOLTEN usando mapeamento manual.

Dependências opcionais:
  pip install xlrd openpyxl

É necessário selecionar folha, linha de cabeçalho e colunas conforme o arquivo
real da SIURB; nenhuma heurística afirma importar composições automaticamente.
"""
import argparse
import csv
from pathlib import Path

def column_index(label):
    value=0
    for letter in label.upper():
        if not ('A'<=letter<='Z'):
            raise ValueError('Coluna deve ser A, B, C, AA...')
        value=value*26 + (ord(letter)-64)
    return value-1

def strval(row,index):
    if index is None or index>=len(row) or row[index] is None:return ''
    v=row[index]
    return str(int(v)) if isinstance(v,float) and v.is_integer() else str(v).strip()

def rows_in_book(filepath,sheet):
    if filepath.suffix.lower()=='.xls':
        try:import xlrd
        except ImportError:raise SystemExit('Para .xls use: pip install xlrd')
        book=xlrd.open_workbook(str(filepath))
        if sheet and sheet not in book.sheet_names():raise SystemExit(f'Aba {sheet} não encontrada. Abas: {book.sheet_names()}')
        ws=book.sheet_by_name(sheet) if sheet else book.sheet_by_index(0)
        for i in range(ws.nrows):yield ws.row_values(i)
    else:
        try:from openpyxl import load_workbook
        except ImportError:raise SystemExit('Para .xlsx use: pip install openpyxl')
        book=load_workbook(filepath,data_only=True,read_only=True)
        if sheet and sheet not in book.sheetnames:raise SystemExit(f'Aba {sheet} não encontrada. Abas: {book.sheetnames}')
        ws=book[sheet] if sheet else book.worksheets[0]
        yield from ws.iter_rows(values_only=True)

def main():
    ap=argparse.ArgumentParser(description='Converter planilha SIURB XLS/XLSX para CSV de custos CIVOLTEN')
    ap.add_argument('arquivo',type=Path)
    ap.add_argument('--sheet',help='Nome da aba (padrão: primeira)')
    ap.add_argument('--header-row',type=int,default=1,help='Número da última linha de cabeçalho, começando em 1')
    ap.add_argument('--code',required=True,help='Coluna do código, ex.: B')
    ap.add_argument('--desc',required=True,help='Coluna da descrição, ex.: C')
    ap.add_argument('--unit',required=True,help='Coluna de unidade, ex.: D')
    ap.add_argument('--cost',required=True,help='Coluna de custo, ex.: E')
    ap.add_argument('--hh',help='Coluna de h-h/unidade já consolidada, caso exista')
    ap.add_argument('--output',type=Path,default=Path('siurb-normalizada.csv'))
    args=ap.parse_args()
    cols=[column_index(getattr(args,name)) if getattr(args,name) else None for name in ['code','desc','unit','cost','hh']]
    count=0
    with args.output.open('w',encoding='utf-8-sig',newline='') as output:
        writer=csv.writer(output,delimiter=';')
        writer.writerow(['codigo','descricao','unidade','custo','hh_un','categoria'])
        for n,row in enumerate(rows_in_book(args.arquivo,args.sheet),start=1):
            if n<=args.header_row:continue
            code,desc,unit,cost,hh=[strval(row,k) for k in cols]
            if not code or not desc or not cost:continue
            writer.writerow([code,desc,unit,cost,hh,'SIURB - validar grupo'])
            count+=1
    print(f'{count} linhas exportadas: {args.output.resolve()}')
    print('ATENÇÃO: revise código, unidades, custo/regime e coeficientes h-h antes de importar.')
if __name__=='__main__':main()
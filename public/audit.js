/* CIVOLTEN — verificação prévia independente de DOM, API e infraestrutura.
   Resultado: alertas de consistência, não substitui revisão técnica de responsável. */
(function(root){
  'use strict';
  function auditBudget(b, company, mode){
    const errors=[],warnings=[];
    const err=(code,message)=>errors.push({code,message});
    const warn=(code,message)=>warnings.push({code,message});
    const rows=Array.isArray(b?.summary?.rows)?b.summary.rows:(Array.isArray(b?.items)?b.items:[]);
    const num=x=>x!==null&&x!==''&&Number.isFinite(Number(x))?Number(x):NaN;
    const meaningful=s=>typeof s==='string'&&s.trim().length>=3;
    if(!meaningful(b?.client_name))err('client','Selecione um cliente identificado.');
    if(!meaningful(b?.client_doc)||String(b.client_doc).replace(/\D/g,'').length<11)
      err('client_doc','Informe CPF/CNPJ do cliente e confira os dados cadastrais.');
    if(!meaningful(b?.project_name)&&!meaningful(b?.title))
      err('work','Informe a obra e seu objeto contratual.');
    if(!meaningful(b?.project_address))
      err('work_address','Cadastre o endereço de execução da obra.');
    if(!rows.length)err('items','Inclua serviços antes de gerar a proposta.');
    rows.forEach((r,index)=>{
      const line=index+1;
      if(!meaningful(r.description)||!String(r.unit||'').trim())err('item_description','Item '+line+': descrição e unidade obrigatórias.');
      if(!(num(r.qty)>0))err('quantity','Item '+line+': quantidade deve ser positiva.');
      if(!(num(r.unit_cost)>0))err('price','Item '+line+': preço unitário deve ser positivo.');
      if(!(num(r.hh_unit)>0))err('productivity','Item '+line+': falta coeficiente de produtividade h-h/unidade validado.');
      if(!meaningful(r.code))warn('price_source','Item '+line+': sem código de composição ou origem documentada.');
    });
    if(!(num(b?.summary?.total)>0)||!(num(b?.summary?.cost)>0))err('total','Total ou custo direto inválido; confira as quantidades e preços.');
    if(!(num(b?.bdi)>=0&&num(b?.bdi)<=100))err('bdi','BDI fora da faixa de revisão de 0 a 100%.');
    else warn('bdi_methodology','Confirme separadamente o detalhamento do BDI, encargos, tributos, lucro e risco de duplicidade; a porcentagem isolada não comprova sua composição.');
    if(!(num(b?.totalDays)>0)||!meaningful(b?.finish))err('schedule','Cronograma incompleto: sem prazo comprovado para todos os serviços.');
    else warn('schedule_methodology','O cronograma atual é sequencial e agregado; revise equipes, frentes simultâneas, feriados, restrições e caminho crítico.');
    if(!(num(b?.safety_pct)>=0&&num(b?.safety_pct)<=100))err('safety','Revise o percentual de margem de segurança do prazo.');
    if(!(num(b?.validity_days)>=1&&num(b?.validity_days)<=365))err('validity','Defina validade comercial de 1 a 365 dias.');
    if(!meaningful(b?.payment_terms)||/^(a negociar|a definir|pendente|não informado)$/i.test(String(b.payment_terms).trim()))
      err('payment','Defina condições de pagamento, parcelas e marcos de medição.');
    if(!meaningful(b?.notes)||String(b.notes).trim().length<20)
      err('scope','Descreva condições de execução, premissas, exclusões e responsabilidades em Observações e restrições (mín. 20 caracteres).');
    if(!meaningful(company?.company))err('company','Identifique a empresa emitente.');
    if(String(company?.cnpj||'').replace(/\D/g,'').length!==14)err('company_cnpj','Preencha o CNPJ da empresa nas Configurações.');
    if(!meaningful(company?.email)||!String(company.email).includes('@'))err('company_contact','Preencha um e-mail comercial válido nas Configurações.');
    if(!meaningful(company?.phone))warn('company_phone','Confira o telefone comercial da empresa.');
    if(b?.reference_month!=='2026-07')warn('reference','Verifique se a data-base selecionada é compatível com os serviços importados da SIURB.');
    else warn('price_date','Preços de referência de julho/2026: confirme reajustes de mercado, fretes, perdas e condições locais antes do envio.');
    if(mode?.demo)err('demo','Ambiente demonstrativo, sem autenticação e banco central: propostas comerciais reais não podem ser emitidas.');
    return {ready:errors.length===0,errors,warnings,checkedAt:new Date().toISOString()};
  }
  root.CIVOLTEN_AUDIT=auditBudget;
})(globalThis);

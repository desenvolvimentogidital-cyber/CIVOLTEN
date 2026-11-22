// Cadastro empresarial independente, reutiliza clientes existentes de NFS-e sem emitir notas.
import {e,icon} from './views.mjs';
export function clientsView(clients=[],notice=''){
 const sorted=[...clients].sort((a,b)=>String(a.legal_name||'').localeCompare(String(b.legal_name||''),'pt-BR'));
 return '<section class="fin-screen"><div class="page-heading"><button class="small-square" data-go="more" aria-label="Voltar">'+icon('back',24)+'</button><h1>Clientes</h1><span></span></div>'+
 '<p class="fin-intro">Cadastre pessoas físicas (CPF) e empresas (CNPJ). Não emite notas fiscais.</p>'+
 (notice?'<p class="fin-helper" role="status">'+e(notice)+'</p>':'')+
 '<form id="client-form" class="settings-panel"><input type="hidden" name="clientId" value="">'+
 '<label class="modal-field"><span>Tipo de cliente</span><select name="clientKind" id="client-kind"><option value="cnpj">Empresa (CNPJ)</option><option value="cpf">Pessoa física (CPF)</option></select></label>'+ 
 '<label class="modal-field"><span>Nome / Razão social</span><input name="clientName" maxlength="180" required></label>'+
 '<label class="modal-field"><span>CPF ou CNPJ</span><input name="clientCnpj" inputmode="numeric" maxlength="18" required></label>'+
 '<label class="modal-field"><span>E-mail</span><input name="clientEmail" type="email" maxlength="160"></label>'+
 '<button type="submit" class="gold-button">Salvar cliente</button></form>'+
 '<label class="modal-field"><span>Pesquisar clientes</span><input id="clients-search" type="search" placeholder="Razão social ou CNPJ"></label>'+
 '<div class="cost-list">'+(sorted.length?sorted.map(c=>'<div class="cost-row" data-client-search="'+e((c.legal_name+' '+(c.cnpj||c.cpf)).toLowerCase())+'"><span class="row-title"><b>'+e(c.legal_name)+'</b><small>'+e(c.cnpj||c.cpf)+' · '+e(c.email||'Sem e-mail')+'</small></span>'+
 '<button type="button" class="outlined-button" data-action="client-edit" data-id="'+e(c.id)+'">Editar</button>'+
 '<button type="button" class="outlined-button" data-action="client-delete" data-id="'+e(c.id)+'">Excluir</button></div>').join(''):'<p class="fin-empty">Nenhum cliente cadastrado.</p>')+'</div></section>';
}

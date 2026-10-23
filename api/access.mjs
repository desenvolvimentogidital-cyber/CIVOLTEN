// Endpoint obsoleto: a aprovação administrativa foi removida.
// Mantido apenas para responder explicitamente a clientes antigos.
import {json} from '../lib/civolten-security.mjs';
export default {async fetch(){return json({error:'Fluxo de aprovação desativado.'},410)}};

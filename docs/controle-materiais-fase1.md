# Controle de materiais — fase 1

## Escopo implementado
- Cadastro de materiais com categoria, unidade e estoque mínimo.
- Cadastro de fornecedores com contato e CPF/CNPJ validados pelos dígitos verificadores.
- Movimentações de compra/entrada, entrada avulsa, saída, perda/avaria, devolução e ajuste de inventário.
- Saldo atual e custo médio ponderado calculados no banco.
- Histórico de movimentações, fornecedor e referência/documento da compra.
- Alerta de estoque abaixo do mínimo e valor estimado do estoque.
- Saídas que excedem o saldo são bloqueadas.
- Movimentos atualizam o saldo e gravam o histórico em uma única função transacional.

## Segurança e integridade
- Três tabelas próprias, isoladas por `auth.uid()` com RLS.
- A tela não tem permissão para alterar diretamente o saldo nem o custo médio.
- A gravação de movimentos ocorre somente pela RPC `cv_material_movement_create_v1`, que confere sessão, dono do material e fornecedor, bloqueia a linha para evitar corrida e grava saldo/histórico na mesma transação.
- Movimentações impedem exclusão de materiais e fornecedores relacionados, preservando o histórico.
- Não há dados de demonstração nem estoque inicial presumido: cada material começa com saldo zero e o estoque é alimentado por compra/entrada ou ajuste contado.

## Regra de custo
Compras e entradas com custo unitário recalculam o custo médio ponderado. Saídas, perdas e devoluções não recalculam esse custo. O valor total do estoque é uma estimativa gerencial (saldo × custo médio), não substitui inventário contábil.

## Aplicação da migration
Arquivo: `supabase/materials_inventory_v1.sql`.

**Não executar antes de aprovar a revisão e confirmar o projeto Supabase CIVOLTEN correto.** A migration cria apenas as tabelas `cv_suppliers_v1`, `cv_materials_v1`, `cv_material_movements_v1` e a RPC de movimentação. Não altera dados/tabelas existentes. A migration precisa ser aplicada antes de publicar o frontend que consulta as novas tabelas.

## Limites desta fase
A vinculação automática de saídas a uma ordem de serviço, reserva de materiais, consumo por obra, custo real por serviço, devolução vinculada à OS e lançamento no financeiro ficam para a fase 2. Nesta fase o campo de referência/observação permite identificar a obra manualmente, sem afirmar integração automática.

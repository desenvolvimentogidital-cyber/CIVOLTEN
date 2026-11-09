# CIVOLTEN — Acompanhamento Digital do Cronograma em Campo

## Onde acessar

**Obras e execução → Abrir obra → Acompanhamento digital do cronograma**.

Cada obra apresenta um **Diário de campo** com todos os serviços da proposta aprovada,
quantidade contratada, quantidade executada, percentual e datas previstas. É possível
pesquisar por nome/código e filtrar por **Pendentes, Em execução, Paralisados ou Concluídos**.

Para atualizar um serviço, inicie a execução da obra e toque em **Atualizar serviço**.
Informe situação, quantidade física já executada, profissional responsável (opcional),
data, ocorrências e até **três fotos** por serviço. A foto é compactada no celular
e enviada para área privada do Supabase; somente usuários autenticados com acesso
à obra podem consultar seus arquivos usando links temporários.

O acompanhamento persiste na conta e aparece em outros dispositivos após sincronizar.
O indicador geral é ponderado pelas **horas-homem previstas** em cada serviço,
não pela soma de m² com unidades diferentes. As HH equivalentes de avanço não
representam horas efetivamente trabalhadas.

## Separação entre campo e financeiro

- Marcar uma quantidade como executada **não aprova medição**, **não cria cobrança**,
  **não lança recebível** e **não registra horas reais**.
- Os registros oficiais de **Apontar horas trabalhadas** e **Registrar medição**
  continuam separados na tela da obra.
- O orçamento aceito, OS, valores contratados, margem, impostos, cargos, folha
  de pagamento e produtividade original não são reprecificados.
- O Diário de campo só pode ser editado quando a obra estiver **Em execução**.
  Obras concluídas ou canceladas permanecem em modo de consulta.
- A quantidade física não pode ultrapassar a quantidade contratada. Ao marcar
  **Concluído**, o serviço fica com 100% de quantidade executada; ao marcar
  **Pendente**, volta a zero, requerendo conferência humana dos dados.
- Fotos e anotações são evidências gerenciais, não certificação de execução nem
  substituição dos documentos assinados ou de fiscalização.

## Segurança

Nova tabela `public.cv_field_progress_v1` com RLS por `auth.uid()`,
verificação da titularidade da OS, do item da proposta aprovada, do profissional
e da quantidade; gatilho do PostgreSQL impede editar obras não iniciadas
e alterar a identidade de um apontamento.

Fotos em bucket privado `cv-field-evidence-v1`, limitado a 4 MB por imagem;
políticas RLS de leitura, inclusão e remoção restritas ao proprietário da obra.
O navegador converte imagens para JPEG com até 1600 px, removendo metadados
EXIF da cópia enviada. Não compartilhe links fotográficos em grupos públicos.

**Nesta versão**, somente usuários que entram na conta CIVOLTEN podem fazer as
marcações. O nome do profissional escolhido no formulário é uma atribuição
gerencial, **não é login próprio nem autenticação do funcionário**. Para acesso
individual de encarregados ou profissionais, a próxima evolução deve criar
contas e papéis separados com permissões limitadas por obra; nunca compartilhe
a senha principal da empresa.

## Encargos

Os encargos CLT foram mantidos exatamente como estavam. A revisão contábil
será realizada somente quando a empresa tiver os percentuais confirmados pelo
contador.

## Testes e rotina

- `tests/field-progress.test.mjs`: cálculo de avanço, valores limites, regras
  do estado, isolamento e ausência de efeitos financeiros.
- `tests/budget-browser.cjs`: abrir Diário no Android, atualizar serviço,
  anexar foto, filtrar, conferir sincronização e continuar HH e medições.
- A migração `supabase/field-progress-v1.sql` é aditiva e não modifica as
  linhas atuais de custos, funcionários, contratos ou serviços SIURB.

Próximas melhorias recomendadas: usuários individuais para encarregados,
registro de autoria das alterações e histórico de versões, replanejamento
com feriados e dependências reais, alertas de atraso e sincronização de
lançamentos feitos sem internet. O acompanhamento atual exige conexão ativa
para salvar novos apontamentos.

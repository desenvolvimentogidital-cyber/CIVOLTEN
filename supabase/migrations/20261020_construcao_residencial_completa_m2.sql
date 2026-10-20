-- CIVOLTEN: obra residencial completa por área construída.
-- Sem preço validado, 0 = avaliação personalizada na API (PRECIFICACAO_PENDENTE).
-- Não interfere nos serviços/preços já existentes.
INSERT INTO public.pricing_catalog
  (service_id,category,description,unit,baixo,medio,alto,enabled)
VALUES
  ('construcao_residencial_completa','construcao_civil',
   'Construção residencial completa — do zero à entrega pronta','m²',0,0,0,true)
ON CONFLICT (service_id) DO NOTHING;

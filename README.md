# Escala

Uma plataforma simples, em português, para organizar escalas semanais e acompanhar pagamentos por diária. React + Vite + TypeScript, com Supabase Auth e PostgreSQL acessados diretamente pelo SDK oficial. Não há API própria.

## Executar

Requer Node.js 22.12 ou superior (LTS recomendado).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env.local`. Preencha o arquivo conforme a seção abaixo. Sem configuração, a aplicação mostra uma mensagem de instalação pendente; não utiliza dados fictícios nem simula autenticação.

## Configurar o Supabase

1. Crie um projeto no plano gratuito em https://supabase.com/dashboard. Guarde a senha do banco fora do frontend.
2. Abra **SQL Editor**, cole todo o conteúdo de `supabase/migrations/202610010001_initial.sql` e execute uma vez. Essa migração cria tabelas, índices, restrições, triggers e políticas RLS.
3. Na área **Connect** do projeto, copie a URL e a **publishable key** (a chave `anon` legada também funciona). Preencha:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU-ID.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
   ```

   Essas duas informações são públicas. Nunca use `service_role`, secret key, senha do banco ou token administrativo em variáveis `VITE_*`.

4. Em **Authentication → Sign In / Providers**, habilite email/senha e desabilite novos cadastros públicos. Crie usuários manualmente em **Authentication → Users → Add user → Create new user**, com email confirmado e senha de pelo menos 8 caracteres. O app não tem tela de cadastro.
5. Em **Authentication → URL Configuration**, configure a Site URL e autorize `http://localhost:5173/nova-senha` e `http://127.0.0.1:5173/nova-senha`. Após publicar, autorize também `https://SEU-DOMINIO/nova-senha` e atualize a Site URL.
6. Para recuperação de senha para usuários reais, configure **SMTP próprio** no Supabase. O envio padrão é restrito a membros da organização e serve para testes. Escolha um provedor com cota gratuita compatível com seu volume; nenhum serviço pago é necessário no código, mas cotas e requisitos do provedor devem ser conferidos. Credenciais SMTP ficam somente no painel Supabase.
7. Reinicie `npm run dev`, abra o endereço exibido no terminal e entre com o usuário criado.

Referências oficiais: [React e Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [senhas](https://supabase.com/docs/guides/auth/passwords), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Como usar

- Cadastre os funcionários com nome e valor da diária. Telefone e observação são opcionais.
- Na Escala, escolha a semana, adicione um funcionário e toque nos dias para marcar/desmarcar. Cada marca representa uma diária inteira.
- Confira o resumo automático. A semana começa na segunda e termina no domingo.
- Em Pagamentos, marque os pagamentos realizados como Pago. Para corrigir dias de uma escala paga, confirme **Voltar para pendente** antes de editar.
- Consulte semanas anteriores em Histórico. **Editar escala** abre a semana para correção.
- Desative funcionários que não serão mais adicionados a novas semanas. O histórico e as escalas existentes continuam disponíveis. É possível reativá-los.

## Regras e banco

- Cada usuário tem dados próprios; não existe equipe compartilhada ou perfil de administrador dentro do app.
- `employees` guarda o cadastro e a diária atual, em centavos inteiros.
- `employee_weeks` registra a inclusão na semana mesmo sem dias, copia a diária atual no banco e guarda status/data do pagamento. A diária dessa semana permanece imutável mesmo se o cadastro mudar.
- `work_days` guarda cada dia marcado e pertence a um vínculo semanal. Duplicatas e datas fora da semana são recusadas.
- Totais são derivados dos dias e da diária semanal. Não há coluna de total que possa ficar desatualizada.
- Uma semana paga não aceita novos dias, desmarcações ou remoção do funcionário. Triggers protegem a regra mesmo em chamadas diretas ao banco. Operações de dias bloqueiam o vínculo semanal para serializar alterações com o pagamento.
- Remover um funcionário de uma semana pendente apaga os dias daquela semana após confirmação. Não existe exclusão permanente de funcionários na aplicação.
- Todas as tabelas possuem RLS por `auth.uid()`, referências com proprietário e privilégios limitados. A segurança não depende dos filtros do frontend.

## Organização

`src/pages` contém as telas; `src/components`, os elementos reutilizáveis; `src/services`, chamadas Supabase; `src/hooks`, sessão e consultas; `src/utils`, datas, moeda e cálculos; `src/types`, contratos do banco. Os comentários explicam decisões de negócio e segurança. React Query cuida de cache por usuário, recarregamento e reversão de marcações que falham.

## Testar

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de banco executam a migração em PostgreSQL WASM (PGlite), com `auth.uid()` e usuários de teste; verificam RLS, privilégios, referências, diária preservada, datas, duplicatas e proteção dos pagamentos. Os testes de navegador usam respostas Supabase controladas, sem acesso a projetos reais. Eles cobrem autenticação, recuperação, cadastro/edição/desativação, marcação, reversão após erro, pagamento, histórico e celular.

O Playwright usa Microsoft Edge instalado no Windows e Chromium em CI. Para utilizar o Chromium baixado localmente, remova a opção `channel` de `playwright.config.ts`. Os testes não comprovam entrega de email nem conectividade com seu projeto real.

### Conferência antes do uso real

Com duas contas diferentes, confirme no Supabase que uma conta não lista ou altera dados da outra. Faça login/logout, recupere a senha por email e confirme a persistência após recarregar a página. Marque quatro dias com diária de R$150: Dashboard, Escala e Pagamentos devem mostrar R$600. Troque a diária para R$200: a semana anterior deve manter R$150 e uma nova inclusão deve usar R$200. Marque como Pago, confira o bloqueio, reabra e corrija.

Para conferir concorrência em PostgreSQL remoto, use duas sessões SQL: com um dia existente, uma sessão insere outro dia e mantém a transação aberta; a segunda marca o vínculo como pago e deve esperar. Após a primeira confirmar, o pagamento termina incluindo ambos os dias. Inverta a ordem: enquanto o pagamento estiver aberto, uma inserção espera e, após o commit do pagamento, deve ser recusada. Faça isso apenas com dados de teste.

## Hospedar posteriormente

O build gera `dist/`. Configure as duas variáveis públicas no serviço escolhido **antes** do build. Elas são incorporadas ao JavaScript e mudar variáveis exige novo build.

- **Cloudflare Pages:** comando `npm run build`, pasta de saída `dist`. `public/_redirects` garante o fallback das rotas para `index.html`.
- **Vercel:** preset Vite, comando `npm run build`, saída `dist`. `vercel.json` define o fallback das rotas.

Depois, configure a URL e o redirect de recuperação no Supabase. Não há publicação automática, cobrança, integração bancária, pagamento parcial, relatório avançado, modo offline ou sincronização em tempo real nesta versão. O status Pago é somente controle interno.

## Custo e limites

A aplicação pode começar nos planos gratuitos dentro de suas cotas. Confira os limites vigentes do Supabase, da hospedagem e do SMTP antes do uso real. A implantação não exige ativar recursos pagos. O projeto Supabase, os usuários e o SMTP são configurados pelo responsável pela instalação.

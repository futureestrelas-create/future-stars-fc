# FUTURE STARS FC — Site oficial v2.0

Site responsivo para a gestão e apresentação do FUTURE STARS FC, com identidade preta, cinza, branca e vermelha.

## Recursos
- Painel público com contagem de jogadores, partidas, títulos e Evoluções.
- Elenco com pesquisa, filtro por equipe, overall, posição, país, ano de nascimento e imagem opcional.
- Histórico de partidas e placares.
- Evolution Lab.
- Mercado da bola.
- Arquivo de temporadas.
- Área administrativa com formulários para jogadores, partidas, Evoluções, movimentações de mercado, temporadas, títulos e galeria.
- Exportação e importação de backup JSON.
- Modo local (salva no navegador).
- Integração opcional com Supabase para dados compartilhados e login.

## Publicar com GitHub Pages
1. Crie um repositório público no GitHub, por exemplo `future-stars-fc`.
2. Envie `index.html`, `style.css`, `app.js` e `config.js` para a raiz do repositório.
3. Vá a **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**, selecione `main` e `/ (root)`.
5. Salve. O GitHub mostrará o endereço do site depois da publicação.

Documentação: https://docs.github.com/en/pages

## Usar sem banco de dados
O site funciona imediatamente em modo local:
1. Abra o site.
2. Clique em **Área administrativa**.
3. Clique em **Abrir ferramentas locais**.
4. Cadastre os dados.
5. Use **Exportar backup JSON** regularmente.

Importante: o modo local guarda informações somente no navegador e dispositivo atual. Não é sincronizado entre você e seu amigo.

## Habilitar banco compartilhado com Supabase
Para ambos editarem e verem os mesmos dados, configure um projeto Supabase.

1. Crie um projeto em https://supabase.com/
2. No painel, abra **Project Settings → API** e copie a Project URL e a chave publicável (publishable/anon).
3. Edite `config.js`:
```js
window.FSFC_CONFIG = {
  supabaseUrl: "SUA_PROJECT_URL",
  supabaseAnonKey: "SUA_CHAVE_PUBLICAVEL"
};
```
Nunca coloque a chave `service_role` no frontend.
4. No SQL Editor do Supabase, execute o esquema abaixo.
5. Em Authentication, habilite e configure o método de login por e-mail. Você e seu amigo devem criar contas autorizadas.

### Banco de dados (SQL)
Este esquema cria as tabelas básicas. RLS permite leitura pública dos dados e escrita apenas para usuários autenticados. Se o site for aberto ao público, qualquer conta autenticada poderá editar os dados com esta política inicial; para produção, restrinja a escrita a usuários explicitamente autorizados conforme as instruções abaixo.

```sql
create table if not exists public.fsfc_players (
  id uuid primary key default gen_random_uuid(), name text not null, overall int, position text not null,
  birth_year int, team text, country text, image_url text, status text default 'Ativo', notes text,
  created_at timestamptz default now()
);
create table if not exists public.fsfc_matches (
  id uuid primary key default gen_random_uuid(), match_date date, competition text, opponent text not null,
  goals_for int default 0, goals_against int default 0, player_of_match text, notes text, created_at timestamptz default now()
);
create table if not exists public.fsfc_evolutions (
  id uuid primary key default gen_random_uuid(), player_name text not null, evolution_name text not null,
  old_overall int, new_overall int, evo_date date, notes text, created_at timestamptz default now()
);
create table if not exists public.fsfc_market (
  id uuid primary key default gen_random_uuid(), player_name text not null, movement text, source text,
  cost numeric default 0, movement_date date, season text, notes text, created_at timestamptz default now()
);
create table if not exists public.fsfc_seasons (
  id uuid primary key default gen_random_uuid(), name text not null, start_date date, end_date date,
  status text, titles int default 0, summary text, created_at timestamptz default now()
);
create table if not exists public.fsfc_trophies (
  id uuid primary key default gen_random_uuid(), name text not null, competition text, season text,
  award_date date, notes text, created_at timestamptz default now()
);
create table if not exists public.fsfc_gallery (
  id uuid primary key default gen_random_uuid(), title text not null, category text, image_url text not null,
  image_date date, description text, created_at timestamptz default now()
);

alter table public.fsfc_players enable row level security;
alter table public.fsfc_matches enable row level security;
alter table public.fsfc_evolutions enable row level security;
alter table public.fsfc_market enable row level security;
alter table public.fsfc_seasons enable row level security;
alter table public.fsfc_trophies enable row level security;
alter table public.fsfc_gallery enable row level security;

-- Leitura pública: o site pode exibir as informações sem login.
create policy "public read players" on public.fsfc_players for select using (true);
create policy "public read matches" on public.fsfc_matches for select using (true);
create policy "public read evolutions" on public.fsfc_evolutions for select using (true);
create policy "public read market" on public.fsfc_market for select using (true);
create policy "public read seasons" on public.fsfc_seasons for select using (true);
create policy "public read trophies" on public.fsfc_trophies for select using (true);
create policy "public read gallery" on public.fsfc_gallery for select using (true);

-- Política básica: somente usuários autenticados podem inserir/editar/apagar.
-- Recomendação de segurança: para um site público, substitua estas policies por uma allowlist
-- com os IDs de usuário dos administradores (você e seu amigo), conforme descrito abaixo.
create policy "authenticated write players" on public.fsfc_players for all to authenticated using (true) with check (true);
create policy "authenticated write matches" on public.fsfc_matches for all to authenticated using (true) with check (true);
create policy "authenticated write evolutions" on public.fsfc_evolutions for all to authenticated using (true) with check (true);
create policy "authenticated write market" on public.fsfc_market for all to authenticated using (true) with check (true);
create policy "authenticated write seasons" on public.fsfc_seasons for all to authenticated using (true) with check (true);
create policy "authenticated write trophies" on public.fsfc_trophies for all to authenticated using (true) with check (true);
create policy "authenticated write gallery" on public.fsfc_gallery for all to authenticated using (true) with check (true);
```

### Segurança recomendada para site público
A política de exemplo acima deixa qualquer usuário com conta autenticada editar dados. Para restringir a escrita só a você e seu amigo:
1. Crie as duas contas no Supabase.
2. Em Authentication → Users, copie os UUIDs dessas contas.
3. Remova as sete políticas `authenticated write ...`.
4. Crie uma tabela `fsfc_admins` com uma linha para cada UUID, ou crie policies que validem `auth.uid()` contra os UUIDs autorizados.
5. Mantenha as policies de leitura pública.

Exemplo com allowlist direta (substitua os UUIDs de exemplo):
```sql
-- Execute depois de remover as policies authenticated write existentes.
create policy "admins write players" on public.fsfc_players for all to authenticated
using (auth.uid() in ('UUID_DO_ADMIN_1'::uuid, 'UUID_DO_ADMIN_2'::uuid))
with check (auth.uid() in ('UUID_DO_ADMIN_1'::uuid, 'UUID_DO_ADMIN_2'::uuid));
```
Repita a policy para cada tabela, ajustando o nome da tabela. Não publique UUIDs de usuários como informação pessoal sensível em páginas públicas; aqui eles são apenas parte da configuração de autorização.

## Notas
- A galeria desta versão guarda URLs de imagens. Para hospedar arquivos enviados diretamente, adicione o Supabase Storage e políticas de upload.
- Não há integração automática com a API do EA FC; estatísticas são registradas manualmente.
- Os nomes de clubes, atletas, ligas e marcas são propriedade dos respectivos titulares. O projeto é uma iniciativa independente de fã.

# portfolio-admin

Frontend do painel admin do portfólio. SPA estática em HTML/CSS/JS vanilla +
Bootstrap 5 (CDN), sem build — no padrão do ecossistema simple-vibe.

Fala com a API do backend (`portfolio-admin-api`) via JSON, na mesma origem
(servido pelo backend em `/`).

## Rodar local

Serve sozinho, mas precisa da API para funcionar:

```bash
# suba o backend (repo portfolio-admin-api) em http://127.0.0.1:8003
# e sirva este frontend em outra porta, ex.: 
npx serve .
# ou abra com um servidor estático qualquer
```

Aponte o `config.js` para a API:

```js
window.API_BASE = "http://127.0.0.1:8003";
```

(Lembre de configurar `CORS_ORIGINS` no `.env` do backend para o dev local.)

Em produção não precisa de nada: o backend serve estes arquivos a partir de
`static/` e o `config.js` com `API_BASE = ""` (relativo) resolve.

## Seções

- **Habilidades** — CRUD + ordenação.
- **Projetos** — CRUD com tecnologias e links, flag de publicado, ordenação.
- **Certificações** — CRUD + upload de PDF (converte em WebP no backend) + ordenação.
- **Conteúdo do site** — hero, sobre, contato/WhatsApp e redes sociais.
- **Publicar** — dispara a geração do `portfolio.json` + build, com histórico.

## Autenticação

Login por usuário/senha. O backend define um cookie de sessão HttpOnly e um
cookie CSRF; o `app.js` lê o CSRF do cookie e o envia no header `X-CSRF-Token`
em toda mutação. Nada de token no `localStorage`.

## Deploy

Os arquivos deste repo vão para `static/` do backend no servidor. Ver
`deploy/DEPLOY.md` do repo `portfolio-admin-api`.

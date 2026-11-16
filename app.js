/* Painel admin do portfolio — SPA vanilla, DOM seguro (textContent p/ dados). */
(function () {
  'use strict';

  const API = (window.API_BASE || '').replace(/\/$/, '');
  const CSRF_COOKIE = 'portfolio_admin_csrf';

  // ---------- util ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function csrf() {
    const m = document.cookie.match(new RegExp('(?:^|; )' + CSRF_COOKIE + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function toast(message, type) {
    let wrap = $('#toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toasts';
      wrap.className = 'toast-stack';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast-item ' + (type === 'error' ? 'toast-error' : 'toast-success');
    const icon = document.createElement('i');
    icon.className = 'bi ' + (type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle');
    const text = document.createElement('span');
    text.textContent = message;
    el.appendChild(icon);
    el.appendChild(text);
    wrap.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3600);
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    const method = (opts.method || 'GET').toUpperCase();
    const isMutation = !['GET', 'HEAD'].includes(method);
    if (opts.body !== undefined && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    if (isMutation) headers['X-CSRF-Token'] = csrf();
    const res = await fetch(API + path, {
      method, headers, body: opts.body, credentials: 'include'
    });
    if (res.status === 401) {
      let detail = 'nao-autenticado';
      try { const j = await res.json(); detail = j.detail || detail; } catch (e) { /* noop */ }
      if (path !== '/api/auth/login') showLogin();
      throw new Error(detail);
    }
    if (res.status === 403) throw new Error('sessao expirada; recarregue e entre de novo');
    if (!res.ok) {
      let detail = 'erro ' + res.status;
      try { const j = await res.json(); detail = j.detail || detail; } catch (e) { /* noop */ }
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ---------- autenticacao ----------
  const loginView = $('#login-view');
  const appView = $('#app-view');

  function showLogin() {
    loginView.hidden = false;
    appView.hidden = true;
  }
  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
  }

  async function checkAuth() {
    try {
      const me = await api('/api/auth/me');
      if (me && me.authenticated) {
        const name = me.username || 'admin';
        $('#user-name').textContent = name;
        $('#user-avatar').textContent = (name[0] || 'A').toUpperCase();
        showApp();
        renderPage(currentPage);
        return true;
      }
    } catch (e) { /* cai no showLogin */ }
    showLogin();
    return false;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#login-error');
    err.textContent = '';
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: { username: $('#login-username').value.trim(), password: $('#login-password').value }
      });
      showApp();
      await renderPage(currentPage);
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* noop */ }
    showLogin();
  });

  // ---------- navegacao ----------
  const pageTitles = {
    skills: 'Habilidades',
    projects: 'Projetos',
    certs: 'Certificações',
    site: 'Conteúdo do site',
    publish: 'Publicar'
  };
  const pageSubtitles = {
    skills: 'Gerencie as habilidades exibidas no portfólio.',
    projects: 'Gerencie os projetos em destaque.',
    certs: 'Gerencie os certificados e credenciais.',
    site: 'Edite hero, sobre, contato e redes sociais.',
    publish: 'Envie as mudanças para o site em produção.'
  };
  let currentPage = 'skills';

  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      currentPage = btn.dataset.page;
      $$('.nav-btn').forEach((b) => b.classList.toggle('active', b === btn));
      await renderPage(currentPage);
    });
  });

  async function renderPage(page) {
    $('#page-title').textContent = pageTitles[page] || '';
    $('#page-subtitle').textContent = pageSubtitles[page] || '';
    const content = $('#content');
    content.innerHTML = '';
    if (page === 'skills') await renderSkills(content);
    else if (page === 'projects') await renderProjects(content);
    else if (page === 'certs') await renderCerts(content);
    else if (page === 'site') renderSite(content);
    else if (page === 'publish') await renderPublish(content);
  }

  // ---------- modal generico ----------
  const modalEl = $('#generic-modal');
  const modal = new bootstrap.Modal(modalEl);
  let modalOnSave = null;

  function openModal(title, bodyHtml, onSave) {
    $('#generic-modal-title').textContent = title;
    $('#generic-modal-body').innerHTML = bodyHtml;
    modalOnSave = onSave;
    modal.show();
  }

  $('#generic-modal-save').addEventListener('click', async () => {
    if (!modalOnSave) return;
    const fn = modalOnSave;
    modalOnSave = null;
    try { await fn(); modal.hide(); } catch (e) { toast(e.message, 'error'); }
  });

  // ---------- helpers de lista ----------
  function panelHead(title, addLabel, onAdd) {
    const div = document.createElement('div');
    div.className = 'panel';
    const head = document.createElement('div');
    head.className = 'panel-head';
    const h = document.createElement('div');
    h.className = 'h6 fw-bold mb-0';
    h.textContent = title;
    head.appendChild(h);
    const add = document.createElement('button');
    add.className = 'btn btn-primary btn-sm';
    add.innerHTML = '<i class="bi bi-plus-lg"></i> ' + esc(addLabel);
    add.addEventListener('click', onAdd);
    head.appendChild(add);
    div.appendChild(head);
    return div;
  }

  function emptyNode(icon, title, text, ctaLabel, onCta) {
    const d = document.createElement('div');
    d.className = 'empty';
    const ic = document.createElement('div');
    ic.className = 'empty-icon';
    const i = document.createElement('i');
    i.className = 'bi ' + (icon || 'bi-inbox');
    ic.appendChild(i);
    const t = document.createElement('div');
    t.className = 'empty-title';
    t.textContent = title || 'Nada por aqui ainda';
    d.appendChild(ic);
    d.appendChild(t);
    if (text) {
      const tx = document.createElement('div');
      tx.className = 'empty-text';
      tx.textContent = text;
      d.appendChild(tx);
    }
    if (ctaLabel && onCta) {
      const b = document.createElement('button');
      b.className = 'btn btn-primary btn-sm mt-3';
      b.innerHTML = '<i class="bi bi-plus-lg"></i> ' + esc(ctaLabel);
      b.addEventListener('click', onCta);
      d.appendChild(b);
    }
    return d;
  }

  function rowActions(moveUp, moveDown, edit, del) {
    const box = document.createElement('div');
    box.className = 'd-flex gap-2';
    if (moveUp) {
      const b = document.createElement('button');
      b.className = 'btn-icon'; b.innerHTML = '<i class="bi bi-arrow-up"></i>';
      b.addEventListener('click', moveUp); box.appendChild(b);
    }
    if (moveDown) {
      const b = document.createElement('button');
      b.className = 'btn-icon'; b.innerHTML = '<i class="bi bi-arrow-down"></i>';
      b.addEventListener('click', moveDown); box.appendChild(b);
    }
    const e = document.createElement('button');
    e.className = 'btn-icon'; e.innerHTML = '<i class="bi bi-pencil"></i>';
    e.addEventListener('click', edit); box.appendChild(e);
    const d = document.createElement('button');
    d.className = 'btn-icon danger'; d.innerHTML = '<i class="bi bi-trash"></i>';
    d.addEventListener('click', del); box.appendChild(d);
    return box;
  }

  async function reorder(resource, ids) {
    await api('/api/' + resource + '/reorder', { method: 'POST', body: { ids: ids } });
  }

  // =====================================================
  // HABILIDADES
  // =====================================================
  async function renderSkills(root) {
    let skills = [];
    try { skills = await api('/api/skills'); } catch (e) { root.appendChild(emptyNode('bi-wifi-off', 'Erro ao carregar', 'Não foi possível conectar à API.')); return; }
    const panel = panelHead('Habilidades', 'Nova', () => openSkillModal(null));
    if (!skills.length) panel.appendChild(emptyNode('bi-stars', 'Nenhuma habilidade', 'Adicione a primeira habilidade para exibir no site.', 'Nova habilidade', () => openSkillModal(null)));
    skills.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const icon = document.createElement('div');
      icon.className = 'icon-box'; icon.innerHTML = '<i class="' + esc(s.icon) + '"></i>';
      item.appendChild(icon);
      const grow = document.createElement('div'); grow.className = 'grow';
      const t = document.createElement('div'); t.className = 'title'; t.textContent = s.title;
      const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = s.description;
      grow.appendChild(t); grow.appendChild(sub);
      item.appendChild(grow);
      item.appendChild(rowActions(
        i > 0 ? () => move(skills, i, -1) : null,
        i < skills.length - 1 ? () => move(skills, i, 1) : null,
        () => openSkillModal(s),
        () => removeSkill(s)
      ));
      panel.appendChild(item);

      async function move(list, idx, delta) {
        const j = idx + delta;
        const tmp = list[idx]; list[idx] = list[j]; list[j] = tmp;
        await reorder('skills', list.map((x) => String(x.id)));
        await renderSkills(root);
      }
    });
    root.appendChild(panel);
  }

  function openSkillModal(skill) {
    openModal(skill ? 'Editar habilidade' : 'Nova habilidade', `
      <div class="mb-3">
        <label class="form-label">Ícone (Font Awesome)</label>
        <input class="form-control" id="f-icon" value="${esc(skill ? skill.icon : '')}" placeholder="fa-solid fa-code">
      </div>
      <div class="mb-3">
        <label class="form-label">Título</label>
        <input class="form-control" id="f-title" value="${esc(skill ? skill.title : '')}">
      </div>
      <div class="mb-3">
        <label class="form-label">Descrição</label>
        <textarea class="form-control" id="f-desc" rows="3">${esc(skill ? skill.description : '')}</textarea>
      </div>
    `, async () => {
      const payload = { icon: $('#f-icon').value, title: $('#f-title').value, description: $('#f-desc').value };
      if (skill) await api('/api/skills/' + skill.id, { method: 'PUT', body: payload });
      else await api('/api/skills', { method: 'POST', body: payload });
      toast('Salvo');
      await renderPage('skills');
    });
  }

  async function removeSkill(skill) {
    if (!confirm('Excluir "' + skill.title + '"?')) return;
    await api('/api/skills/' + skill.id, { method: 'DELETE' });
    toast('Excluído');
    await renderPage('skills');
  }

  // =====================================================
  // PROJETOS
  // =====================================================
  async function renderProjects(root) {
    let projects = [];
    try { projects = await api('/api/projects'); } catch (e) { root.appendChild(emptyNode('bi-wifi-off', 'Erro ao carregar', 'Não foi possível conectar à API.')); return; }
    const panel = panelHead('Projetos', 'Novo', () => openProjectModal(null));
    if (!projects.length) panel.appendChild(emptyNode('bi-kanban', 'Nenhum projeto', 'Adicione o primeiro projeto em destaque.', 'Novo projeto', () => openProjectModal(null)));
    projects.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      if (p.image) {
        const thumb = document.createElement('img');
        thumb.className = 'thumb';
        thumb.src = API + '/uploads/projects/' + encodeURIComponent(p.image);
        thumb.alt = '';
        item.appendChild(thumb);
      } else {
        const icon = document.createElement('div');
        icon.className = 'icon-box'; icon.innerHTML = '<i class="' + esc(p.icon) + '"></i>';
        item.appendChild(icon);
      }
      const grow = document.createElement('div'); grow.className = 'grow';
      const t = document.createElement('div'); t.className = 'title';
      t.textContent = p.title;
      if (!p.published) { const off = document.createElement('span'); off.className = 'tag ms-2'; off.textContent = 'oculto'; t.appendChild(off); }
      grow.appendChild(t);
      const sub = document.createElement('div'); sub.className = 'sub';
      sub.textContent = p.description + (p.techs.length ? '  ·  ' + p.techs.join(', ') : '');
      grow.appendChild(sub);
      item.appendChild(grow);
      item.appendChild(rowActions(
        i > 0 ? () => moveProject(projects, i, -1) : null,
        i < projects.length - 1 ? () => moveProject(projects, i, 1) : null,
        () => openProjectModal(p),
        () => removeProject(p)
      ));
      panel.appendChild(item);

      async function moveProject(list, idx, delta) {
        const j = idx + delta;
        const tmp = list[idx]; list[idx] = list[j]; list[j] = tmp;
        await reorder('projects', list.map((x) => x.id));
        await renderProjects(root);
      }
    });
    root.appendChild(panel);
  }

  function linksRowsHtml(links) {
    return (links || []).map((l) => `
      <div class="link-row">
        <input class="form-control l-label" value="${esc(l.label)}" placeholder="Rótulo">
        <input class="form-control l-href" value="${esc(l.href)}" placeholder="https://...">
        <input class="form-control l-track" value="${esc(l.track)}" placeholder="track">
        <button type="button" class="btn-icon danger link-del"><i class="bi bi-x-lg"></i></button>
      </div>`).join('');
  }

  function openProjectModal(project) {
    const isEdit = !!project;
    const imgPreview = (project && project.image)
      ? '<div class="mb-2"><img class="thumb-lg" src="' + API + '/uploads/projects/' + encodeURIComponent(project.image) + '" alt="Imagem atual"></div>'
      : '';
    const imgHint = (project && project.image)
      ? 'Enviar outra imagem substitui a atual.'
      : 'Aparece no topo do card no site.';
    openModal(isEdit ? 'Editar projeto' : 'Novo projeto', `
      <div class="row">
        <div class="col-6 mb-3">
          <label class="form-label">Id (slug)</label>
          <input class="form-control" id="p-id" value="${esc(project ? project.id : '')}" ${isEdit ? 'readonly' : ''} placeholder="meu_projeto">
        </div>
        <div class="col-6 mb-3">
          <label class="form-label">Ícone</label>
          <input class="form-control" id="p-icon" value="${esc(project ? project.icon : '')}" placeholder="fa-solid fa-rocket">
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Título</label>
        <input class="form-control" id="p-title" value="${esc(project ? project.title : '')}">
      </div>
      <div class="mb-3">
        <label class="form-label">Descrição</label>
        <textarea class="form-control" id="p-desc" rows="3">${esc(project ? project.description : '')}</textarea>
      </div>
      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" id="p-pub" ${project && !project.published ? '' : 'checked'}>
        <label class="form-check-label" for="p-pub">Publicado no site</label>
      </div>
      <div class="mb-3">
        <label class="form-label">Tecnologias (separadas por vírgula)</label>
        <input class="form-control" id="p-techs" value="${esc((project ? project.techs : []).join(', '))}">
      </div>
      <div class="mb-1">
        <label class="form-label">Links</label>
        <div id="p-links">${linksRowsHtml(project ? project.links : [])}</div>
        <button type="button" class="btn btn-sm btn-outline-secondary" id="p-add-link"><i class="bi bi-plus"></i> Link</button>
      </div>
      <div class="mb-3 mt-3">
        <label class="form-label">Imagem do projeto (opcional)</label>
        ${imgPreview}
        <input type="file" class="form-control" id="p-file" accept="image/*">
        <div class="form-text text-muted mt-1">${imgHint}</div>
      </div>
    `, async () => {
      const links = $$('.link-row', $('#p-links')).map((row) => ({
        label: $('.l-label', row).value,
        href: $('.l-href', row).value,
        track: $('.l-track', row).value
      })).filter((l) => l.href);
      const payload = {
        id: $('#p-id').value.trim(),
        icon: $('#p-icon').value,
        title: $('#p-title').value,
        description: $('#p-desc').value,
        published: $('#p-pub').checked,
        techs: $('#p-techs').value.split(',').map((s) => s.trim()).filter(Boolean),
        links: links
      };
      if (isEdit) await api('/api/projects/' + project.id, { method: 'PUT', body: payload });
      else await api('/api/projects', { method: 'POST', body: payload });

      const fileInput = $('#p-file');
      if (fileInput && fileInput.files.length) {
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        await api('/api/projects/' + (isEdit ? project.id : $('#p-id').value.trim()) + '/image', { method: 'POST', body: fd });
        toast('Salvo com imagem');
      } else {
        toast('Salvo');
      }
      await renderPage('projects');
    });

    $('#p-add-link').addEventListener('click', () => {
      const d = document.createElement('div');
      d.className = 'link-row';
      d.innerHTML = `
        <input class="form-control l-label" placeholder="Rótulo">
        <input class="form-control l-href" placeholder="https://...">
        <input class="form-control l-track" placeholder="track">
        <button type="button" class="btn-icon danger link-del"><i class="bi bi-x-lg"></i></button>`;
      $('.link-del', d).addEventListener('click', () => d.remove());
      $('#p-links').appendChild(d);
    });
    $$('.link-del', $('#p-links')).forEach((b) => b.addEventListener('click', () => b.closest('.link-row').remove()));
  }

  async function removeProject(project) {
    if (!confirm('Excluir "' + project.title + '"?')) return;
    await api('/api/projects/' + project.id, { method: 'DELETE' });
    toast('Excluído');
    await renderPage('projects');
  }

  // =====================================================
  // CERTIFICAÇÕES
  // =====================================================
  async function renderCerts(root) {
    let certs = [];
    try { certs = await api('/api/certifications'); } catch (e) { root.appendChild(emptyNode('bi-wifi-off', 'Erro ao carregar', 'Não foi possível conectar à API.')); return; }
    const panel = panelHead('Certificações', 'Nova', () => openCertModal(null));
    if (!certs.length) panel.appendChild(emptyNode('bi-patch-check', 'Nenhuma certificação', 'Adicione seus certificados e credenciais.', 'Nova certificação', () => openCertModal(null)));
    certs.forEach((c, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const icon = document.createElement('div');
      icon.className = 'icon-box'; icon.innerHTML = '<i class="bi bi-patch-check"></i>';
      item.appendChild(icon);
      const grow = document.createElement('div'); grow.className = 'grow';
      const t = document.createElement('div'); t.className = 'title'; t.textContent = c.name;
      const sub = document.createElement('div'); sub.className = 'sub';
      sub.textContent = (c.issuer || '') + (c.year ? ' · ' + c.year : '') + (c.images.length ? ' · ' + c.images.length + ' página(s)' : ' · sem imagem');
      grow.appendChild(t); grow.appendChild(sub);
      item.appendChild(grow);

      const actions = document.createElement('div');
      actions.className = 'd-flex gap-2 align-items-center';
      const up = document.createElement('button'); up.className = 'btn-icon'; up.innerHTML = '<i class="bi bi-arrow-up"></i>';
      if (i > 0) up.addEventListener('click', () => moveCert(certs, i, -1));
      const down = document.createElement('button'); down.className = 'btn-icon'; down.innerHTML = '<i class="bi bi-arrow-down"></i>';
      if (i < certs.length - 1) down.addEventListener('click', () => moveCert(certs, i, 1));
      const upload = document.createElement('button'); upload.className = 'btn-icon'; upload.title = 'Enviar PDF';
      upload.innerHTML = '<i class="bi bi-file-earmark-arrow-up"></i>';
      upload.addEventListener('click', () => uploadCert(c));
      const edit = document.createElement('button'); edit.className = 'btn-icon'; edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.addEventListener('click', () => openCertModal(c));
      const del = document.createElement('button'); del.className = 'btn-icon danger'; del.innerHTML = '<i class="bi bi-trash"></i>';
      del.addEventListener('click', () => removeCert(c));
      [up, down, upload, edit, del].forEach((b) => actions.appendChild(b));
      item.appendChild(actions);
      panel.appendChild(item);

      async function moveCert(list, idx, delta) {
        const j = idx + delta;
        const tmp = list[idx]; list[idx] = list[j]; list[j] = tmp;
        await reorder('certifications', list.map((x) => x.id));
        await renderCerts(root);
      }
    });
    root.appendChild(panel);
  }

  function openCertModal(cert) {
    const isEdit = !!cert;
    const hasImg = cert && cert.images && cert.images.length;
    const fileHint = hasImg
      ? 'Já há ' + cert.images.length + ' página(s). Enviar um PDF aqui substitui a imagem atual.'
      : 'A galeria só mostra certificados com imagem. Pode enviar agora ou depois.';
    const previewHtml = hasImg
      ? '<div class="cert-previews mb-2">' +
          cert.images.map((im) => '<img class="cert-preview-img" src="' + API + '/uploads/certs/' + encodeURIComponent(im.filename) + '" alt="Página ' + (im.position + 1) + '">').join('') +
        '</div>'
      : '';
    openModal(isEdit ? 'Editar certificação' : 'Nova certificação', `
      <div class="row">
        <div class="col-6 mb-3">
          <label class="form-label">Id (slug)</label>
          <input class="form-control" id="c-id" value="${esc(cert ? cert.id : '')}" ${isEdit ? 'readonly' : ''} placeholder="0h2ll5ge">
        </div>
        <div class="col-6 mb-3">
          <label class="form-label">Ano</label>
          <input class="form-control" id="c-year" value="${esc(cert ? cert.year : '')}" placeholder="2026">
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Nome</label>
        <input class="form-control" id="c-name" value="${esc(cert ? cert.name : '')}">
      </div>
      <div class="row">
        <div class="col-6 mb-3">
          <label class="form-label">Emissor</label>
          <input class="form-control" id="c-issuer" value="${esc(cert ? cert.issuer : '')}" placeholder="DIO">
        </div>
        <div class="col-6 mb-3">
          <label class="form-label">Id da credencial</label>
          <input class="form-control" id="c-cred" value="${esc(cert ? cert.credential_id : '')}">
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">URL da credencial (opcional)</label>
        <input class="form-control" id="c-url" value="${esc(cert ? cert.url : '')}">
      </div>
      <div class="mb-3">
        <label class="form-label">Certificado (PDF)</label>
        ${previewHtml}
        <input type="file" class="form-control" id="c-file" accept="application/pdf">
        <div class="form-text text-muted mt-1">${fileHint}</div>
      </div>
    `, async () => {
      const payload = {
        id: $('#c-id').value.trim(),
        name: $('#c-name').value,
        issuer: $('#c-issuer').value,
        year: $('#c-year').value,
        credential_id: $('#c-cred').value,
        url: $('#c-url').value
      };
      const id = isEdit ? cert.id : $('#c-id').value.trim();
      if (isEdit) await api('/api/certifications/' + cert.id, { method: 'PUT', body: payload });
      else await api('/api/certifications', { method: 'POST', body: payload });

      const fileInput = $('#c-file');
      if (fileInput && fileInput.files.length) {
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        await api('/api/certifications/' + id + '/image', { method: 'POST', body: fd });
        toast('Salvo com imagem');
      } else {
        toast('Salvo');
      }
      await renderPage('certs');
    });
  }

  async function uploadCert(cert) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf';
    input.onchange = async () => {
      if (!input.files.length) return;
      const fd = new FormData();
      fd.append('file', input.files[0]);
      try {
        await api('/api/certifications/' + cert.id + '/image', { method: 'POST', body: fd });
        toast('Imagem gerada');
        await renderPage('certs');
      } catch (e) { toast(e.message, 'error'); }
    };
    input.click();
  }

  async function removeCert(cert) {
    if (!confirm('Excluir "' + cert.name + '"?')) return;
    await api('/api/certifications/' + cert.id, { method: 'DELETE' });
    toast('Excluído');
    await renderPage('certs');
  }

  // =====================================================
  // CONTEÚDO DO SITE
  // =====================================================
  function socialRowsHtml(social) {
    return (social || []).map((s) => `
      <div class="social-row">
        <input class="form-control s-label" value="${esc(s.label)}" placeholder="GitHub">
        <input class="form-control s-icon" value="${esc(s.icon)}" placeholder="fa-brands fa-github">
        <input class="form-control s-href" value="${esc(s.href)}" placeholder="https://...">
        <button type="button" class="btn-icon danger social-del"><i class="bi bi-x-lg"></i></button>
      </div>`).join('');
  }

  async function renderSite(root) {
    let site;
    try { site = await api('/api/site'); } catch (e) { root.appendChild(emptyNode('bi-wifi-off', 'Erro ao carregar', 'Não foi possível conectar à API.')); return; }
    site = site || {};
    const hero = site.hero || {};
    const about = site.about || {};
    const contact = site.contact || {};
    const social = site.social || [];

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head"><div class="h6 fw-bold mb-0">Conteúdo do site</div>
        <button class="btn btn-primary btn-sm" id="save-site"><i class="bi bi-check-lg"></i> Salvar</button></div>

      <h6 class="text-secondary fw-semibold mb-2 mt-3">Hero</h6>
      <div class="mb-3"><label class="form-label">Selo (greeting)</label>
        <input class="form-control" id="s-greeting" value="${esc(hero.greeting)}"></div>
      <div class="mb-3"><label class="form-label">Título (H1)</label>
        <input class="form-control" id="s-title" value="${esc(hero.title)}"></div>
      <div class="row">
        <div class="col-9 mb-3"><label class="form-label">Tagline</label>
          <input class="form-control" id="s-tagline" value="${esc(hero.tagline)}"></div>
        <div class="col-3 mb-3"><label class="form-label">Palavra em destaque</label>
          <input class="form-control" id="s-tagline-hl" value="${esc(hero.tagline_highlight)}" placeholder="Pixel."></div>
      </div>
      <div class="mb-3"><label class="form-label">Descrição</label>
        <textarea class="form-control" id="s-desc" rows="3">${esc(hero.description)}</textarea></div>

      <h6 class="text-secondary fw-semibold mb-2 mt-3">Sobre</h6>
      <div class="mb-3"><label class="form-label">Eyebrow</label>
        <input class="form-control" id="s-eyebrow" value="${esc(about.eyebrow)}"></div>
      <div class="row">
        <div class="col-9 mb-3"><label class="form-label">Título</label>
          <input class="form-control" id="s-about-title" value="${esc(about.title)}"></div>
        <div class="col-3 mb-3"><label class="form-label">Destaques (vírgula)</label>
          <input class="form-control" id="s-about-hl" value="${esc((about.title_highlights || []).join(', '))}" placeholder="Resultados, Reais"></div>
      </div>
      <div class="mb-3"><label class="form-label">Parágrafos (um por linha)</label>
        <textarea class="form-control" id="s-about-paras" rows="4">${esc((about.paragraphs || []).join('\n'))}</textarea></div>
      <div class="mb-3"><label class="form-label">URL do currículo</label>
        <input class="form-control" id="s-resume" value="${esc(about.resume_url)}"></div>

      <h6 class="text-secondary fw-semibold mb-2 mt-3">Contato</h6>
      <div class="row">
        <div class="col-9 mb-3"><label class="form-label">Título</label>
          <input class="form-control" id="s-contact-title" value="${esc(contact.title)}"></div>
        <div class="col-3 mb-3"><label class="form-label">Destaque</label>
          <input class="form-control" id="s-contact-hl" value="${esc(contact.title_highlight)}" placeholder="Conectar?"></div>
      </div>
      <div class="mb-3"><label class="form-label">Descrição</label>
        <textarea class="form-control" id="s-contact-desc" rows="2">${esc(contact.description)}</textarea></div>
      <div class="row">
        <div class="col-7 mb-3"><label class="form-label">WhatsApp (número, E.164 sem +)</label>
          <input class="form-control" id="s-whats" value="${esc(contact.whatsapp_number)}" placeholder="5524998574876"></div>
        <div class="col-5 mb-3"><label class="form-label">WhatsApp (exibição)</label>
          <input class="form-control" id="s-whats-display" value="${esc(contact.whatsapp_display)}" placeholder="(24) 99857-4876"></div>
      </div>

      <h6 class="text-secondary fw-semibold mb-2 mt-3">Redes sociais</h6>
      <div id="s-social">${socialRowsHtml(social)}</div>
      <button type="button" class="btn btn-sm btn-outline-secondary" id="s-add-social"><i class="bi bi-plus"></i> Rede</button>
    `;
    root.appendChild(panel);

    $('#save-site').addEventListener('click', async () => {
      const socialData = $$('.social-row', $('#s-social')).map((row) => ({
        label: $('.s-label', row).value,
        icon: $('.s-icon', row).value,
        href: $('.s-href', row).value,
        track: ''
      })).filter((s) => s.href);
      const payload = {
        hero: {
          greeting: $('#s-greeting').value,
          title: $('#s-title').value,
          tagline: $('#s-tagline').value,
          tagline_highlight: $('#s-tagline-hl').value,
          description: $('#s-desc').value
        },
        about: {
          eyebrow: $('#s-eyebrow').value,
          title: $('#s-about-title').value,
          title_highlights: $('#s-about-hl').value.split(',').map((s) => s.trim()).filter(Boolean),
          paragraphs: $('#s-about-paras').value.split('\n').map((s) => s.trim()).filter(Boolean),
          resume_url: $('#s-resume').value
        },
        contact: {
          title: $('#s-contact-title').value,
          title_highlight: $('#s-contact-hl').value,
          description: $('#s-contact-desc').value,
          whatsapp_number: $('#s-whats').value,
          whatsapp_display: $('#s-whats-display').value
        },
        social: socialData
      };
      try {
        await api('/api/site', { method: 'PUT', body: payload });
        toast('Salvo');
      } catch (e) { toast(e.message, 'error'); }
    });

    $('#s-add-social').addEventListener('click', () => {
      const d = document.createElement('div');
      d.className = 'social-row';
      d.innerHTML = `
        <input class="form-control s-label" placeholder="GitHub">
        <input class="form-control s-icon" placeholder="fa-brands fa-github">
        <input class="form-control s-href" placeholder="https://...">
        <button type="button" class="btn-icon danger social-del"><i class="bi bi-x-lg"></i></button>`;
      $('.social-del', d).addEventListener('click', () => d.remove());
      $('#s-social').appendChild(d);
    });
    $$('.social-del', $('#s-social')).forEach((b) => b.addEventListener('click', () => b.closest('.social-row').remove()));
  }

  // =====================================================
  // PUBLICAR
  // =====================================================
  async function renderPublish(root) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head"><div class="h6 fw-bold mb-0">Publicar no site</div></div>
      <p class="text-muted small mb-3">Gera o <code>portfolio.json</code> a partir do que está salvo aqui,
      envia para o repositório do portfólio e dispara o build (GitHub Actions → Netlify).</p>
      <button class="btn btn-primary" id="btn-publish"><i class="bi bi-rocket-takeoff"></i> Publicar agora</button>
      <div id="publish-status" class="publish-status mt-3"></div>
      <h6 class="text-secondary fw-semibold mt-4 mb-2">Histórico</h6>
      <div id="publish-history"></div>
    `;
    root.appendChild(panel);

    $('#btn-publish').addEventListener('click', async () => {
      const status = $('#publish-status');
      status.textContent = 'Publicando…';
      try {
        const r = await api('/api/publish', { method: 'POST' });
        status.innerHTML = '<span class="ok"><i class="bi bi-check-circle"></i> Publicado!</span> ' +
          '<span class="text-muted small">commit ' + esc(r.commit_sha) + '</span>';
        await loadPublishHistory();
      } catch (e) {
        status.innerHTML = '<span class="err"><i class="bi bi-x-circle"></i> ' + esc(e.message) + '</span>';
      }
    });

    async function loadPublishHistory() {
      const data = await api('/api/publish/status');
      const box = $('#publish-history');
      box.innerHTML = '';
      if (!data.history.length) { box.innerHTML = '<div class="empty"><div class="empty-icon"><i class="bi bi-rocket-takeoff"></i></div><div class="empty-title">Nenhuma publicação ainda</div><div class="empty-text">Clique em "Publicar agora" para enviar as mudanças ao site.</div></div>'; return; }
      data.history.forEach((h) => {
        const d = document.createElement('div');
        d.className = 'list-item';
        const st = document.createElement('div');
        st.className = 'icon-box';
        st.innerHTML = h.status === 'ok' ? '<i class="bi bi-check-circle ok"></i>' : '<i class="bi bi-x-circle err"></i>';
        d.appendChild(st);
        const grow = document.createElement('div'); grow.className = 'grow';
        const t = document.createElement('div'); t.className = 'title';
        t.textContent = h.status === 'ok' ? 'Publicado' : 'Erro';
        grow.appendChild(t);
        const sub = document.createElement('div'); sub.className = 'sub';
        sub.textContent = (h.at || '').replace('T', ' ').slice(0, 19) + (h.commit_sha ? ' · ' + h.commit_sha.slice(0, 7) : '');
        if (h.error) { const err = document.createElement('div'); err.className = 'sub err'; err.textContent = h.error; grow.appendChild(err); }
        grow.appendChild(sub);
        d.appendChild(grow);
        box.appendChild(d);
      });
    }
    await loadPublishHistory();
  }

  // ---------- boot ----------
  async function checkHealth() {
    const badge = $('#api-status');
    try {
      const r = await fetch(API + '/health', { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        badge.className = 'badge rounded-pill bg-success-subtle text-success border';
        badge.textContent = 'API online';
        return;
      }
    } catch (e) { /* noop */ }
    badge.className = 'badge rounded-pill bg-danger-subtle text-danger border';
    badge.textContent = 'API offline';
  }

  checkHealth();
  checkAuth();
})();

'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const currency = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = value => value ? new Date(String(value).replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const orderNo = id => `#${String(id).padStart(5, '0')}`;
const labels = { pendente: 'Pendente', preparo: 'Em preparo', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };
const nextStatus = { pendente: 'preparo', preparo: 'enviado', enviado: 'entregue' };
const statusBadge = status => `<span class="badge ${esc(status)}"><span></span>${esc(labels[status] || status)}</span>`;
const paths = {
  box: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="18" width="7" height="3" rx="1"/>',
  orders: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
  logout: '<path d="M9 21H4V3h5M9 12h12m-4-4 4 4-4 4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
  print: '<path d="M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v8H6zM17 12h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
let csrf = '', currentUser;
async function api(url, options = {}) {
  const response = await fetch(`/api${url}`, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...options.headers } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && document.body.dataset.page !== 'login') location.assign('/login');
    throw new Error(data.error || 'Não foi possível concluir a operação.');
  }
  return data;
}
function toast(message, error = false) {
  const element = document.createElement('div');
  element.className = `toast${error ? ' error' : ''}`;
  element.setAttribute('role', error ? 'alert' : 'status');
  element.textContent = message;
  $('#notifications').append(element);
  setTimeout(() => element.remove(), 5500);
}
async function busy(button, work) {
  if (button.disabled) return;
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try { await work(); } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
function debounce(fn, delay = 250) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
function shell(page) {
  const links = [['dashboard', '/', 'dashboard', 'Dashboard'], ['pedidos', '/pedidos', 'orders', 'Pedidos'], ['novo-pedido', '/novo-pedido', 'plus', 'Novo pedido'], ['clientes', '/clientes', 'users', 'Clientes'], ['produtos', '/produtos', 'box', 'Produtos']];
  $('#app').innerHTML = `<button class="sidebar-overlay" aria-label="Fechar menu"></button><aside class="sidebar"><a href="/" class="brand"><span class="brand-icon">${icon('box')}</span>pedido<span class="brand-dot">.</span></a><div class="workspace"><span class="workspace-avatar">CP</span><div><strong>Controle de pedidos</strong><small>Seu espaço de gestão</small></div><span class="workspace-dot"></span></div><div class="nav-label">PRINCIPAL</div><nav aria-label="Menu principal">${links.map(([id, url, glyph, label]) => `<a href="${url}" class="nav-item ${page === id ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${page === id ? '<span class="nav-dot"></span>' : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note">${icon('check')}<div><strong>Tudo sob controle.</strong><p>Mais organização para o seu dia.</p></div></div><div class="user"><span class="avatar">${esc(currentUser.nome.slice(0, 2).toUpperCase())}</span><div><strong>${esc(currentUser.nome)}</strong><small>${currentUser.perfil === 'admin' ? 'Administrador' : 'Operador'}</small></div><button id="logout" class="icon-button" aria-label="Sair">${icon('logout')}</button></div></div></aside><div class="main-wrap"><header class="topbar"><div class="breadcrumb"><button id="menu-toggle" class="icon-button mobile-menu" aria-label="Abrir menu" aria-expanded="false">${icon('menu')}</button><span>Meu negócio</span><span class="slash">/</span><strong>${links.find(link => link[0] === page)?.[3] || 'Dashboard'}</strong></div><div class="topbar-right"><span class="live-dot"></span><span>Área de gestão</span><span class="top-date">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div></header><main id="content"></main><footer>Pedido · Gestão simples, negócio em movimento.<span>Feito para o seu dia a dia</span></footer></div><div id="notifications" aria-live="polite"></div><dialog id="modal"><div id="modal-body"></div></dialog>`;
  const toggleMenu = open => { document.body.classList.toggle('menu-open', open); $('#menu-toggle').setAttribute('aria-expanded', String(open)); };
  $('#menu-toggle').onclick = () => toggleMenu(!document.body.classList.contains('menu-open'));
  $('.sidebar-overlay').onclick = () => toggleMenu(false);
  $('#logout').onclick = event => busy(event.currentTarget, async () => { await api('/logout', { method: 'POST' }); location.assign('/login'); });
  $('#modal').addEventListener('click', event => { if (event.target === $('#modal')) $('#modal').close(); });
}
function heading(eyebrow, title, subtitle, action = '') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
const newOrderLink = `<a class="button primary" href="/novo-pedido">${icon('plus')}Novo pedido</a>`;
function orderRows(rows) {
  return rows.length ? rows.map(order => `<tr><td><button class="order-link" data-order="${order.id}">${orderNo(order.id)}</button></td><td><span class="table-person"><span class="mini-avatar">${esc(order.cliente_nome.slice(0, 1).toUpperCase())}</span>${esc(order.cliente_nome)}</span></td><td class="muted nowrap">${date(order.criado_em)}</td><td>${statusBadge(order.status)}</td><td class="money">${currency(order.total)}</td><td><button class="icon-button" data-order="${order.id}" aria-label="Ver pedido ${order.id}">${icon('arrow')}</button></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty">Nenhum pedido por aqui.<small>Crie um pedido para começar a acompanhar suas vendas.</small></div></td></tr>';
}
function ordersTable(rows) { return `<div class="table-scroll"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Data e hora</th><th>Status</th><th>Valor total</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${orderRows(rows)}</tbody></table></div>`; }
function bindOrders(root = document) { $$('[data-order]', root).forEach(button => button.onclick = () => showOrder(button.dataset.order).catch(error => toast(error.message, true))); }
async function dashboard() {
  const data = await api('/dashboard');
  const cards = [
    ['money', 'Faturamento do mês', currency(data.faturamento_mes), 'Pedidos não cancelados neste mês', 'green'],
    ['orders', 'Pedidos hoje', String(data.pedidos_hoje).padStart(2, '0'), 'Recebidos ao longo do dia', 'blue'],
    ['clock', 'Pedidos pendentes', String(data.pendentes).padStart(2, '0'), 'Aguardando início do preparo', 'amber'],
    ['box', 'Estoque baixo', String(data.estoque_baixo).padStart(2, '0'), `Produtos com até ${data.limite_estoque} unidades`, 'rose']
  ];
  $('#content').innerHTML = heading('VISÃO GERAL', 'Seu negócio, em um só lugar.', 'Acompanhe os pedidos e veja como está a sua operação.', newOrderLink) + `<section class="metric-grid" aria-label="Indicadores">${cards.map(([glyph, label, value, note, color]) => `<article class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon ${color}">${icon(glyph)}</span></div><strong class="metric-value">${value}</strong><div class="metric-note"><span class="tiny-dot ${color}"></span>${note}</div></article>`).join('')}</section><section class="overview-banner"><div class="banner-symbol">${icon('orders')}</div><div><span class="eyebrow">CADA PEDIDO IMPORTA</span><h2>Da primeira venda à última entrega.</h2><p>Organize seus pedidos e mantenha o próximo passo sempre à vista.</p></div><a href="/pedidos" class="button light">Acompanhar pedidos ${icon('arrow')}</a><div class="banner-decoration" aria-hidden="true"></div></section><section class="panel"><div class="panel-heading"><div><h2>Últimos pedidos <span class="count">${data.ultimos.length}</span></h2><p>As movimentações mais recentes do seu negócio.</p></div><a class="text-link" href="/pedidos">Ver todos ${icon('arrow')}</a></div>${ordersTable(data.ultimos)}<div class="panel-footer"><span class="live-dot"></span>Dados atualizados ao abrir esta página<button class="text-link" id="refresh-dashboard">Atualizar</button></div></section><div class="quick-grid"><a href="/clientes" class="quick-card"><span class="quick-icon">${icon('users')}</span><div><strong>Seus clientes</strong><p>Boas relações começam com organização.</p></div>${icon('arrow')}</a><a href="/produtos" class="quick-card"><span class="quick-icon">${icon('box')}</span><div><strong>Produtos e estoque</strong><p>Prepare seu catálogo para a próxima venda.</p></div>${icon('arrow')}</a></div>`;
  bindOrders(); $('#refresh-dashboard').onclick = event => busy(event.currentTarget, dashboard);
}
function showModal(title, subtitle, content, wide = false) {
  const dialog = $('#modal'); dialog.classList.toggle('wide', wide);
  $('#modal-body').innerHTML = `<div class="modal-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button" id="close-modal" aria-label="Fechar">${icon('close')}</button></div>${content}`;
  $('#close-modal').onclick = () => dialog.close();
  if (!dialog.open) dialog.showModal();
}
async function catalog(entity) {
  const client = entity === 'clientes';
  let rows = [], request = 0;
  $('#content').innerHTML = heading('CADASTROS', client ? 'Clientes' : 'Produtos', client ? 'Quem faz parte da história do seu negócio.' : 'Seu catálogo organizado. Seu estoque em dia.', `<button class="button primary" id="new-record">${icon('plus')}${client ? 'Novo cliente' : 'Novo produto'}</button>`) + `<section class="panel"><div class="filter-bar"><label class="search-field">${icon('search')}<input id="search" type="search" aria-label="Buscar ${entity}" placeholder="${client ? 'Buscar por nome ou telefone…' : 'Buscar por nome ou SKU…'}"></label><select id="active-filter" aria-label="Filtrar situação"><option value="">Todas as situações</option><option value="1">Ativos</option><option value="0">Inativos</option></select><span class="muted" id="result-count"></span></div><div id="catalog-table"></div><div class="panel-footer">Os registros desativados permanecem no histórico. Até 500 resultados por busca.</div></section>`;
  async function load() {
    const version = ++request;
    const result = await api(`/${entity}?${new URLSearchParams({ q: $('#search').value, ativo: $('#active-filter').value })}`);
    if (version !== request) return;
    rows = result;
    $('#result-count').textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'}`;
    $('#catalog-table').innerHTML = `<div class="table-scroll"><table><thead><tr>${(client ? ['Nome', 'Telefone', 'Endereço', 'Situação', 'Ações'] : ['Produto', 'SKU', 'Preço', 'Estoque', 'Situação', 'Ações']).map(label => `<th>${label}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr class="${row.ativo ? '' : 'inactive-row'}"><td><strong>${esc(row.nome)}</strong></td>${client ? `<td class="nowrap">${esc(row.tel)}</td><td class="address-cell">${esc(row.endereco)}</td>` : `<td><span class="sku">${esc(row.sku)}</span></td><td class="money">${currency(row.preco)}</td><td><span class="stock-number">${row.estoque}</span> <span class="muted">un.</span></td>`}<td><span class="badge ${row.ativo ? 'entregue' : 'neutral'}"><span></span>${row.ativo ? 'Ativo' : 'Inativo'}</span></td><td><div class="row-actions"><button class="icon-button" data-edit="${row.id}" aria-label="Editar ${esc(row.nome)}">${icon('edit')}</button><button class="small-button" data-toggle="${row.id}">${row.ativo ? 'Desativar' : 'Reativar'}</button></div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty">Nenhum registro encontrado.<small>Altere a busca ou adicione um novo cadastro.</small></div></td></tr>`}</tbody></table></div>`;
    $$('[data-edit]').forEach(button => button.onclick = () => edit(rows.find(row => row.id === Number(button.dataset.edit))));
    $$('[data-toggle]').forEach(button => button.onclick = () => {
      const row = rows.find(row => row.id === Number(button.dataset.toggle));
      showModal(`${row.ativo ? 'Desativar' : 'Reativar'} ${client ? 'cliente' : 'produto'}?`, row.nome, `<p>${row.ativo ? 'O cadastro deixará de aparecer em novos pedidos. O histórico será preservado.' : 'O cadastro ficará disponível para novos pedidos.'}</p><div class="form-actions"><button class="button secondary" id="cancel-toggle">Voltar</button><button class="button primary" id="confirm-toggle">Confirmar</button></div>`);
      $('#cancel-toggle').onclick = () => $('#modal').close();
      $('#confirm-toggle').onclick = event => busy(event.currentTarget, async () => { await api(`/${entity}/${row.id}/ativo`, { method: 'PATCH', body: JSON.stringify({ ativo: !row.ativo }) }); $('#modal').close(); toast('Situação atualizada.'); await load(); });
    });
  }
  function edit(row = {}) {
    showModal(`${row.id ? 'Editar' : 'Novo'} ${client ? 'cliente' : 'produto'}`, 'Preencha os dados abaixo. Todos os campos são obrigatórios.', `<form id="record-form"><label>Nome<input name="nome" required maxlength="${client ? 120 : 160}" value="${esc(row.nome)}" autocomplete="off"></label>${client ? `<label>Telefone<input name="tel" type="tel" required minlength="8" maxlength="25" value="${esc(row.tel)}" autocomplete="tel"></label><label>Endereço completo<textarea name="endereco" required maxlength="500" rows="3" autocomplete="street-address">${esc(row.endereco)}</textarea></label>` : `<label>SKU / código<input name="sku" required maxlength="60" value="${esc(row.sku)}"></label><div class="form-grid"><label>Preço (R$)<input name="preco" type="number" min="0.01" max="9999999999.99" step="0.01" required value="${esc(row.preco)}"></label><label>Estoque (unidades)<input name="estoque" type="number" min="0" max="2147483647" step="1" required value="${esc(row.estoque ?? 0)}"></label></div>`}<p class="form-error" id="form-error" role="alert"></p><div class="form-actions"><button class="button secondary" type="button" id="cancel-edit">Cancelar</button><button class="button primary" type="submit">Salvar ${client ? 'cliente' : 'produto'}</button></div></form>`);
    $('#cancel-edit').onclick = () => $('#modal').close();
    $('#record-form').onsubmit = event => {
      event.preventDefault(); const form = event.currentTarget, button = $('[type="submit"]', form);
      busy(button, async () => {
        $('#form-error').textContent = '';
        const payload = Object.fromEntries(new FormData(form));
        if (!client && row.id) payload.estoque_anterior = row.estoque;
        try { await api(`/${entity}${row.id ? `/${row.id}` : ''}`, { method: row.id ? 'PUT' : 'POST', body: JSON.stringify(payload) }); }
        catch (error) { $('#form-error').textContent = error.message; return; }
        $('#modal').close(); toast('Cadastro salvo com sucesso.'); await load();
      });
    };
  }
  $('#new-record').onclick = () => edit();
  const reload = () => load().catch(error => toast(error.message, true));
  $('#search').oninput = debounce(reload); $('#active-filter').onchange = reload;
  await load();
}
async function orders() {
  let page = 1, version = 0;
  $('#content').innerHTML = heading('OPERAÇÃO', 'Pedidos', 'Acompanhe cada etapa, do recebimento à entrega.', newOrderLink) + `<section class="panel"><form class="filter-bar" id="order-filters"><label>Status<select name="status"><option value="">Todos os status</option>${Object.entries(labels).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><label>De<input type="date" name="de"></label><label>Até<input type="date" name="ate"></label><button class="button secondary" type="submit">${icon('search')}Filtrar</button><button class="text-link" type="reset">Limpar</button></form><div id="orders-table"></div><div class="pagination"><span id="page-info" class="muted"></span><div><button class="small-button" id="previous">Anterior</button><button class="small-button" id="next">Próxima</button></div></div></section>`;
  async function load() {
    const current = ++version;
    const params = new URLSearchParams(new FormData($('#order-filters'))); params.set('page', page);
    const data = await api(`/pedidos?${params}`);
    if (current !== version) return;
    $('#orders-table').innerHTML = ordersTable(data.rows); bindOrders($('#orders-table'));
    $('#page-info').textContent = `${data.total} pedidos · Página ${data.page} de ${data.pages}`;
    $('#previous').disabled = page <= 1; $('#next').disabled = page >= data.pages;
  }
  const reload = () => load().catch(error => toast(error.message, true));
  $('#order-filters').onsubmit = event => { event.preventDefault(); page = 1; reload(); };
  $('#order-filters').onreset = () => { page = 1; setTimeout(reload, 0); };
  $('#previous').onclick = () => { page--; reload(); }; $('#next').onclick = () => { page++; reload(); };
  document.addEventListener('order-updated', reload);
  await load();
}
async function showOrder(id) {
  const order = await api(`/pedidos/${id}`);
  const next = nextStatus[order.status];
  showModal(`Pedido ${orderNo(order.id)}`, `Criado em ${date(order.criado_em)}`, `<div class="order-detail"><div class="detail-status">${statusBadge(order.status)}<span class="muted">Atualizado em ${date(order.atualizado_em)}</span></div><div class="customer-detail"><span class="eyebrow">CLIENTE E ENTREGA</span><h3>${esc(order.cliente_nome)}</h3><p>${esc(order.cliente_tel)}</p><p>${esc(order.cliente_endereco)}</p></div><div class="table-scroll"><table><thead><tr><th>Produto</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${order.itens.map(item => `<tr><td><strong>${esc(item.nome)}</strong><small class="muted block">${esc(item.sku)}</small></td><td>${item.qtd}</td><td class="nowrap">${currency(item.preco)}</td><td class="money nowrap">${currency(Math.round(Number(item.preco) * 100) * item.qtd / 100)}</td></tr>`).join('')}</tbody></table></div><div class="order-total"><span>Total do pedido</span><strong>${currency(order.total)}</strong></div><div class="form-error" id="status-error" role="alert"></div><div class="form-actions print-hide"><button id="print-order" class="button secondary">${icon('print')}Imprimir</button>${next ? `<button id="cancel-order" class="button danger">Cancelar pedido</button><button id="advance-order" class="button primary">${icon('check')}${labels[next]}</button>` : ''}</div></div>`, true);
  $('#print-order').onclick = () => window.print();
  async function update(status, button) {
    await busy(button, async () => {
      try { await api(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
      catch (error) { $('#status-error').textContent = error.message; return; }
      toast('Status do pedido atualizado.'); document.dispatchEvent(new Event('order-updated')); await showOrder(id);
      if (document.body.dataset.page === 'dashboard') await dashboard();
    });
  }
  if (next) {
    $('#advance-order').onclick = event => update(next, event.currentTarget);
    $('#cancel-order').onclick = event => {
      const button = event.currentTarget;
      if (button.dataset.confirmed) return update('cancelado', button);
      button.dataset.confirmed = '1'; button.textContent = 'Confirmar cancelamento';
      $('#status-error').textContent = 'Ao confirmar, o estoque dos itens será devolvido.';
    };
  }
}
async function newOrder() {
  let selectedClient = null, selectedProduct = null, cart = [], submitting = false;
  $('#content').innerHTML = heading('VENDAS', 'Novo pedido', 'Uma nova venda começa aqui. Vamos montar seu pedido.') + `<div class="order-layout"><div class="order-steps"><section class="panel step-panel"><div class="step-heading"><span class="step-number">01</span><div><h2>Quem é o cliente?</h2><p>Busque pelo nome ou telefone para selecionar.</p></div><a href="/clientes" class="text-link">Cadastrar cliente ${icon('arrow')}</a></div><label class="search-field">${icon('search')}<input id="client-search" type="search" placeholder="Buscar cliente…" aria-label="Buscar cliente" autocomplete="off"></label><div id="client-results" class="search-results"></div><div id="selected-client"></div></section><section class="panel step-panel"><div class="step-heading"><span class="step-number">02</span><div><h2>O que vai no pedido?</h2><p>Escolha os produtos e informe a quantidade.</p></div></div><label class="search-field">${icon('search')}<input id="product-search" type="search" placeholder="Buscar produto por nome ou SKU…" aria-label="Buscar produto" autocomplete="off"></label><div id="product-results" class="search-results"></div><form id="add-item" class="add-item"><div id="product-choice" class="muted">Selecione um produto acima.</div><label>Quantidade<input id="quantity" type="number" min="1" max="1000000" step="1" value="1" required></label><button class="button secondary" id="add-product" disabled>${icon('plus')}Adicionar</button></form><div id="cart-table"></div></section></div><aside class="panel order-summary"><div class="eyebrow">QUASE TUDO PRONTO</div><h2>Resumo do pedido</h2><div class="summary-illustration">${icon('orders')}</div><p id="summary-count" class="muted">Nenhum item adicionado</p><div class="summary-row"><span>Subtotal</span><strong id="subtotal">${currency(0)}</strong></div><div class="summary-total"><span>Total do pedido</span><strong id="total">${currency(0)}</strong></div><button class="button primary" id="finish-order" disabled>Finalizar pedido ${icon('arrow')}</button><p class="summary-note">${icon('check')}O estoque é atualizado ao finalizar.</p><div id="checkout-error" class="form-error" role="alert"></div></aside></div>`;
  const canFinish = () => { $('#finish-order').disabled = submitting || !selectedClient || !cart.length; };
  function renderCart() {
    const total = cart.reduce((sum, item) => sum + Math.round(Number(item.preco) * 100) * item.qtd, 0) / 100;
    $('#cart-table').innerHTML = cart.length ? `<div class="table-scroll cart"><table><thead><tr><th>Produto</th><th>Qtd.</th><th>Subtotal</th><th></th></tr></thead><tbody>${cart.map(item => `<tr><td><strong>${esc(item.nome)}</strong><small class="block muted">${currency(item.preco)} / un.</small></td><td><input type="number" class="cart-qty" data-qty="${item.id}" value="${item.qtd}" min="1" max="${item.estoque}" aria-label="Quantidade de ${esc(item.nome)}"></td><td class="money nowrap">${currency(Math.round(Number(item.preco) * 100) * item.qtd / 100)}</td><td><button class="icon-button" data-remove="${item.id}" aria-label="Remover ${esc(item.nome)}">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty cart-empty">${icon('box')}<strong>Seu pedido está começando.</strong><small>Adicione o primeiro produto para montar a lista.</small></div>`;
    $('#subtotal').textContent = $('#total').textContent = currency(total);
    const count = cart.reduce((sum, item) => sum + item.qtd, 0);
    $('#summary-count').textContent = `${count} unidade${count === 1 ? '' : 's'} · ${cart.length} produto${cart.length === 1 ? '' : 's'}`;
    $$('[data-remove]').forEach(button => button.onclick = () => { cart = cart.filter(item => item.id !== Number(button.dataset.remove)); renderCart(); });
    $$('[data-qty]').forEach(input => input.onchange = () => {
      const item = cart.find(item => item.id === Number(input.dataset.qty)), qty = Number(input.value);
      if (!Number.isInteger(qty) || qty < 1) toast('Informe uma quantidade válida.', true);
      else if (qty > item.estoque) toast('Estoque insuficiente', true);
      else item.qtd = qty;
      renderCart();
    }); canFinish();
  }
  function search(kind) {
    let version = 0;
    const input = $(`#${kind}-search`), output = $(`#${kind}-results`);
    input.oninput = () => {
      const request = ++version; output.innerHTML = '';
      if (kind === 'client') { selectedClient = null; $('#selected-client').innerHTML = ''; canFinish(); }
      else { selectedProduct = null; $('#add-product').disabled = true; $('#product-choice').textContent = 'Selecione um produto acima.'; }
      const query = input.value.trim(); if (!query) return;
      delayed(query, request);
    };
    const delayed = debounce(async (query, request) => {
      try {
        const rows = await api(`/${kind === 'client' ? 'clientes' : 'produtos'}?ativo=1&q=${encodeURIComponent(query)}`);
        if (request !== version) return;
        const visible = rows.slice(0, 15);
        output.innerHTML = visible.length ? visible.map(row => `<button type="button" class="search-result" data-result="${row.id}"><span><strong>${esc(row.nome)}</strong><small>${esc(kind === 'client' ? row.tel : row.sku)}</small></span><span>${kind === 'client' ? icon('plus') : `${currency(row.preco)}<small>${row.estoque} em estoque</small>`}</span></button>`).join('') : '<p class="muted search-empty">Nenhum resultado ativo encontrado.</p>';
        $$('[data-result]', output).forEach(button => button.onclick = () => {
          const row = visible.find(row => row.id === Number(button.dataset.result)); output.innerHTML = ''; input.value = row.nome;
          if (kind === 'client') {
            selectedClient = row;
            $('#selected-client').innerHTML = `<div class="selected-client"><span class="mini-avatar">${icon('check')}</span><div><strong>${esc(row.nome)}</strong><p>${esc(row.tel)} · ${esc(row.endereco)}</p></div></div>`;
            canFinish();
          } else {
            selectedProduct = row; $('#quantity').max = Math.min(row.estoque, 1000000); $('#quantity').value = 1;
            $('#product-choice').innerHTML = `<strong>${esc(row.nome)}</strong><small class="block">${currency(row.preco)} · ${row.estoque} disponíveis</small>`;
            $('#add-product').disabled = row.estoque < 1;
          }
        });
      } catch (error) { toast(error.message, true); }
    });
  }
  search('client'); search('product');
  $('#add-item').noValidate = true;
  $('#add-item').onsubmit = event => {
    event.preventDefault(); if (!selectedProduct) return;
    const qty = Number($('#quantity').value), existing = cart.find(item => item.id === selectedProduct.id);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) return toast('Informe uma quantidade válida.', true);
    if (qty + (existing?.qtd || 0) > selectedProduct.estoque) return toast('Estoque insuficiente', true);
    if (existing) { existing.qtd += qty; existing.estoque = selectedProduct.estoque; existing.preco = selectedProduct.preco; }
    else cart.push({ ...selectedProduct, qtd: qty });
    selectedProduct = null; $('#product-search').value = ''; $('#add-product').disabled = true; $('#product-choice').textContent = 'Selecione um produto acima.'; renderCart();
  };
  $('#finish-order').onclick = async event => {
    if (!selectedClient || !cart.length || submitting) return;
    const button = event.currentTarget; submitting = true; canFinish(); button.textContent = 'Finalizando…'; $('#checkout-error').textContent = '';
    try {
      const order = await api('/pedidos', { method: 'POST', body: JSON.stringify({ cliente_id: selectedClient.id, itens: cart.map(item => ({ produto_id: item.id, qtd: item.qtd })) }) });
      cart = []; location.assign(`/pedidos?pedido=${order.id}`);
    } catch (error) { $('#checkout-error').textContent = `${error.message} Revise os itens antes de tentar novamente.`; }
    finally { submitting = false; button.innerHTML = `Finalizar pedido ${icon('arrow')}`; canFinish(); }
  };
  window.addEventListener('beforeunload', event => { if (cart.length) { event.preventDefault(); event.returnValue = ''; } });
  renderCart();
}
function login() {
  document.body.classList.add('login-page');
  $('#app').innerHTML = `<div class="login-orbit" aria-hidden="true"></div><div class="login-brand brand"><span class="brand-icon">${icon('box')}</span>pedido<span class="brand-dot">.</span></div><main class="login-card"><div class="login-mark">${icon('box')}</div><span class="eyebrow">BEM-VINDO DE VOLTA</span><h1>Seu negócio em movimento.</h1><p>Entre para acompanhar o que acontece por aqui.</p><form id="login-form"><label>E-mail<input name="email" type="email" required maxlength="190" autocomplete="username" placeholder="voce@empresa.com.br" autofocus></label><label>Senha<input name="senha" type="password" required autocomplete="current-password" placeholder="Digite sua senha"></label><p id="login-error" class="form-error" role="alert"></p><button class="button primary" type="submit">Entrar no sistema ${icon('arrow')}</button></form><div class="login-security">${icon('check')}Acesso seguro ao seu espaço de gestão</div></main><div class="login-footer">Menos complicação. Mais controle.</div><div id="notifications" aria-live="polite"></div>`;
  $('#login-form').onsubmit = event => {
    event.preventDefault(); const form = event.currentTarget;
    busy($('[type="submit"]', form), async () => {
      $('#login-error').textContent = '';
      try { const data = await api('/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); csrf = data.csrf; location.assign('/'); }
      catch (error) { $('#login-error').textContent = error.message; $('[name="senha"]').value = ''; $('[name="senha"]').focus(); }
    });
  };
}
async function init() {
  const data = await api('/session'); csrf = data.csrf; currentUser = data.user;
  const page = document.body.dataset.page;
  if (page === 'login') { if (currentUser) location.assign('/'); else login(); return; }
  if (!currentUser) { location.assign('/login'); return; }
  shell(page);
  if (page === 'dashboard') await dashboard();
  else if (page === 'clientes' || page === 'produtos') await catalog(page);
  else if (page === 'pedidos') { await orders(); const id = new URLSearchParams(location.search).get('pedido'); if (/^\d+$/.test(id || '')) await showOrder(id); }
  else if (page === 'novo-pedido') await newOrder();
}
init().catch(error => {
  if ($('#content')) { $('#content').innerHTML = `<div class="panel empty"><strong>Não foi possível carregar esta página.</strong><p>${esc(error.message)}</p><button class="button secondary" id="retry">Tentar novamente</button></div>`; $('#retry').onclick = () => location.reload(); }
  else { $('#app').innerHTML = `<main class="startup-error"><h1>Conexão indisponível</h1><p>${esc(error.message)}</p><p>Atualize a página para tentar novamente.</p></main>`; }
});

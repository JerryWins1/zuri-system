// Zuri System · Home: the owner / CFO snapshot of the whole company · v1 · 2026-09-30
(function () {
  const Z = window.Z;
  const N = (v) => Number(v || 0);
  const pct = (a, b) => (N(b) ? Math.round((N(a) / N(b)) * 100) : 0);
  const ago = (ts) => { if (!ts) return null; const d = (Date.now() - new Date(ts)) / 864e5; return d; };
  const monthLabel = (p) => { const [y, m] = p.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' }); };
  const KIND = { fault: 'Fault', install: 'Install', relocation: 'Move', disconnect: 'Disconnect', survey: 'Survey', other: 'Other' };
  const tile = (k, v, f, cls = '', href) => `<${href ? `a href="${href}" style="text-decoration:none;color:inherit"` : 'div'} class="kpi"><div class="k">${k}</div><div class="v num ${cls}">${v}</div>${f ? `<div class="f">${f}</div>` : ''}</${href ? 'a' : 'div'}>`;

  Z.routes.home = async (_, el) => {
    const [{ data: s, error }, mgr] = await Promise.all([
      Z.sb.rpc('dashboard_snapshot', { p_area: Z.area || null }),
      Z.managerSummary ? Z.managerSummary().catch(() => null) : Promise.resolve(null),
    ]);
    if (error) throw error;
    const c = s.customers, j = s.jobs, m = s.money;

    // ---------- what needs attention, most important first ----------
    const alerts = [];
    if (m && m.proj_short_day) alerts.push(['bad', `🚨 Cash runs short on ${Z.day(m.proj_short_day)} — see Cash ahead and tell Jerry now.`, '#money/projection']);
    if (N(c.late)) alerts.push(['bad', `💳 ${c.late} customers have run out of paid time — KES ${Z.fmt(c.late_owe)} a month waiting. ${j.followups_urgent ? j.followups_urgent + ' are over a week late.' : ''}`, '#jobs']);
    if (m) {
      if (!m.oldest_count) alerts.push(['warn', '💵 No cash count yet — the cash position and projection start from zero until someone counts.', '#money/count']);
      else if (ago(m.oldest_count) > 3) alerts.push(['warn', `💵 Oldest cash count is ${Math.floor(ago(m.oldest_count))} days old — do a fresh count.`, '#money/count']);
      (m.floats || []).filter((f) => N(f.mpesa) < N(f.target)).forEach((f) => alerts.push([N(f.mpesa) < N(f.target) * 0.5 ? 'bad' : 'warn', `📱 ${Z.areaName(f.area)} M-Pesa float ${Z.fmt(f.mpesa)} is below the ${Z.fmt(f.target)} target.`, '#money/today']));
      if (m.bills && m.bills.next && m.bills.next.due_day < new Date().getDate()) alerts.push(['warn', `📅 ${m.bills.next.name} (KES ${Z.fmt(m.bills.next.owing)}) was due on the ${m.bills.next.due_day}th and isn't fully paid.`, '#money/bills']);
      if (N(m.unsorted)) alerts.push(['warn', `🧾 ${Z.fmt(m.unsorted)} bank / M-Pesa transactions still to sort — the books are incomplete until they are.`, '#money/sort']);
      if (m.last_statement && ago(m.last_statement) > 35) alerts.push(['warn', `🏦 Statements only go up to ${Z.day(m.last_statement)} — import the newer bank and M-Pesa statements.`, '#money/statements']);
      if (!(m.bills && N(m.bills.total))) alerts.push(['warn', '📋 No bills entered for this month — the cash projection doesn\'t know what\'s going out.', '#money/bills']);
    }
    if (N(j.overdue)) alerts.push(['warn', `🛠️ ${j.overdue} service job${j.overdue > 1 ? 's are' : ' is'} past the visit day.`, '#jobs']);
    if (N(j.unassigned)) alerts.push(['warn', `👷 ${j.unassigned} job${j.unassigned > 1 ? 's have' : ' has'} no tech yet.`, '#jobs']);
    if (c.last_update && ago(c.last_update) > 2) alerts.push(['warn', `🔄 Customer list last refreshed from the billing website ${Math.floor(ago(c.last_update))} days ago.`, '#import']);
    if (!alerts.length) alerts.push(['ok', '✅ Nothing needs you right now.', '']);

    const plans = c.plans || [];
    const topPlan = N((plans[0] || {}).n);
    const books = (m && m.books) || [];
    const billing = (m && m.billing) || [];
    // Latest month the statements fully cover (a month cut off mid-way would understate profit).
    const monthEnd = (mo) => { const d = new Date(mo.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() + 1, 0); return Z.ymd(d); };
    const lastBooks = [...books].reverse().find((b) => m && m.last_statement && m.last_statement >= monthEnd(b.month)) || books[books.length - 1];

    el.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h2 style="margin-bottom:0">Zuri at a glance${Z.area ? ' · ' + Z.esc(Z.areaName(Z.area)) : ''}</h2>
        <span class="hint">as of ${Z.when(s.as_of)} · <a href="#" id="h-refresh">refresh</a></span>
      </div>

      ${mgr ? `<a class="card" href="#tasks/mine" style="display:block;text-decoration:none;color:inherit;border-left:4px solid var(--brand)">
        <div class="row" style="justify-content:space-between"><b>🤖 Zuri manager</b><span class="hint" style="margin:0">${mgr.run ? 'last ran ' + Z.when(mgr.run.started_at) : 'hasn\'t run yet'}</span></div>
        <p style="margin:6px 0">${mgr.mine ? `You have <b>${mgr.mine}</b> thing${mgr.mine > 1 ? 's' : ''} on your list${mgr.urgent ? ` — <b>${mgr.urgent}</b> high priority` : ''}. Open Tasks →` : 'Nothing on your list right now.'}</p>
        ${mgr.run && (mgr.run.warnings || []).length ? (mgr.run.warnings || []).map((w) => `<div class="hint" style="margin:2px 0">${w.level === 'bad' ? '🔴' : '🟠'} ${Z.esc(w.text)}</div>`).join('') : ''}
      </a>` : ''}

      <h3>Needs attention</h3>
      ${alerts.slice(0, 7).map(([k, t, h]) => h ? `<a class="alert ${k}" href="${h}" style="display:block;text-decoration:none">${Z.esc(t)}</a>` : `<div class="alert ${k}">${Z.esc(t)}</div>`).join('')}

      <h3 style="display:flex;justify-content:space-between;align-items:center">Customers <a href="#customers/map" style="text-transform:none;letter-spacing:0;font-weight:700">🗺️ Map →</a></h3>
      <div class="kpis">
        ${tile('Active customers', Z.fmt(c.active), `${Z.fmt(c.disconnected)} disconnected${N(c.leads) ? ' · ' + c.leads + ' leads' : ''}`, '', '#customers')}
        ${tile('Paid up', `${pct(c.paid_up, c.active)}%`, `${Z.fmt(c.paid_up)} of ${Z.fmt(c.active)}`, pct(c.paid_up, c.active) >= 90 ? 'ok' : 'warn', '#money/collections')}
        ${tile('Late (ran out)', Z.fmt(c.late), `KES ${Z.fmt(c.late_owe)} / month`, N(c.late) ? 'bad' : 'ok', Z.isFinance() ? '#money/collections' : '#jobs')}
        ${tile('Monthly recurring revenue (KES)', Z.fmt(c.mrr), 'if every active customer pays')}
        ${tile('Renewals next 7 days', Z.fmt(c.renew_7), `KES ${Z.fmt(c.renew_7_kes)} · 30 days: ${Z.fmt(c.renew_30_kes)}`)}
        ${tile('No map pin', Z.fmt(c.no_pin), 'active customers techs can\'t find', N(c.no_pin) ? 'warn' : 'ok')}
      </div>
      ${plans.length ? `<div class="card"><b>Packages</b>${plans.map((p) => `
        <div class="row" style="margin-top:8px;gap:10px"><span style="width:130px" class="hint">${Z.esc(p.plan)}</span>
          <div class="grow" style="flex:1;background:var(--surface-2);border-radius:6px;height:14px"><div style="width:${Math.max(3, (N(p.n) / topPlan) * 100)}%;background:var(--brand);height:14px;border-radius:6px"></div></div>
          <span class="num" style="width:150px;text-align:right">${Z.fmt(p.n)} · KES ${Z.fmt(p.kes)}</span></div>`).join('')}</div>` : ''}

      <h3>Service</h3>
      <div class="kpis">
        ${tile('Open faults', Z.fmt(j.open_faults), `${Z.fmt(j.faults_done)} fixed this month${j.fault_hours != null ? ' · avg ' + j.fault_hours + ' h to fix' : ''}`, N(j.open_faults) > 10 ? 'warn' : '', '#jobs')}
        ${tile('Installs waiting', Z.fmt(j.open_installs), `${Z.fmt(j.installs_done)} installed this month`, '', '#jobs')}
        ${tile('Visits today', Z.fmt(j.today), `${Z.fmt(j.week)} this week`, '', '#jobs')}
        ${tile('Overdue visits', Z.fmt(j.overdue), `${Z.fmt(j.unassigned)} with no tech`, N(j.overdue) ? 'bad' : 'ok', '#jobs')}
        ${tile('Payment follow-ups', Z.fmt(j.followups), `${Z.fmt(j.followups_paid)} paid this month`, N(j.followups) ? 'warn' : 'ok', '#jobs')}
      </div>
      <div class="card list">${(s.upcoming || []).length ? s.upcoming.map((u) => `<a class="item" href="#jobs/${u.id}"><div class="grow"><div class="t">${u.priority === 'urgent' ? '🔴 ' : ''}${Z.esc(u.customer || 'No customer')} <span class="m">#${u.no} · ${KIND[u.kind] || u.kind}</span></div>
          <div class="m">${Z.esc(u.summary)}</div></div><div style="text-align:right" class="m">${u.day ? Z.day(u.day) : 'no date'}<br>${u.tech ? '👷 ' + Z.esc(u.tech) : '<span style="color:var(--warn)">no tech</span>'}</div></a>`).join('') : '<div class="muted">No service jobs open.</div>'}</div>

      ${m ? `
      <h3>Money</h3>
      <div class="kpis">
        ${tile('Cash now (KES)', m.oldest_count ? Z.fmt(m.cash_now) : '—', m.oldest_count ? `bank ${Z.fmt(m.bank)} · M-Pesa ${Z.fmt(m.mpesa)}` : 'no cash count yet', '', '#money/count')}
        ${tile('Lowest in next 30 days (KES)', Z.fmt(m.proj_low), m.proj_low_day ? Z.day(m.proj_low_day) : '', N(m.proj_low) < 0 ? 'bad' : 'ok', '#money/projection')}
        ${tile('Cash in 30 days (KES)', Z.fmt(m.proj_end), `in ${Z.fmt(m.proj_in)} · bills ${Z.fmt(m.proj_out)}`, '', '#money/projection')}
        ${tile('Bills still owing (KES)', Z.fmt(m.bills && m.bills.owing), m.bills && m.bills.next ? `next: ${Z.esc(m.bills.next.name)} (${m.bills.next.due_day}th)` : `${N(m.bills && m.bills.total)} bills this month`, '', '#money/bills')}
        ${lastBooks ? tile('Profit · ' + monthLabel(lastBooks.month.slice(0, 7)) + ' (KES)', Z.fmt(N(lastBooks.income) - N(lastBooks.expense)), `from sorted statements${N(m.unsorted) ? ' (incomplete)' : ''}`, N(lastBooks.income) - N(lastBooks.expense) < 0 ? 'bad' : 'ok', '#money/books') : ''}
      </div>
      <div class="card"><b>Cash over the next 30 days</b><div class="chart-box"><canvas id="h-cash" aria-label="Cash balance next 30 days"></canvas></div>
        <p class="hint">Starts from the latest cash count${m.oldest_count ? '' : ' (none yet, so from zero)'}. Adds renewals on each customer's renewal day, subtracts bills on their due days. Late payers are not counted. <a href="#money/projection">Details →</a></p></div>
      <div class="grid2">
        <div class="card"><b>Sales from the billing website</b><div class="chart-box" style="height:220px"><canvas id="h-sales"></canvas></div>
          <p class="hint">${billing.length ? 'Fixed subscriptions vs hotspot, as read from Billnasi.' : 'No monthly sales read yet.'}</p></div>
        <div class="card"><b>Income vs expenses (statements)</b><div class="chart-box" style="height:220px"><canvas id="h-books"></canvas></div>
          <p class="hint">${books.length ? `From sorted bank & M-Pesa lines. ${Z.fmt(m.unsorted)} still unsorted.` : 'Import statements to see this.'}</p></div>
      </div>` : ''}`;

    Z.$('#h-refresh', el).onclick = (e) => { e.preventDefault(); Z.route(); };
    if (!m) return;
    try {
      await Z.chartLib();
      const css = getComputedStyle(document.documentElement);
      const col = (v) => css.getPropertyValue(v).trim();
      const axes = (money = true) => ({
        x: { ticks: { color: col('--ink-faint') }, grid: { display: false } },
        y: { ticks: { color: col('--ink-faint'), callback: (v) => (money ? Z.fmt(v) : v) }, grid: { color: col('--line') } },
      });
      const legend = { labels: { color: col('--ink-soft'), boxWidth: 12 } };
      const series = m.proj_series || [];
      new Chart(Z.$('#h-cash', el), {
        data: {
          labels: series.map((p) => new Date(p.d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
          datasets: [
            { type: 'line', label: 'Cash balance', data: series.map((p) => N(p.b)), borderColor: col('--brand'), backgroundColor: col('--brand'), tension: 0.25, pointRadius: 0 },
            { type: 'bar', label: 'Money in', data: series.map((p) => N(p.i)), backgroundColor: col('--ok') + '88' },
            { type: 'bar', label: 'Bills out', data: series.map((p) => -N(p.o)), backgroundColor: col('--bad') + '88' },
          ],
        },
        options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend, tooltip: { callbacks: { label: (x) => `${x.dataset.label}: KES ${Z.fmt(x.raw)}` } } }, scales: axes() },
      });
      if (billing.length) new Chart(Z.$('#h-sales', el), {
        type: 'bar',
        data: { labels: billing.map((b) => monthLabel(b.period)), datasets: [
          { label: 'Subscriptions', data: billing.map((b) => N(b.fixed)), backgroundColor: col('--brand') },
          { label: 'Hotspot', data: billing.map((b) => N(b.hotspot)), backgroundColor: col('--accent') },
        ] },
        options: { maintainAspectRatio: false, plugins: { legend, tooltip: { callbacks: { label: (x) => `${x.dataset.label}: KES ${Z.fmt(x.raw)}` } } }, scales: { x: { ...axes().x, stacked: true }, y: { ...axes().y, stacked: true } } },
      });
      if (books.length) new Chart(Z.$('#h-books', el), {
        type: 'bar',
        data: { labels: books.map((b) => monthLabel(b.month.slice(0, 7))), datasets: [
          { label: 'Income', data: books.map((b) => N(b.income)), backgroundColor: col('--ok') },
          { label: 'Expenses', data: books.map((b) => N(b.expense)), backgroundColor: col('--bad') },
        ] },
        options: { maintainAspectRatio: false, plugins: { legend, tooltip: { callbacks: { label: (x) => `${x.dataset.label}: KES ${Z.fmt(x.raw)}` } } }, scales: axes() },
      });
    } catch (e) { /* charts are a bonus; the numbers above are complete */ }
  };
})();

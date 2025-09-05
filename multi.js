/* 批量頁面：KPI置頂+圖表 / 右側明細 / 下方精簡彙總；6線、滑點加粗 */
(function(){
  const $ = s=>document.querySelector(s);
  let chart, datasets=[], sortKey='gain', sortAsc=false, currentIdx=0;

  /* === 右側高度與捲動對齊左側（關鍵） === */
  function syncRightPanelHeight(){
    const leftPanel  = document.querySelector('.top-grid .card-panel');
    const rightCard  = document.querySelector('.right-box .right-card');
    if(!leftPanel || !rightCard) return;

    // 左側 KPI+圖表卡片實際高度
    const h = Math.round(leftPanel.getBoundingClientRect().height);

    // 右側卡片固定同高，內部用 flex 撐滿並顯示捲軸
    rightCard.style.height = h + 'px';
    rightCard.style.display = 'flex';
    rightCard.style.flexDirection = 'column';

    const scroll = rightCard.querySelector('.scroll');
    if (scroll){
      scroll.style.flex = '1';
      scroll.style.minHeight = '0';
      scroll.style.overflow = 'auto'; // 上下左右捲動
      const tbl = scroll.querySelector('table');
      if (tbl) tbl.style.width = 'max-content'; // 需要時出現水平捲軸
    }
  }

  /* ========== 圖表（6 線） ========== */
  function draw(tsArr, series){
    if(chart) chart.destroy();
    const labels = tsArr.map((_,i)=>i);
    const solid=(data,col,w)=>({data,stepped:true,borderColor:col,borderWidth:w,pointRadius:0});
    const dash =(data,col,w)=>({data,stepped:true,borderColor:col,borderWidth:w,pointRadius:0,borderDash:[6,4]});

    chart = new Chart($('#mChart'),{
      type:'line',
      data:{labels, datasets:[
        solid(series.slipTotal,'#111111',3.5),   // 多空滑點 黑實線 粗
        dash (series.total,'#9e9e9e',2),         // 多空累計 淡黑虛線
        solid(series.longSlip,'#d32f2f',3),      // 多滑點   紅實線 粗
        dash (series.long,'#ef9a9a',2),          // 多累計   淡紅虛線
        solid(series.shortSlip,'#2e7d32',3),     // 空滑點   綠實線 粗
        dash (series.short,'#a5d6a7',2),         // 空累計   淡綠虛線
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false},ticks:{display:false}}, y:{ticks:{callback:v=>v.toLocaleString('zh-TW')}}}
      }
    });
  }

  /* ========== KPI（單行對齊，與單檔版一致） ========== */
  function kpiLines(statAll, statL, statS){
    const {fmtMoney,pct} = window.SHARED;
    const mk = s => ([
      ['交易數', String(s.count)],
      ['勝率',   pct(s.winRate)],
      ['敗率',   pct(s.loseRate)],
      ['單日最大獲利', fmtMoney(s.dayMax)],
      ['單日最大虧損', fmtMoney(s.dayMin)],
      ['區間最大獲利', fmtMoney(s.up)],
      ['區間最大回撤', fmtMoney(s.dd)],
      ['累積獲利',     fmtMoney(s.gain)],
    ]);
    const rows = [mk(statAll), mk(statL), mk(statS)];
    const maxW = rows[0].map((_,i)=>Math.max(...rows.map(r=>r[i][1].length)));
    const padL = (s,w)=> s.padStart(w,' ');
    const join = (label, cols)=> `${label}： ` + cols.map((c,i)=>`${c[0]} ${padL(c[1],maxW[i])}`).join(' ｜ ');
    return [
      join('全部（含滑價）', rows[0]),
      join('多單（含滑價）', rows[1]),
      join('空單（含滑價）', rows[2]),
    ];
  }

  /* ========== 右側交易明細 ========== */
  function renderTrades(d){
    const {fmtTs,fmtMoney,MULT,FEE,TAX} = window.SHARED;
    const tb=$('#mTrades tbody'); tb.innerHTML='';
    let cum=0,cumSlip=0;
    d.trades.forEach((t,i)=>{
      cum+=t.gain; cumSlip+=t.gainSlip;
      const tr1=document.createElement('tr');
      tr1.innerHTML=`
        <td rowspan="2">${i+1}</td>
        <td>${fmtTs(t.pos.tsIn)}</td><td>${t.pos.pIn}</td><td>${t.pos.side==='L'?'新買':'新賣'}</td>
        <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>`;
      const tr2=document.createElement('tr');
      tr2.innerHTML=`
        <td>${fmtTs(t.tsOut)}</td><td>${t.priceOut}</td><td>${t.pos.side==='L'?'平賣':'平買'}</td>
        <td>${t.pts}</td><td>${FEE*2}</td><td>${Math.round(t.priceOut*MULT*TAX)}</td>
        <td>${fmtMoney(t.gain)}</td><td>${fmtMoney(cum)}</td>
        <td>${fmtMoney(t.gainSlip)}</td><td>${fmtMoney(cumSlip)}</td>`;
      tb.appendChild(tr1); tb.appendChild(tr2);
    });
  }

  /* ========== 上半部渲染（KPI+圖+右側明細） ========== */
  function renderTop(d){
    // 參數
    $('#mParamChip').textContent = window.SHARED.paramsLabel(d.params);
    // KPI
    const [la,ll,ls] = kpiLines(d.statAll, d.statL, d.statS);
    $('#mKpiAll').textContent = la;
    $('#mKpiL').textContent   = ll;
    $('#mKpiS').textContent   = ls;
    // 圖
    draw(d.tsArr, {
      total: d.total,
      slipTotal: d.slipCum,
      long: d.longCum,
      longSlip: d.longSlipCum,
      short: d.shortCum,
      shortSlip: d.shortSlipCum,
    });
    // 明細
    renderTrades(d);

    // ★ 對齊右側高度（放最後，等 DOM 排版完成後量測）
    requestAnimationFrame(()=>syncRightPanelHeight());
  }

  /* ========== 下方彙總（只保留全部（含滑價）8 指標） ========== */
  function buildRow(d, idx){
    const {fmtMoney,pct,paramsLabel} = window.SHARED;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td class="nowrap"><span class="row-link" data-idx="${idx}">${d.nameTime}</span></td>
      <td class="nowrap">${paramsLabel(d.params)}</td>
      <td class="num">${d.statAll.count}</td>
      <td class="num">${pct(d.statAll.winRate)}</td>
      <td class="num">${pct(d.statAll.loseRate)}</td>
      <td class="num">${fmtMoney(d.statAll.dayMax)}</td>
      <td class="num">${fmtMoney(d.statAll.dayMin)}</td>
      <td class="num">${fmtMoney(d.statAll.up)}</td>
      <td class="num">${fmtMoney(d.statAll.dd)}</td>
      <td class="num">${fmtMoney(d.statAll.gain)}</td>
    `;
    return tr;
  }

  function renderSummary(){
    const tb = document.querySelector('#sumTable tbody');
    tb.innerHTML='';
    datasets.forEach((d,i)=>tb.appendChild(buildRow(d,i)));
  }

  function sortSummary(key){
    sortAsc = (sortKey===key) ? !sortAsc : false;
    sortKey = key;
    datasets.sort((a,b)=>{
      const map={
        name: x=>x.nameTime,
        params: x=>window.SHARED.paramsLabel(x.params),
        count: x=>x.statAll.count,
        winRate: x=>x.statAll.winRate,
        loseRate: x=>x.statAll.loseRate,
        dayMax: x=>x.statAll.dayMax,
        dayMin: x=>x.statAll.dayMin,
        up: x=>x.statAll.up,
        dd: x=>x.statAll.dd,
        gain: x=>x.statAll.gain,
      };
      const av=map[key](a), bv=map[key](b);
      return sortAsc ? (av>bv?1:-1) : (av<bv?1:-1);
    });
    renderSummary();
  }

  /* ========== 事件：表頭排序 / 點列切換 / 清空 / 重新對齊 ========== */
  document.querySelectorAll('#sumTable thead th').forEach(th=>{
    const key = th.getAttribute('data-key');
    if(!key) return;
    th.addEventListener('click', ()=>sortSummary(key));
  });
  document.querySelector('#sumTable').addEventListener('click', e=>{
    const a = e.target.closest('.row-link'); if(!a) return;
    currentIdx = +a.getAttribute('data-idx')||0;
    renderTop(datasets[currentIdx]);
  });
  document.getElementById('clear').addEventListener('click', ()=>{
    datasets=[]; renderSummary();
    $('#mParamChip').textContent='—';
    $('#mKpiAll').textContent='—'; $('#mKpiL').textContent='—'; $('#mKpiS').textContent='—';
    if(chart) chart.destroy();
    document.querySelector('#mTrades tbody').innerHTML='';
    // 清空時也重置右側高度
    const rightCard  = document.querySelector('.right-box .right-card');
    if (rightCard){ rightCard.style.height=''; }
  });
  window.addEventListener('resize', ()=>syncRightPanelHeight());

  /* ========== 載入多檔 ========== */
  document.getElementById('files').addEventListener('change', async e=>{
    const fs = Array.from(e.target.files||[]);
    if(!fs.length){ alert('未讀到可用檔案'); return; }
    const {readAsTextAuto, parseTXT, buildReport} = window.SHARED;
    datasets=[];
    for (const f of fs){
      const raw = await readAsTextAuto(f);
      const parsed = parseTXT(raw);
      const rpt = buildReport(parsed.rows);
      if (!rpt.trades.length) continue;
      const nameTime = (f.name.match(/^(\d{8}_\d{6})/)||[])[1] || f.name;
      datasets.push({...rpt, params:parsed.params, nameTime});
    }
    if(!datasets.length){ alert('沒有成功配對的交易'); return; }
    sortSummary('gain');                // 先產出彙總（可點擊）
    currentIdx=0; renderTop(datasets[0]); // 直接顯示第一檔 KPI+圖+明細
  });
})();

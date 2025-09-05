/* 批量頁面（KPI 可換行且對齊；圖表 6 線、滑點加粗） */
(function(){
  const $ = s=>document.querySelector(s);
  let chart, datasets=[], sortKey='gain', sortAsc=false, currentIdx=0;

  function draw(tsArr, series){
    if(chart) chart.destroy();
    const labels = tsArr.map((_,i)=>i);
    const mkSolid=(data,col,w)=>({data,stepped:true,borderColor:col,borderWidth:w,pointRadius:0});
    const mkDash =(data,col,w)=>({data,stepped:true,borderColor:col,borderWidth:w,pointRadius:0,borderDash:[6,4]});

    chart = new Chart($('#mChart'),{
      type:'line',
      data:{labels, datasets:[
        mkSolid(series.slipTotal,'#111111',3.5),  // 多空滑點 黑實線 粗
        mkDash (series.total,'#9e9e9e',2),        // 多空累計 淡黑虛線
        mkSolid(series.longSlip,'#d32f2f',3),     // 多滑點   紅實線 粗
        mkDash (series.long,'#ef9a9a',2),         // 多累計   淡紅虛線
        mkSolid(series.shortSlip,'#2e7d32',3),    // 空滑點   綠實線 粗
        mkDash (series.short,'#a5d6a7',2),        // 空累計   淡綠虛線
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false},ticks:{display:false}}, y:{ticks:{callback:v=>v.toLocaleString('zh-TW')}}}
      }
    });
  }

  // 產生「KPI 可換行對齊」的 DOM（回傳 {html, style}）
  function buildKpiFlex(statAll, statL, statS){
    const {fmtMoney,pct} = window.SHARED;
    const cols = [
      r => ['交易數', String(r.count)],
      r => ['勝率', pct(r.winRate)],
      r => ['敗率', pct(r.loseRate)],
      r => ['單日最大獲利', fmtMoney(r.dayMax)],
      r => ['單日最大虧損', fmtMoney(r.dayMin)],
      r => ['區間最大獲利', fmtMoney(r.up)],
      r => ['區間最大回撤', fmtMoney(r.dd)],
      r => ['累積獲利', fmtMoney(r.gain)],
    ];
    const rowsData = [statAll, statL, statS].map(r => cols.map(f => f(r)));

    // 計算各欄位最大字元數（label+space+value）
    const widths = cols.map((_,i)=>{
      let m = 0;
      rowsData.forEach(row=>{
        const [k,v] = row[i];
        m = Math.max(m, (k+' '+v).length);
      });
      return m + 2; // 留一點緩衝
    });

    // 轉成 HTML
    const labels = ['全部（含滑價）','多單（含滑價）','空單（含滑價）'];
    let html = '';
    rowsData.forEach((row,ri)=>{
      html += `<div class="k-row"><span class="label">${labels[ri]}：</span>`;
      row.forEach(([k,v],ci)=>{
        html += `<span class="kv c${ci}"><span class="label">${k}</span> <span class="value">${v}</span></span>`;
      });
      html += `</div>`;
    });
    const style = widths.map((w,i)=>`--w${i}:${w}ch`).join(';');
    return {html, style};
  }

  function renderTop(d){
    // 參數
    $('#mParamChip').textContent = window.SHARED.paramsLabel(d.params);

    // KPI（可換行 + 對齊）
    const flex = buildKpiFlex(d.statAll, d.statL, d.statS);
    const box = $('#mKpiFlex');
    box.setAttribute('style', flex.style);
    box.innerHTML = flex.html;

    // 圖（6 線）
    draw(d.tsArr, {
      total: d.total,
      slipTotal: d.slipCum,
      long: d.longCum,
      longSlip: d.longSlipCum,
      short: d.shortCum,
      shortSlip: d.shortSlipCum,
    });

    // 交易明細
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

  function buildRow(d, idx){
    const {fmtMoney,pct,paramsLabel} = window.SHARED;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td class="nowrap"><span class="row-link" data-idx="${idx}">${d.nameTime}</span></td>
      <td class="nowrap">${paramsLabel(d.params)}</td>
      <td>${d.statAll.count}</td>
      <td>${pct(d.statAll.winRate)}</td>
      <td>${fmtMoney(d.statAll.gain)}</td>
      <td>${(d.statAll.gain/Math.abs(d.statAll.dayMin||1)).toFixed(2)}</td>
      <td>${fmtMoney(d.statAll.dayMax)}</td>
      <td>${fmtMoney(d.statAll.dd)}</td>
      <td>${fmtMoney(d.statL.gain)}</td>
      <td>${pct(d.statL.winRate)}</td>
      <td>${fmtMoney(d.statS.gain)}</td>
      <td>${pct(d.statS.winRate)}</td>
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
        gain: x=>x.statAll.gain,
        pf: x=> (x.statAll.gain/Math.abs(x.statAll.dayMin||1)),
        dayMax: x=>x.statAll.dayMax,
        dd: x=>x.statAll.dd,
        gainL: x=>x.statL.gain,
        winL: x=>x.statL.winRate,
        gainS: x=>x.statS.gain,
        winS: x=>x.statS.winRate,
      };
      const av=map[key](a), bv=map[key](b);
      return sortAsc ? (av>bv?1:-1) : (av<bv?1:-1);
    });
    renderSummary();
  }

  // header sort
  document.querySelectorAll('#sumTable thead th').forEach(th=>{
    const key = th.getAttribute('data-key');
    if(!key) return;
    th.addEventListener('click', ()=>sortSummary(key));
  });

  // 點選列切換
  document.querySelector('#sumTable').addEventListener('click', e=>{
    const a = e.target.closest('.row-link'); if(!a) return;
    const idx = +a.getAttribute('data-idx')||0;
    currentIdx = idx;
    renderTop(datasets[idx]);
  });

  // 清空
  document.getElementById('clear').addEventListener('click', ()=>{
    datasets=[]; renderSummary();
    $('#mParamChip').textContent='—';
    $('#mKpiFlex').innerHTML='';
    if(chart) chart.destroy();
    document.querySelector('#mTrades tbody').innerHTML='';
  });

  // 載入多檔
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
    sortSummary('gain');        // 先排序與渲染
    currentIdx=0; renderTop(datasets[0]);
  });
})();

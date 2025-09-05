/* 批量頁面（右側 KPI 也改成單行 + 對齊版；圖表 6 線） */
(function(){
  const $ = s=>document.querySelector(s);
  let chart, datasets=[], sortKey='gain', sortAsc=false, currentIdx=0;

  function draw(tsArr, series){
    if(chart) chart.destroy();
    const labels = tsArr.map((_,i)=>i);
    const mkSolid=(data,col)=>({data,stepped:true,borderColor:col,borderWidth:2,pointRadius:0});
    const mkDash =(data,col)=>({data,stepped:true,borderColor:col,borderWidth:2,pointRadius:0,borderDash:[6,4]});

    chart = new Chart($('#mChart'),{
      type:'line',
      data:{labels, datasets:[
        mkSolid(series.slipTotal,'#111111'),     // 多空滑點累計 黑實線
        mkDash (series.total,'#9e9e9e'),         // 多空累計   淡黑虛線
        mkSolid(series.longSlip,'#d32f2f'),      // 做多滑點   紅實線
        mkDash (series.long,'#ef9a9a'),          // 做多累計   淡紅虛線
        mkSolid(series.shortSlip,'#2e7d32'),     // 做空滑點   綠實線
        mkDash (series.short,'#a5d6a7'),         // 做空累計   淡綠虛線
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false},ticks:{display:false}}, y:{ticks:{callback:v=>v.toLocaleString('zh-TW')}}}
      }
    });
  }

  // 單行 + 對齊 KPI
  function buildKpiLines(statAll, statL, statS){
    const {fmtMoney,pct} = window.SHARED;
    const makeCols = s => ([
      ['交易數', String(s.count)],
      ['勝率',   pct(s.winRate)],
      ['敗率',   pct(s.loseRate)],
      ['單日最大獲利', fmtMoney(s.dayMax)],
      ['單日最大虧損', fmtMoney(s.dayMin)],
      ['區間最大獲利', fmtMoney(s.up)],
      ['區間最大回撤', fmtMoney(s.dd)],
      ['累積獲利',     fmtMoney(s.gain)],
    ]);
    const rows = [makeCols(statAll), makeCols(statL), makeCols(statS)];
    const maxW = rows[0].map((_,i)=>Math.max(...rows.map(r=>r[i][1].length)));
    const padL = (s,w)=> s.padStart(w,' ');
    const joinRow = (label, cols)=>{
      const pieces = cols.map((c,i)=>`${c[0]} ${padL(c[1],maxW[i])}`);
      return `${label}： ${pieces.join(' ｜ ')}`;
    };
    return [
      joinRow('全部（含滑價）', rows[0]),
      joinRow('多單（含滑價）', rows[1]),
      joinRow('空單（含滑價）', rows[2]),
    ];
  }

  function renderTop(d){
    // 參數
    $('#mParamChip').textContent = window.SHARED.paramsLabel(d.params);

    // KPI 三行（分隔線對齊）
    const [lineAll, lineL, lineS] = buildKpiLines(d.statAll, d.statL, d.statS);
    $('#mKpiAll').innerHTML = `<pre class="kpi-pre">${lineAll}</pre>`;
    $('#mKpiL').innerHTML   = `<pre class="kpi-pre">${lineL}</pre>`;
    $('#mKpiS').innerHTML   = `<pre class="kpi-pre">${lineS}</pre>`;

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
    $('#mKpiAll').textContent='—'; $('#mKpiL').textContent='—'; $('#mKpiS').textContent='—';
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

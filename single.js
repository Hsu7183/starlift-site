/* 單檔頁面 */
(function(){
  const $ = s=>document.querySelector(s);

  const cvs = $('#chart');
  let chart;

  function drawChart(ser){
    if(chart) chart.destroy();
    const {tsArr, total, slipTotal, long, longSlip, short, shortSlip} = ser;

    const labels = tsArr.map((_,i)=>i);
    const mkSolid=(data,col)=>({data,stepped:true,borderColor:col,borderWidth:2,pointRadius:0});
    const mkDash =(data,col)=>({data,stepped:true,borderColor:col,borderWidth:2,pointRadius:0,borderDash:[6,4]});

    chart = new Chart(cvs,{
      type:'line',
      data:{labels, datasets:[
        // 多空滑點累計（黑實線）
        mkSolid(slipTotal,'#111111'),
        // 多空累計（淡黑虛線）
        mkDash(total,'#9e9e9e'),
        // 做多滑點累計（紅實線） / 做多累計（淡紅虛線）
        mkSolid(longSlip,'#d32f2f'),
        mkDash(long,'#ef9a9a'),
        // 做空滑點累計（綠實線） / 做空累計（淡綠虛線）
        mkSolid(shortSlip,'#2e7d32'),
        mkDash(short,'#a5d6a7'),
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false},ticks:{display:false}}, y:{ticks:{callback:v=>v.toLocaleString('zh-TW')}}}
      }
    });
  }

  // 產生 3 行對齊的 KPI 文字（用 <pre> + 等寬字 + 動態補空白，讓「｜」對齊）
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
    // 每個欄位計算「數值字串」的最大長度
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

  function renderTable(report){
    const {fmtTs, fmtMoney, MULT, FEE, TAX} = window.SHARED;
    const tb = document.querySelector('#tradeTable tbody');
    tb.innerHTML = '';
    let cum=0, cumSlip=0;
    report.trades.forEach((t,i)=>{
      cum += t.gain; cumSlip += t.gainSlip;
      const tr1 = document.createElement('tr');
      tr1.innerHTML = `
        <td rowspan="2">${i+1}</td>
        <td>${fmtTs(t.pos.tsIn)}</td><td>${t.pos.pIn}</td><td>${t.pos.side==='L'?'新買':'新賣'}</td>
        <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
      `;
      const tr2 = document.createElement('tr');
      tr2.innerHTML = `
        <td>${fmtTs(t.tsOut)}</td><td>${t.priceOut}</td><td>${t.pos.side==='L'?'平賣':'平買'}</td>
        <td>${t.pts}</td><td>${FEE*2}</td><td>${Math.round(t.priceOut*MULT*TAX)}</td>
        <td>${fmtMoney(t.gain)}</td><td>${fmtMoney(cum)}</td>
        <td>${fmtMoney(t.gainSlip)}</td><td>${fmtMoney(cumSlip)}</td>
      `;
      tb.appendChild(tr1); tb.appendChild(tr2);
    });
  }

  async function handleRaw(raw){
    const {parseTXT, buildReport, paramsLabel} = window.SHARED;
    const parsed = parseTXT(raw);
    const report = buildReport(parsed.rows);
    if (report.trades.length===0){
      alert('沒有成功配對的交易'); return;
    }

    // 圖表：6 條線
    drawChart({
      tsArr: report.tsArr,
      total: report.total,
      slipTotal: report.slipCum,
      long: report.longCum,
      longSlip: report.longSlipCum,
      short: report.shortCum,
      shortSlip: report.shortSlipCum,
    });

    // KPI：3 行，分隔線對齊
    const [lineAll, lineL, lineS] = buildKpiLines(report.statAll, report.statL, report.statS);
    document.getElementById('paramChip').textContent = paramsLabel(parsed.params);
    document.getElementById('kpiAll').innerHTML = `<pre class="kpi-pre">${lineAll}</pre>`;
    document.getElementById('kpiL').innerHTML   = `<pre class="kpi-pre">${lineL}</pre>`;
    document.getElementById('kpiS').innerHTML   = `<pre class="kpi-pre">${lineS}</pre>`;

    // 明細表
    renderTable(report);
  }

  // 事件：貼上剪貼簿
  document.getElementById('btn-clip').addEventListener('click', async ()=>{
    const txt = await navigator.clipboard.readText();
    handleRaw(txt);
  });

  // 事件：載入檔案
  document.getElementById('file').addEventListener('change', async e=>{
    const f = e.target.files[0]; if(!f) return;
    try{
      const txt = await window.SHARED.readAsTextAuto(f);
      await handleRaw(txt);
    }catch(err){
      alert(err.message || '讀檔失敗');
    }
  });
})();

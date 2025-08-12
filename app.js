const rupiah = n => 'Rp ' + (Math.round(n).toLocaleString('id-ID'));
const byId = id => document.getElementById(id);

let GAJI_DATA = null;
fetch('data/gaji.json').then(r=>r.json()).then(d=>{
  GAJI_DATA = d;
  const golSel = byId('golongan');
  Object.keys(GAJI_DATA.gaji_pokok).forEach(g=>{
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    golSel.appendChild(opt);
  });
}).catch(()=>{
  GAJI_DATA = { gaji_pokok: {"III/a": 3500000,"III/b": 3800000,"III/c": 4200000,"IV/a": 5000000},
                tukin: {"III/a": 6000000,"III/b": 6500000,"III/c": 7000000,"IV/a": 8000000} };
  const golSel = byId('golongan');
  Object.keys(GAJI_DATA.gaji_pokok).forEach(g=>{
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    golSel.appendChild(opt);
  });
});

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');
tabs.forEach(t=>t.addEventListener('click',()=>{
  tabs.forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  panels.forEach(p=>p.classList.remove('show'));
  document.getElementById('tab-'+t.dataset.tab).classList.add('show');
}));
document.querySelectorAll('.next').forEach(btn=>btn.addEventListener('click',()=>{
  const idx = [...tabs].findIndex(t=>t.classList.contains('active'));
  if (idx < tabs.length-1){ tabs[idx+1].click(); }
}));
document.querySelectorAll('.prev').forEach(btn=>btn.addEventListener('click',()=>{
  const idx = [...tabs].findIndex(t=>t.classList.contains('active'));
  if (idx>0){ tabs[idx-1].click(); }
}));

const drawer = document.getElementById('drawer');
document.getElementById('btnInfo').onclick = ()=> drawer.classList.add('open');
document.getElementById('closeDrawer').onclick = ()=> drawer.classList.remove('open');

document.getElementById('btnHitungGaji').onclick = ()=>{
  const gol = byId('golongan').value;
  let gaji_pokok = GAJI_DATA.gaji_pokok[gol] || 0;
  const mkg = parseInt(byId('masker').value||0,10);
  gaji_pokok = Math.round(gaji_pokok * (1 + 0.03 * Math.floor(mkg/4)));
  const tukinOverride = parseInt(byId('tukinOverride').value||0,10);
  const tukin = tukinOverride>0 ? tukinOverride : (GAJI_DATA.tukin[gol]||0);
  byId('gajiPokok').textContent = rupiah(gaji_pokok);
  byId('gajiTukin').textContent = rupiah(tukin);
  byId('gajiTotal').textContent = rupiah(gaji_pokok + tukin);
};

let hargaRumah = 0;
let labelRumah = '';
document.querySelectorAll('.card.select').forEach(el=>{
  el.addEventListener('click',()=>{
    document.querySelectorAll('.card.select').forEach(x=>x.classList.remove('selected'));
    el.classList.add('selected');
    hargaRumah = parseInt(el.dataset.harga,10);
    labelRumah = el.dataset.nama;
    byId('rumahPilihan').textContent = labelRumah;
    byId('rumahHarga').textContent = rupiah(hargaRumah);
  });
});

function annuityPayment(P, r, n){
  if (r<=0) return P/n;
  return P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
}

function simulate(){
  const skema = document.querySelector('input[name="skema"]:checked').value;
  const dpPct = parseFloat(byId('dp').value||0)/100;
  const tenor = parseInt(byId('tenor').value||1,10);
  const rFixed = parseFloat(byId('rateFixed').value||0)/100/12;
  const rFloat = parseFloat(byId('rateFloat').value||0)/100/12;
  const totalBulan = tenor*12;
  const bulanFixed = Math.min(36,totalBulan);

  if (!hargaRumah) { alert('Pilih rumah dulu.'); return; }
  const plafon = Math.max(0, hargaRumah * (1-dpPct));

  byId('sumHarga').textContent = rupiah(hargaRumah);
  byId('sumPlafon').textContent = rupiah(plafon);
  byId('sumSkema').textContent = skema;
  byId('sumTenor').textContent = `${tenor} th (${totalBulan} bln)`;
  byId('sumDP').textContent = `${Math.round(dpPct*100)}%`;

  if (skema === 'CASH'){
    byId('outCicilanFixed').textContent = '-';
    byId('outCicilanFloat').textContent = '-';
    byId('outSisa36').textContent = '-';
    const total = hargaRumah;
    byId('outTotalBayar').textContent = rupiah(total);
    byId('tabelWrap').innerHTML = '<p>Pembayaran tunai (cash keras). Tidak ada tabel amortisasi.</p>';
    byId('outLayak').textContent = 'N/A';
    byId('outRasio').textContent = 'N/A';
    return;
  }

  const gTot = (function(){
    const gp = byId('gajiPokok').textContent.startsWith('Rp') ?
      parseInt(byId('gajiPokok').textContent.replace(/[^\d]/g,'')) : 0;
    const tk = byId('gajiTukin').textContent.startsWith('Rp') ?
      parseInt(byId('gajiTukin').textContent.replace(/[^\d]/g,'')) : 0;
    return gp+tk;
  })();
  const rasioMax = (parseFloat(byId('rasioMax').value||30)/100);

  const rows = [];
  let sisa = plafon;
  const cicilFixed = annuityPayment(plafon, rFixed, totalBulan);
  let totalBayar = 0;
  let bungaTotal = 0;

  for (let m=1; m<=bulanFixed; m++){
    const bunga = sisa * rFixed;
    const pokok = cicilFixed - bunga;
    sisa = Math.max(0, sisa - pokok);
    rows.push([m, cicilFixed, pokok, bunga, sisa, 'FIXED']);
    totalBayar += cicilFixed; bungaTotal += bunga;
  }
  const sisaAfter36 = sisa;

  const sisaBulan = totalBulan - bulanFixed;
  let cicilFloat = 0;
  if (sisaBulan>0){
    cicilFloat = annuityPayment(sisa, rFloat, sisaBulan);
    for (let m=bulanFixed+1; m<=totalBulan; m++){
      const bunga = sisa * rFloat;
      const pokok = cicilFloat - bunga;
      sisa = Math.max(0, sisa - pokok);
      rows.push([m, cicilFloat, pokok, bunga, sisa, 'FLOAT']);
      totalBayar += cicilFloat; bungaTotal += bunga;
    }
  }

  byId('outCicilanFixed').textContent = rupiah(cicilFixed||0);
  byId('outCicilanFloat').textContent = sisaBulan>0 ? rupiah(cicilFloat) : '-';
  byId('outSisa36').textContent = rupiah(sisaAfter36);
  byId('outTotalBayar').textContent = rupiah(totalBayar);

  const cicilMax = gTot * rasioMax;
  const worstPayment = Math.max(cicilFixed, cicilFloat || 0);
  const layak = gTot>0 ? (worstPayment <= cicilMax) : false;
  const rasio = gTot>0 ? (worstPayment / gTot) : 0;
  byId('outLayak').textContent = gTot? (layak? '✅ Layak':'❌ Tidak Layak'): 'Isi estimasi gaji';
  byId('outRasio').textContent = gTot? ( (rasio*100).toFixed(1) + '% dari gaji' ) : '-';

  const table = document.createElement('table');
  table.innerHTML = `<thead>
    <tr><th>Bulan</th><th>Angsuran</th><th>Pokok</th><th>Bunga</th><th>Sisa Pokok</th><th>Fase</th></tr>
  </thead>`;
  const tb = document.createElement('tbody');
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="text-align:center">${r[0]}</td>
      <td>${rupiah(r[1])}</td>
      <td>${rupiah(r[2])}</td>
      <td>${rupiah(r[3])}</td>
      <td>${rupiah(r[4])}</td>
      <td style="text-align:center">${r[5]}</td>`;
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  const wrap = byId('tabelWrap');
  wrap.innerHTML = '';
  wrap.appendChild(table);
}

document.getElementById('btnSimulasi').onclick = simulate;

document.getElementById('btnPDF').onclick = ()=>{
  const el = document.getElementById('resultCard');
  const opt = { margin: 8, filename: 'SimulasiKPR_Bappenas.pdf', image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  html2pdf().set(opt).from(el).save();
};

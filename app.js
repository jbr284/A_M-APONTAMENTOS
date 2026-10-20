import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCmKoCE0sO2e-hE1MlyhJnEvw3VP3hTvgU",
  authDomain: "am-apontamentos.firebaseapp.com",
  projectId: "am-apontamentos",
  storageBucket: "am-apontamentos.firebasestorage.app",
  messagingSenderId: "992480104205",
  appId: "1:992480104205:web:4c80ef46e6eeb63613ea44"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.db = db;
window.registros = [];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ==========================================
// INICIALIZAÇÃO E SINCRONIZAÇÃO DE DADOS
// ==========================================
window.carregarTodosOsDados = async () => {
  try {
    const snapSari = await getDocs(collection(db, "apontamentos"));
    window.registros = snapSari.docs.map(d => d.data());

    // Busca o Valor da Diária salvo na nuvem para manter sincronizado
    try {
      const confSnap = await getDoc(doc(db, "configuracoes", "parametros"));
      if (confSnap.exists() && confSnap.data().valorDiaria) {
        const valNuvem = parseFloat(confSnap.data().valorDiaria);
        localStorage.setItem('am_valor_diaria', valNuvem);
        const inputBase = document.getElementById('valorBase');
        if (inputBase) inputBase.value = valNuvem.toFixed(2);
      }
    } catch (e) { console.log(e); }

    window.atualizarPreview();
    window.renderizarApontamentosSaripan();
    window.atualizarRodapeDinamico();
  } catch (e) { console.error(e); }
};

window.salvarValorDiariaFixa = async () => {
  const inputBase = document.getElementById('valorBase');
  if (!inputBase) return;
  const val = parseFloat(inputBase.value) || 0;
  if (val > 0) {
    localStorage.setItem('am_valor_diaria', val);
    try {
      await setDoc(doc(db, "configuracoes", "parametros"), { valorDiaria: val }, { merge: true });
    } catch (e) { console.error(e); }
  }
};

// ==========================================
// CÁLCULOS E APONTAMENTOS (BANDEIRA 1 E 2)
// ==========================================
window.obterPeriodo = (dataStr) => {
  const dateObj = new Date(dataStr);
  return {
    ano: dateObj.getUTCFullYear(),
    mes: dateObj.getUTCMonth(),
    dia: dateObj.getUTCDate(),
    quinzena: dateObj.getUTCDate() <= 15 ? 1 : 2
  };
};

window.atualizarPreview = () => {
  const base = parseFloat(document.getElementById('valorBase')?.value) || 0;
  const bandeira = parseInt(document.getElementById('tipoBandeira')?.value) || 1;
  const multiplicador = bandeira; // Bandeira 1 = 1x | Bandeira 2 = 2x

  const previewEl = document.getElementById('previewValor');
  if (previewEl) previewEl.value = `R$ ${(base * multiplicador).toFixed(2)}`;
};

window.atualizarRodapeDinamico = () => {
  const dataInput = document.getElementById('dataServico')?.value;
  if (!dataInput) return;
  const p = window.obterPeriodo(dataInput);
  let qtdDiarias = 0;
  let totalDinheiro = 0;

  window.registros.forEach(r => {
    if (r.ano === p.ano && r.mes === p.mes && r.quinzena === p.quinzena) {
      qtdDiarias += (r.multiplicador || r.bandeira || 1);
      totalDinheiro += r.total;
    }
  });

  const rodapeQtd = document.getElementById('rodape-qtd');
  const rodapeTotal = document.getElementById('rodape-total');
  const rodapeRef = document.getElementById('rodape-ref');
  if (rodapeQtd) rodapeQtd.innerText = qtdDiarias;
  if (rodapeTotal) rodapeTotal.innerText = totalDinheiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (rodapeRef) rodapeRef.innerText = `Referência: ${p.quinzena}ª Quinzena de ${MESES[p.mes]} ${p.ano}`;
};

window.adicionarRegistro = async () => {
  const dataInput = document.getElementById('dataServico').value;
  if (!dataInput) return alert("Selecione a data do serviço!");

  const base = parseFloat(document.getElementById('valorBase').value) || 0;
  if (base <= 0) return alert("Informe um Valor da Diária válido!");

  const bandeira = parseInt(document.getElementById('tipoBandeira').value) || 1;
  const multiplicador = bandeira; // 1 ou 2 diárias
  const total = base * multiplicador;

  const p = window.obterPeriodo(dataInput);
  const idUnico = Date.now().toString();

  const novoRegistro = {
    id: idUnico,
    data: dataInput,
    ano: p.ano,
    mes: p.mes,
    quinzena: p.quinzena,
    bandeira: bandeira,
    valorBase: base,
    multiplicador: multiplicador,
    total: total
  };

  try {
    await window.salvarValorDiariaFixa();
    await setDoc(doc(db, "apontamentos", idUnico), novoRegistro);
    window.registros.push(novoRegistro);
    window.renderizarApontamentosSaripan();
    window.atualizarRodapeDinamico();
    window.mostrarToast("Apontamento salvo com sucesso!");
  } catch (e) {
    console.error(e);
    alert("Erro ao salvar o apontamento!");
  }
};

window.excluirRegistro = async (id) => {
  if (!confirm("Deseja realmente excluir este apontamento?")) return;
  try {
    await deleteDoc(doc(db, "apontamentos", id.toString()));
    window.registros = window.registros.filter(r => r.id.toString() !== id.toString());
    window.renderizarApontamentosSaripan();
    window.atualizarRodapeDinamico();
    window.mostrarToast("Registro excluído.");
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir!");
  }
};

window.excluirQuinzena = async (chaveGrupo) => {
  if (!confirm("ATENÇÃO: Deseja realmente excluir TODOS os registros desta quinzena?")) return;
  const [anoStr, mesStr, quinzenaStr] = chaveGrupo.split('-');
  const ano = parseInt(anoStr);
  const mes = parseInt(mesStr);
  const quinzena = parseInt(quinzenaStr);
  const itensParaExcluir = window.registros.filter(r => r.ano === ano && r.mes === mes && r.quinzena === quinzena);

  try {
    for (const item of itensParaExcluir) {
      await deleteDoc(doc(db, "apontamentos", item.id.toString()));
    }
    window.registros = window.registros.filter(r => !(r.ano === ano && r.mes === mes && r.quinzena === quinzena));
    window.renderizarApontamentosSaripan();
    window.atualizarRodapeDinamico();
    window.mostrarToast("Quinzena inteira excluída!");
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir quinzena.");
  }
};

// ==========================================
// HISTÓRICO E COMPARTILHAMENTO WHATSAPP
// ==========================================
window.renderizarApontamentosSaripan = () => {
  const container = document.getElementById('lista-quinzenas-container');
  if (!container) return;
  container.innerHTML = "";
  const msgVazia = document.getElementById('msg-sem-dados');

  if (window.registros.length === 0) {
    if (msgVazia) msgVazia.style.display = 'block';
    return;
  }
  if (msgVazia) msgVazia.style.display = 'none';

  const grupos = {};
  window.registros.forEach(reg => {
    const chave = `${reg.ano}-${reg.mes}-${reg.quinzena}`;
    if (!grupos[chave]) {
      grupos[chave] = { ano: reg.ano, mes: reg.mes, quinzena: reg.quinzena, itens: [], totalValor: 0, totalDiarias: 0 };
    }
    grupos[chave].itens.push(reg);
    grupos[chave].totalValor += reg.total;
    grupos[chave].totalDiarias += (reg.multiplicador || reg.bandeira || 1);
  });

  const chavesOrdenadas = Object.keys(grupos).sort((a, b) => {
    const [anoA, mesA, qA] = a.split('-').map(Number);
    const [anoB, mesB, qB] = b.split('-').map(Number);
    if (anoA !== anoB) return anoB - anoA;
    if (mesA !== mesB) return mesB - mesA;
    return qB - qA;
  });

  chavesOrdenadas.forEach((chave, index) => {
    const grupo = grupos[chave];
    grupo.itens.sort((a, b) => new Date(a.data) - new Date(b.data));
    const isPrimeiro = index === 0;
    const activeClass = isPrimeiro ? 'active' : '';
    const openClass = isPrimeiro ? 'open' : '';
    const totalFormatado = grupo.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let htmlRows = '';
    const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

    grupo.itens.forEach(item => {
      const [, mes, dia] = item.data.split('-');
      const dataFmt = `${dia}/${mes}`;
      const numBandeira = item.bandeira || item.multiplicador || 1;
      const bandeiraStr = `Bandeira ${numBandeira}`;
      const totalItemFmt = `R$ ${item.total.toFixed(2)}`;
      const dObj = new Date(item.data + 'T12:00:00');
      const diaDaSemana = diasSemana[dObj.getDay()];

      htmlRows += `
        <tr>
          <td>${dataFmt}</td>
          <td>${diaDaSemana}</td>
          <td><strong>${bandeiraStr}</strong></td>
          <td class="td-valor esconder-valor">${totalItemFmt}</td>
          <td class="td-acao" style="text-align:center;">
            <span style="color:red; cursor:pointer; font-weight:bold; padding: 5px;" onclick="window.excluirRegistro('${item.id}')">✖</span>
          </td>
        </tr>`;
    });

    const btnWhatsApp = `<button class="btn-icon" style="background: none; border: none; cursor: pointer; padding: 5px; margin-right: 5px;" onclick="event.stopPropagation(); window.compartilharRelatorio('${chave}')" title="Compartilhar no WhatsApp">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="22" height="22" fill="#25D366"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-23.1-115-65-157zM223.9 438.3c-33.1 0-65.5-8.9-94-25.8l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 54.3 0 105.4 21.2 143.8 59.6 38.4 38.4 59.6 89.5 59.6 143.8 0 101.8-82.8 184.5-184.6 184.5zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
    </button>`;
    const btnExcluirGrupo = `<button class="btn-icon" style="background:none; border:none; color:#d32f2f; font-size:20px; padding:5px; cursor:pointer;" onclick="event.stopPropagation(); window.excluirQuinzena('${chave}')" title="Excluir Quinzena">🗑️</button>`;

    const div = document.createElement('div');
    div.className = 'accordion-group';
    div.innerHTML = `
      <div class="accordion-header ${activeClass}" onclick="this.classList.toggle('active'); this.nextElementSibling.classList.toggle('open');">
        <div>
          <div class="accordion-title">${grupo.quinzena}ª Quinzena - ${MESES[grupo.mes]} ${grupo.ano}</div>
          <div class="accordion-meta">${grupo.itens.length} apontamentos (${grupo.totalDiarias} diárias)</div>
        </div>
        <div class="accordion-actions" style="display:flex; align-items:center;">${btnWhatsApp} ${btnExcluirGrupo}</div>
      </div>
      <div class="accordion-content ${openClass}">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Dia</th>
              <th>Bandeira</th>
              <th style="text-align:right">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows}
            <tr class="total-row">
              <td colspan="2">Total (${grupo.totalDiarias} diárias)</td>
              <td colspan="2" class="td-valor esconder-valor">${totalFormatado}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>`;
    container.appendChild(div);
  });
};

window.compartilharRelatorio = async (chaveGrupo) => {
  const [anoStr, mesStr, quinzenaStr] = chaveGrupo.split('-');
  const ano = parseInt(anoStr);
  const mes = parseInt(mesStr);
  const quinzena = parseInt(quinzenaStr);

  const itens = window.registros.filter(r => r.ano === ano && r.mes === mes && r.quinzena === quinzena);
  if (itens.length === 0) return alert("Nenhum registro para compartilhar.");

  itens.sort((a, b) => new Date(a.data) - new Date(b.data));

  let totalDinheiro = 0;
  let qtdDiarias = 0;
  let trs = '';
  const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  itens.forEach(item => {
    const [, m, d] = item.data.split('-');
    const dataFmt = `${d}/${m}`;
    const numBandeira = item.bandeira || item.multiplicador || 1;
    const bandeiraStr = `Bandeira ${numBandeira} (${numBandeira}x)`;

    totalDinheiro += item.total;
    qtdDiarias += numBandeira;

    const dObj = new Date(item.data + 'T12:00:00');
    const diaDaSemana = diasSemana[dObj.getDay()];

    trs += `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${dataFmt}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${diaDaSemana}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${bandeiraStr}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #2e7d32; text-align: right;">R$ ${item.total.toFixed(2)}</td>
      </tr>`;
  });

  let texto = `*Relatório SARIPAN - Alex Miguel*\n🗓️ *${quinzena}ª Quinzena - ${MESES[mes]} ${ano}*\n\n`;
  texto += `📊 *Total de Diárias:* ${qtdDiarias}\n💰 *Valor Total:* R$ ${totalDinheiro.toFixed(2)}\n\n_(Recibo detalhado em anexo)_`;

  document.getElementById('print-ref').innerText = `Referência: ${quinzena}ª Quinzena de ${MESES[mes]} ${ano}`;
  document.getElementById('print-total-diarias').innerText = `Total: ${qtdDiarias} diárias a receber`;
  document.getElementById('print-valor-total').innerText = `R$ ${totalDinheiro.toFixed(2)}`;
  document.getElementById('print-tbody').innerHTML = trs;

  window.mostrarToast("Gerando recibo em imagem...");

  try {
    const printContainer = document.getElementById('print-container');
    printContainer.style.top = '0';
    printContainer.style.left = '0';

    const canvas = await html2canvas(document.getElementById('print-template'), { scale: 2, useCORS: true });

    printContainer.style.top = '-9999px';
    printContainer.style.left = '-9999px';

    canvas.toBlob(async (blob) => {
      const file = new File([blob], `Relatorio_Saripan_Alex_Miguel_${quinzena}Q_${MESES[mes]}_${ano}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Relatório Saripan - Alex Miguel',
            text: texto,
            files: [file]
          });
        } catch (e) {
          const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
          window.open(url, '_blank');
        }
      } else {
        const link = document.createElement('a');
        link.download = file.name;
        link.href = URL.createObjectURL(blob);
        link.click();

        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
        window.open(url, '_blank');
      }
    }, 'image/png');

  } catch (err) {
    console.error("Erro ao gerar imagem", err);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }
};

// ==========================================
// NAVEGAÇÃO, PRIVACIDADE E LOGIN
// ==========================================
window.abrirAbaHub = (aba) => {
  document.getElementById('tela-hub').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  window.mudarAba(aba);
};

window.mudarAba = (aba) => {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(`painel-${aba}`);
  const btn = document.getElementById(`btn-tab-${aba}`);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  if (aba === 'historico') window.renderizarApontamentosSaripan();
};

window.voltarAoHub = () => {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('tela-hub').classList.remove('hidden');
};

window.mostrarToast = (msg) => {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

window.togglePrivacidade = () => {
  document.body.classList.toggle('modo-privacidade');
  localStorage.setItem('am_privacidade', document.body.classList.contains('modo-privacidade'));
};

window.fazerLogin = async () => {
  const email = document.getElementById('emailLogin').value.trim();
  const senha = document.getElementById('senhaLogin').value;
  if (!email || !senha) return alert("Preencha e-mail e senha.");
  const btn = document.querySelector('#tela-login .btn-action');
  btn.innerText = "Entrando...";
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (e) {
    alert("Credenciais inválidas. Verifique seu e-mail e senha.");
  } finally {
    btn.innerText = "Entrar";
  }
};

window.sairApp = async () => {
  if (confirm("Deseja realmente sair da conta?")) await signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('tela-login').classList.add('hidden');
    document.getElementById('tela-hub').classList.remove('hidden');
    window.carregarTodosOsDados();
  } else {
    document.getElementById('tela-login').classList.remove('hidden');
    document.getElementById('tela-hub').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const privSalva = localStorage.getItem('am_privacidade') === 'true';
  if (privSalva) document.body.classList.add('modo-privacidade');

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  const inputData = document.getElementById('dataServico');
  if (inputData) {
    inputData.value = `${ano}-${mes}-${dia}`;
    inputData.addEventListener('change', window.atualizarRodapeDinamico);
  }

  // Carrega o valor da diária salvo localmente (ou inicia em 130.00 até o usuário alterar)
  const inputBase = document.getElementById('valorBase');
  const diariaSalva = parseFloat(localStorage.getItem('am_valor_diaria')) || 130.00;
  if (inputBase) {
    inputBase.value = diariaSalva.toFixed(2);
    inputBase.addEventListener('input', window.atualizarPreview);
    inputBase.addEventListener('change', window.salvarValorDiariaFixa);
  }

  const selectBandeira = document.getElementById('tipoBandeira');
  if (selectBandeira) {
    selectBandeira.addEventListener('change', window.atualizarPreview);
  }

  window.atualizarPreview();
});

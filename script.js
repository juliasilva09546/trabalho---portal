const STORAGE_KEY = "portalAtendimentosDemo_v3";
const PROFILE_KEY = "portalAtendimentosProfile_v3";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let selectedImageData = "";
let toastTimeout;

// ======================================
// ARMAZENAMENTO LOCAL
// ======================================

function load(key, fallback) {
  try {
    return JSON.parse(
      localStorage.getItem(key) || JSON.stringify(fallback)
    );
  } catch {
    return fallback;
  }
}

function loadProtocols() {
  return load(STORAGE_KEY, []);
}

function saveProtocols(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadProfile() {
  return load(PROFILE_KEY, {});
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// ======================================
// FUNÇÕES AUXILIARES
// ======================================

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function toast(message) {
  const element = $("#toast");

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    element.classList.remove("show");
  }, 3600);
}

function profileComplete(profile = loadProfile()) {
  return Boolean(
    profile.nome?.trim() &&
    profile.nascimento &&
    profile.profissao?.trim() &&
    profile.usuario?.trim() &&
    profile.senha &&
    profile.cep?.trim() &&
    profile.bairro?.trim() &&
    profile.rua?.trim() &&
    profile.numero?.trim() &&
    profile.telefone?.trim()
  );
}

function isLoggedIn() {
  return sessionStorage.getItem(
    "portalAtendimentosLoggedIn"
  ) === "true";
}

// ======================================
// NAVEGAÇÃO ENTRE AS TELAS
// ======================================

function showView(name) {
  $$(".view").forEach((view) => {
    view.classList.toggle(
      "hidden",
      view.id !== `view-${name}`
    );
  });

  $$(".nav-link").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.view === name
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function goToView(name) {
  if (
    ["nova", "protocolos"].includes(name) &&
    !isLoggedIn()
  ) {
    toast("Entre com seu usuário e senha para continuar.");
    showView("login");
    return;
  }

  showView(name);

  if (name === "protocolos") {
    renderProtocols();
  }

  if (name === "inicio") {
    renderHome();
  }

  if (name === "nova") {
    renderCitizenSummary();
  }

  if (name === "perfil") {
    populateProfile();
  }
}

$$("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    goToView(button.dataset.view);
  });
});

$("#profileButton").addEventListener("click", () => {
  goToView("perfil");
});

$("#profileQuick").addEventListener("click", () => {
  goToView("perfil");
});

$("#goRegister").addEventListener("click", () => {
  showView("perfil");
  populateProfile();
});

// ======================================
// PROTOCOLOS
// ======================================

function fmtDate(iso) {
  if (!iso) return "—";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function statusClass(status) {
  if (status === "Aceito") {
    return "status-aceito";
  }

  if (status === "Não aprovado") {
    return "status-nao-aprovado";
  }

  return "";
}

function protocolMarkup(item, details = true) {
  const location = [
    item.rua,
    item.numero ? `nº ${item.numero}` : "",
    item.bairro
  ].filter(Boolean).join(", ");

  return `
    <article class="protocol-item">
      <div>
        <div class="protocol-topline">
          <span class="protocol-id">
            ${esc(item.id)}
          </span>

          <span class="status ${statusClass(item.status)}">
            ${esc(item.status)}
          </span>

          <span class="type-pill">
            ${esc(item.tipo || "Indicação")}
          </span>
        </div>

        <h3>${esc(item.assunto)}</h3>

        <p>
          <strong>Local:</strong>
          ${esc(location || "Local não informado")}
        </p>

        ${details ? `
          <div class="protocol-detail">
            <strong>Justificativa:</strong>
            <p>${esc(item.justificativa || "—")}</p>

            ${item.imageName ? `
              <p>
                <strong>Foto anexada:</strong>
                ${esc(item.imageName)}
              </p>
            ` : ""}
          </div>
        ` : ""}
      </div>

      <div class="protocol-meta">
        <strong>Enviado em ${fmtDate(item.data)}</strong>
        <span>Atualização: ${esc(item.status)}</span>
      </div>
    </article>
  `;
}

function emptyMarkup() {
  return `
    <div class="empty-state">
      <div class="empty-icon">▤</div>

      <h3>Nenhuma solicitação encontrada</h3>

      <p>
        Quando você registrar uma solicitação,
        ela aparecerá aqui para acompanhamento.
      </p>

      <button class="button button-primary" data-view="nova">
        Registrar solicitação
      </button>
    </div>
  `;
}

function bindViewButtons(root) {
  root.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      goToView(button.dataset.view);
    });
  });
}

// ======================================
// PÁGINA INICIAL
// ======================================

function renderHome() {
  const items = loadProtocols().sort(
    (a, b) => new Date(b.data) - new Date(a.data)
  );

  $("#statTotal").textContent = items.length;

  $("#statPending").textContent = items.filter(
    (item) => item.status === "Em espera"
  ).length;

  $("#statAccepted").textContent = items.filter(
    (item) => item.status === "Aceito"
  ).length;

  $("#recentList").innerHTML = items.length
    ? items.slice(0, 3)
        .map((item) => protocolMarkup(item, false))
        .join("")
    : emptyMarkup();

  bindViewButtons($("#recentList"));
}

// ======================================
// LISTA E PESQUISA DE PROTOCOLOS
// ======================================

function renderProtocols() {
  const search = ($("#protocolSearch").value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const status = $("#statusFilter").value;

  const items = loadProtocols()
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .filter((item) => {
      const searchable = [
        item.id,
        item.assunto,
        item.bairro,
        item.rua,
        item.tipo
      ].join(" ").toLocaleLowerCase("pt-BR");

      return (
        (!search || searchable.includes(search)) &&
        (!status || item.status === status)
      );
    });

  $("#allProtocols").innerHTML = items.length
    ? items.map((item) => protocolMarkup(item, true)).join("")
    : emptyMarkup();

  bindViewButtons($("#allProtocols"));
}

$("#protocolSearch").addEventListener("input", renderProtocols);
$("#statusFilter").addEventListener("change", renderProtocols);

// ======================================
// ESCOLHA DO TIPO DE SOLICITAÇÃO
// ======================================

$$("[data-action-type]").forEach((card) => {
  card.addEventListener("click", () => {
    $$(".action-card").forEach((item) => {
      item.classList.toggle("selected", item === card);
    });

    const type = card.dataset.actionType;

    $("#actionType").value = type;
    $("#actionDetails").classList.remove("hidden");

    const subject = $("#assunto");

    if (type === "Indicação") {
      subject.innerHTML = `
        <option value="">Selecione uma opção</option>
        <option>Tapa-buracos e pavimentação</option>
        <option>Iluminação pública</option>
        <option>Limpeza</option>
        <option>Manutenção de espaços públicos</option>
        <option>Sinalização de trânsito</option>
        <option value="Outro">Outro</option>
      `;
    } else if (type === "Requerimento") {
      subject.innerHTML = `
        <option value="">Selecione o assunto</option>
        <option>Pedido de informações</option>
        <option>Esclarecimentos sobre serviços</option>
        <option>Previsão de obra</option>
        <option>Gastos públicos</option>
        <option value="Outro">Outro</option>
      `;
    } else {
      subject.innerHTML = `
        <option value="">Selecione o assunto</option>
        <option>Educação</option>
        <option>Saúde</option>
        <option>Meio ambiente</option>
        <option>Mobilidade urbana</option>
        <option>Coleta seletiva</option>
        <option value="Outro">Outro</option>
      `;
    }

    $("#otherSubjectWrap").classList.add("hidden");
    $("#outroAssunto").required = false;
    subject.required = true;

    $("#actionDetails").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

// ======================================
// OPÇÃO "OUTRO"
// ======================================

$("#assunto").addEventListener("change", () => {
  const isOther = $("#assunto").value === "Outro";

  $("#otherSubjectWrap").classList.toggle(
    "hidden",
    !isOther
  );

  $("#outroAssunto").required = isOther;

  if (!isOther) {
    $("#outroAssunto").value = "";
  }
});

// ======================================
// FOTO DA SOLICITAÇÃO
// ======================================

function resetImage() {
  selectedImageData = "";

  $("#foto").value = "";
  $("#imagePreview").src = "";

  $("#imagePreviewWrap").classList.add("hidden");

  $("#uploadBox .upload-label").classList.remove("hidden");

  $("#foto").required = true;
}

$("#foto").addEventListener("change", (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast("Selecione um arquivo de imagem válido.");
    resetImage();
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    toast("A imagem deve ter no máximo 5 MB.");
    resetImage();
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    selectedImageData = String(reader.result || "");

    $("#imagePreview").src = selectedImageData;
    $("#fileName").textContent = file.name;

    $("#fileSize").textContent =
      `${(file.size / 1024 / 1024).toFixed(2)} MB`;

    $("#imagePreviewWrap").classList.remove("hidden");
    $("#uploadBox .upload-label").classList.add("hidden");
  };

  reader.onerror = () => {
    toast("Não foi possível ler a imagem.");
    resetImage();
  };

  reader.readAsDataURL(file);
});

$("#removeImage").addEventListener("click", resetImage);

// ======================================
// CONTADOR DA JUSTIFICATIVA
// ======================================

$("#justificativa").addEventListener("input", () => {
  $("#charCount").textContent =
    `${$("#justificativa").value.length} caracteres`;
});

// ======================================
// RESUMO DO CADASTRO NA SOLICITAÇÃO
// ======================================

function renderCitizenSummary() {
  const profile = loadProfile();

  if (profileComplete(profile)) {
    $("#citizenSummary").innerHTML = `
      <p>
        <strong>Cadastro identificado:</strong>
        ${esc(profile.nome)} · ${esc(profile.telefone)}
      </p>

      <p>
        ${esc(profile.rua)}, nº ${esc(profile.numero)} —
        ${esc(profile.bairro)}, CEP ${esc(profile.cep)}
      </p>

      <button type="button" class="text-button" data-view="perfil">
        Atualizar cadastro
      </button>
    `;
  } else {
    $("#citizenSummary").innerHTML = `
      <p>
        Para registrar uma solicitação, crie seu cadastro
        e entre no portal com seu usuário e senha.
      </p>

      <button type="button" class="button button-outline" data-view="perfil">
        Criar meu cadastro
      </button>
    `;
  }

  bindViewButtons($("#citizenSummary"));
}

// ======================================
// ENVIAR SOLICITAÇÃO
// ======================================

$("#indicationForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!isLoggedIn()) {
    toast("Entre no portal antes de enviar.");
    showView("login");
    return;
  }

  const form = event.currentTarget;

  if (!form.reportValidity()) return;

  const type = $("#actionType").value;

  if (!type) {
    toast("Escolha Indicação, Requerimento ou Projeto de Lei.");
    return;
  }

  if (!selectedImageData) {
    toast("Anexe uma foto para ajudar na análise.");
    $("#foto").focus();
    return;
  }

  const file = $("#foto").files[0];

  if (!file || file.size > MAX_FILE_SIZE) {
    toast("Escolha uma imagem válida de até 5 MB.");
    return;
  }

  const profile = loadProfile();
  const items = loadProtocols();
  const now = new Date();

  const subject = $("#assunto").value === "Outro"
    ? $("#outroAssunto").value.trim()
    : $("#assunto").value;

  if (!subject) {
    toast("Informe o assunto.");
    return;
  }

  const protocol = {
    id: `SOL-${now.getFullYear()}-${String(Date.now()).slice(-6)}`,
    data: now.toISOString(),
    tipo: type,
    assunto: subject,
    rua: $("#localRua").value.trim(),
    numero: $("#localNumero").value.trim(),
    bairro: $("#localBairro").value.trim(),
    justificativa: $("#justificativa").value.trim(),
    imageName: file.name,
    imageData: selectedImageData,
    status: "Em espera",
    citizenName: profile.nome
  };

  items.unshift(protocol);

  try {
    saveProtocols(items);
  } catch {
    toast("Não foi possível salvar. Tente uma imagem menor.");
    return;
  }

  form.reset();
  resetImage();

  $("#charCount").textContent = "0 caracteres";
  $("#actionType").value = "";

  $("#actionDetails").classList.add("hidden");
  $("#otherSubjectWrap").classList.add("hidden");

  $$(".action-card").forEach((card) => {
    card.classList.remove("selected");
  });

  renderHome();
  renderCitizenSummary();

  toast(`Solicitação registrada! Protocolo: ${protocol.id}`);

  goToView("protocolos");
});

// ======================================
// CADASTRO E PREENCHIMENTO DO PERFIL
// ======================================

function populateProfile() {
  const profile = loadProfile();

  [
    "nome",
    "nascimento",
    "profissao",
    "usuario",
    "cep",
    "bairro",
    "rua",
    "numero",
    "telefone"
  ].forEach((key) => {
    const field = $("#" + key);

    if (field) {
      field.value = profile[key] || "";
    }
  });

  $("#welcomeLabel").textContent =
    isLoggedIn() && profile.nome
      ? `Olá, ${profile.nome.split(" ")[0]}`
      : "Área do cidadão";
}

$("#nome").addEventListener("input", () => {
  if (!$("#usuario").dataset.userEdited) {
    $("#usuario").value = $("#nome").value;
  }
});

$("#usuario").addEventListener("input", () => {
  $("#usuario").dataset.userEdited = "true";
});

// ======================================
// CRIAR CONTA
// ======================================

$("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!event.currentTarget.reportValidity()) return;

  const password = $("#senha").value;
  const confirmation = $("#confirmarSenha").value;

  if (
    !/[A-Za-zÀ-ÿ]/.test(password) ||
    !/\d/.test(password) ||
    password.length < 8
  ) {
    toast(
      "A senha precisa ter ao menos 8 caracteres, incluindo letras e números."
    );
    return;
  }

  if (password !== confirmation) {
    toast("As senhas não conferem.");
    $("#confirmarSenha").focus();
    return;
  }

  const profile = {
    nome: $("#nome").value.trim(),
    nascimento: $("#nascimento").value,
    profissao: $("#profissao").value.trim(),
    usuario: $("#usuario").value.trim(),
    senha: password,
    cep: $("#cep").value.trim(),
    bairro: $("#bairro").value.trim(),
    rua: $("#rua").value.trim(),
    numero: $("#numero").value.trim(),
    telefone: $("#telefone").value.trim()
  };

  if (
    profile.usuario.toLocaleLowerCase("pt-BR") !==
    profile.nome.toLocaleLowerCase("pt-BR")
  ) {
    toast("O usuário deve ser igual ao nome completo.");
    return;
  }

  saveProfile(profile);

  sessionStorage.removeItem("portalAtendimentosLoggedIn");

  $("#loginUsuario").value = profile.usuario;
  $("#loginSenha").value = "";

  populateProfile();

  toast("Cadastro criado. Agora entre com seu usuário e senha.");

  showView("login");
});

// ======================================
// LOGIN
// ======================================

$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const profile = loadProfile();

  if (!profileComplete(profile)) {
    toast("Você ainda não tem cadastro. Crie sua conta primeiro.");
    showView("perfil");
    return;
  }

  const enteredUser = $("#loginUsuario").value
    .trim()
    .toLocaleLowerCase("pt-BR");

  const savedUser = profile.usuario.toLocaleLowerCase("pt-BR");
  const enteredPassword = $("#loginSenha").value;

  if (
    enteredUser !== savedUser ||
    enteredPassword !== profile.senha
  ) {
    toast("Usuário ou senha incorretos.");
    return;
  }

  sessionStorage.setItem(
    "portalAtendimentosLoggedIn",
    "true"
  );

  populateProfile();

  toast("Acesso realizado com sucesso.");

  showView("inicio");
  renderHome();
});

// ======================================
// FORMATAÇÃO DO CEP
// ======================================

$("#cep").addEventListener("input", (event) => {
  let value = event.target.value
    .replace(/\D/g, "")
    .slice(0, 8);

  if (value.length > 5) {
    value = value.slice(0, 5) + "-" + value.slice(5);
  }

  event.target.value = value;
});

// ======================================
// INICIALIZAÇÃO
// ======================================

populateProfile();
renderHome();
renderCitizenSummary();

if (!isLoggedIn() && profileComplete()) {
  showView("login");
}
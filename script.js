// ================= CONFIGURAÇÕES =================
const API_URL = "https://script.google.com/macros/s/AKfycbyxeyY1T0pRCzsqhcsM5qMUAUBdblOj_DkOEZ_zQCM9IpkRzvlsksF5OPvn7lokUJkc/exec";
const WHATSAPP_NUMERO = "5527999199405"; 

// Tempo de cache em minutos (blindagem de cota e carregamento instantâneo)
const TEMPO_CACHE_MINUTOS = 5; 

// ================= ESTADO DA APLICAÇÃO =================
let produtos = [];
let carrinho = []; // Zera ao fechar ou dar F5
let categoriaAtiva = "Todos";
let termoBusca = "";

// Elementos DOM
const gridProdutos = document.getElementById("product-grid");
const buscaInput = document.getElementById("product-search");
const btnLimparBusca = document.getElementById("clear-search");
const containerCategorias = document.getElementById("category-list");

// Carrinho DOM
const btnAbrirCarrinho = document.getElementById("open-cart");
const btnFloatingCart = document.getElementById("floating-cart");
const floatingCartCount = document.getElementById("floating-cart-count");
const btnFecharCarrinho = document.getElementById("close-cart");
const cartOverlay = document.getElementById("cart-overlay");
const cartDrawer = document.getElementById("cart-drawer");
const cartItemsContainer = document.getElementById("cart-items");
const cartEmpty = document.getElementById("cart-empty");
const cartBottom = document.getElementById("cart-bottom");
const cartCount = document.getElementById("cart-count");
const cartSubtotal = document.getElementById("cart-subtotal");
const btnContinuarComprando = document.getElementById("continue-shopping");

// Checkout DOM
const btnCheckout = document.getElementById("checkout-button");
const checkoutDialog = document.getElementById("checkout-dialog");
const btnFecharCheckout = document.getElementById("close-checkout");
const checkoutForm = document.getElementById("checkout-form");
const dialogSubtotal = document.getElementById("dialog-subtotal");

// ================= INICIALIZAÇÃO =================
document.addEventListener("DOMContentLoaded", () => {
  localStorage.removeItem("@natco_cart");

  const anoElemento = document.getElementById("year");
  if (anoElemento) anoElemento.textContent = new Date().getFullYear();
  
  carregarProdutosComCache();
  configurarEventosFixos();
  atualizarCarrinho();
});

// ================= CONVERSOR DE LINKS DE IMAGEM =================
function formatarLinkImagem(url) {
  if (!url || typeof url !== "string") return "assets/logo-natco.png";
  
  let fileId = "";
  if (url.includes("drive.google.com")) {
    const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) fileId = matchD[1];
    else if (matchId && matchId[1]) fileId = matchId[1];

    if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url.trim();
}

// ================= BUSCAR DADOS (COM BLINDAGEM DE CACHE) =================
async function carregarProdutosComCache() {
  const cacheDados = localStorage.getItem("@natco_cardapio_cache");
  const cacheTempo = localStorage.getItem("@natco_cardapio_time");
  const agora = Date.now();
  const limiteTempo = TEMPO_CACHE_MINUTOS * 60 * 1000;

  // Se existe cache dentro dos 5 minutos, carrega instantaneamente
  if (cacheDados && cacheTempo && (agora - cacheTempo < limiteTempo)) {
    produtos = JSON.parse(cacheDados);
    renderizarCategoriasDinamicas();
    renderizarProdutos();
    return;
  }

  gridProdutos.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Carregando delícias...</p>";

  try {
    const res = await fetch(API_URL);
    const dados = await res.json();

    produtos = dados.map((item, index) => {
      const idUnico = item.id ? String(item.id).trim() : `prod_${index + 1}`;
      
      return {
        id: idUnico,
        nome: item.nome || "Produto sem nome",
        categoria: (item.categoria ? String(item.categoria).trim() : "Geral"),
        preco: parseFloat(String(item.preco || 0).replace(",", ".")),
        descricao: item.descricao || "",
        imagem: formatarLinkImagem(item.imagem)
      };
    }).filter(p => p.nome && p.nome !== "Produto sem nome");

    localStorage.setItem("@natco_cardapio_cache", JSON.stringify(produtos));
    localStorage.setItem("@natco_cardapio_time", String(agora));

    renderizarCategoriasDinamicas();
    renderizarProdutos();
  } catch (erro) {
    console.error("Erro ao carregar dados:", erro);
    if (cacheDados) {
      produtos = JSON.parse(cacheDados);
      renderizarCategoriasDinamicas();
      renderizarProdutos();
    } else {
      gridProdutos.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Não foi possível carregar os produtos. Tente novamente mais tarde.</p>";
    }
  }
}

// ================= CATEGORIAS DINÂMICAS =================
function renderizarCategoriasDinamicas() {
  if (!containerCategorias) return;

  const categoriasUnicas = [...new Set(produtos.map(p => p.categoria).filter(Boolean))];

  let html = `<button class="category-chip ${categoriaAtiva === 'Todos' ? 'active' : ''}" data-category="Todos" type="button">Todos os produtos</button>`;

  categoriasUnicas.forEach(cat => {
    const ativa = (categoriaAtiva === cat) ? "active" : "";
    html += `<button class="category-chip ${ativa}" data-category="${cat}" type="button">${cat}</button>`;
  });

  containerCategorias.innerHTML = html;

  containerCategorias.querySelectorAll(".category-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      containerCategorias.querySelectorAll(".category-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      categoriaAtiva = chip.dataset.category;
      renderizarProdutos();
    });
  });
}

// ================= RENDERIZAR PRODUTOS (0 -> N) =================
function renderizarProdutos() {
  const produtosFiltrados = produtos.filter(produto => {
    const bateCategoria = (categoriaAtiva === "Todos" || produto.categoria.toLowerCase() === categoriaAtiva.toLowerCase());
    const bateBusca = produto.nome.toLowerCase().includes(termoBusca.toLowerCase()) || 
                      produto.descricao.toLowerCase().includes(termoBusca.toLowerCase());
    return bateCategoria && bateBusca;
  });

  if (produtosFiltrados.length === 0) {
    gridProdutos.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color: var(--muted); padding: 40px 0;'>Nenhum produto encontrado nesta categoria.</p>";
    return;
  }

  gridProdutos.innerHTML = produtosFiltrados.map(produto => {
    const noCarrinho = carrinho.find(i => i.id === produto.id);
    const qtdAtual = noCarrinho ? noCarrinho.quantidade : 0;

    return `
      <article class="product-card">
        <div class="product-photo-wrap">
          <img class="product-photo" src="${produto.imagem}" alt="${produto.nome}" loading="lazy" onerror="this.src='assets/logo-natco.png'">
          <span class="product-category">${produto.categoria}</span>
        </div>
        <div class="product-info">
          <h3>${produto.nome}</h3>
          <p class="product-description">${produto.descricao}</p>
          
          <div class="product-bottom-wrap">
            <span class="product-price">${formatarPreco(produto.preco)}</span>
            
            <div class="card-stepper">
              <button type="button" 
                      id="btn-minus-${produto.id}"
                      onclick="alterarDiretoNoCard('${produto.id}', -1)" 
                      aria-label="Diminuir"
                      ${qtdAtual === 0 ? "disabled" : ""}>-</button>
              
              <span class="card-qty-num" id="card-qty-${produto.id}">${qtdAtual}</span>
              
              <button type="button" 
                      onclick="alterarDiretoNoCard('${produto.id}', 1)" 
                      aria-label="Aumentar">+</button>
            </div>
          </div>

        </div>
      </article>
    `;
  }).join("");
}

// ================= AÇÃO DIRETA NO CARD =================
window.alterarDiretoNoCard = function(id, delta) {
  const produto = produtos.find(p => p.id === String(id));
  if (!produto) return;

  const itemExistente = carrinho.find(item => item.id === String(id));

  if (delta > 0) {
    if (itemExistente) {
      itemExistente.quantidade++;
    } else {
      carrinho.push({ ...produto, quantidade: 1 });
    }
  } else if (delta < 0) {
    if (itemExistente) {
      itemExistente.quantidade--;
      if (itemExistente.quantidade <= 0) {
        carrinho = carrinho.filter(i => i.id !== String(id));
      }
    }
  }

  atualizarCarrinho();
};

// ================= SINCRONIZAR NÚMEROS NA VITRINE =================
function sincronizarCardsComCarrinho() {
  produtos.forEach(prod => {
    const spanQty = document.getElementById(`card-qty-${prod.id}`);
    const btnMinus = document.getElementById(`btn-minus-${prod.id}`);
    
    if (spanQty) {
      const item = carrinho.find(i => i.id === prod.id);
      const qtd = item ? item.quantidade : 0;
      spanQty.textContent = qtd;

      if (btnMinus) {
        btnMinus.disabled = (qtd === 0);
      }
    }
  });
}

// ================= CARRINHO =================
window.alterarQuantidade = function(id, delta) {
  const item = carrinho.find(i => i.id === String(id));
  if (!item) return;

  item.quantidade += delta;
  if (item.quantidade <= 0) {
    removerDoCarrinho(id);
    return;
  }
  atualizarCarrinho();
};

window.removerDoCarrinho = function(id) {
  carrinho = carrinho.filter(i => i.id !== String(id));
  atualizarCarrinho();
};

function atualizarCarrinho() {
  const totalItens = carrinho.reduce((acc, cur) => acc + cur.quantidade, 0);
  const totalValor = carrinho.reduce((acc, cur) => acc + (cur.preco * cur.quantidade), 0);

  if (cartCount) cartCount.textContent = totalItens;
  if (floatingCartCount) floatingCartCount.textContent = totalItens;
  if (cartSubtotal) cartSubtotal.textContent = formatarPreco(totalValor);
  if (dialogSubtotal) dialogSubtotal.textContent = formatarPreco(totalValor);

  if (btnFloatingCart) {
    btnFloatingCart.hidden = (totalItens === 0);
  }

  sincronizarCardsComCarrinho();

  if (carrinho.length === 0) {
    cartEmpty.style.display = "block";
    cartItemsContainer.style.display = "none";
    cartBottom.classList.add("is-hidden");
  } else {
    cartEmpty.style.display = "none";
    cartItemsContainer.style.display = "block";
    cartBottom.classList.remove("is-hidden");

    cartItemsContainer.innerHTML = carrinho.map(item => `
      <div class="cart-item">
        <img src="${item.imagem}" alt="${item.nome}" onerror="this.src='assets/logo-natco.png'">
        <div>
          <h3>${item.nome}</h3>
          <span class="cart-item-price">${formatarPreco(item.preco)}</span>
          <div class="quantity-control">
            <button onclick="alterarQuantidade('${item.id}', -1)">-</button>
            <span>${item.quantidade}</span>
            <button onclick="alterarQuantidade('${item.id}', 1)">+</button>
          </div>
        </div>
        <button class="remove-item" onclick="removerDoCarrinho('${item.id}')" title="Remover produto">✕</button>
      </div>
    `).join("");
  }
}

// ================= CHECKOUT WHATSAPP (100% ENTREGA) =================
function finalizarPedido(e) {
  e.preventDefault();
  const form = new FormData(checkoutForm);
  
  const nome = form.get("name");
  const pagamento = form.get("payment_method") || "A combinar";
  const obs = form.get("notes") || "Nenhuma";
  
  // Endereço sempre obrigatório e formatado para entrega
  const enderecoStr = `📍 *Endereço de Entrega:*
Rua: ${form.get("street")}, Nº: ${form.get("number")}
Bairro: ${form.get("neighborhood")} - ${form.get("city")}/${form.get("state")}
Comp: ${form.get("complement") || "Não informado"}
CEP: ${form.get("cep")}`;

  const subtotal = carrinho.reduce((acc, cur) => acc + (cur.preco * cur.quantidade), 0);

  let textoPedido = `*NOVO PEDIDO - NATCO* 🇦🇷\n\n`;
  textoPedido += `👤 *Cliente:* ${nome}\n`;
  textoPedido += `🛵 *Tipo:* Entrega\n`;
  textoPedido += `💳 *Forma de pagamento:* ${pagamento}\n\n`;
  textoPedido += `🛒 *Itens do Pedido:*\n`;

  carrinho.forEach(item => {
    textoPedido += `• ${item.quantidade}x ${item.nome} (${formatarPreco(item.preco * item.quantidade)})\n`;
  });

  textoPedido += `\n💰 *Total:* ${formatarPreco(subtotal)}\n\n`;
  textoPedido += `${enderecoStr}\n\n`;
  textoPedido += `📝 *Obs:* ${obs}`;

  const link = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(textoPedido)}`;
  window.open(link, "_blank");
}

// ================= BUSCA DE CEP (VIACEP) =================
async function buscarCEP() {
  const cepInput = document.getElementById("customer-cep");
  const status = document.getElementById("cep-status");
  const cep = cepInput.value.replace(/\D/g, "");

  if (cep.length !== 8) {
    status.textContent = "Digite um CEP válido com 8 números.";
    return;
  }

  status.textContent = "Buscando endereço...";

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();

    if (data.erro) {
      status.textContent = "CEP não encontrado.";
      return;
    }

    document.getElementById("customer-street").value = data.logradouro || "";
    document.getElementById("customer-neighborhood").value = data.bairro || "";
    document.getElementById("customer-city").value = data.localidade || "";
    document.getElementById("customer-state").value = data.uf || "";
    status.textContent = "Endereço preenchido com sucesso!";
  } catch {
    status.textContent = "Erro ao buscar CEP. Preencha manualmente.";
  }
}

// ================= CONFIGURAÇÃO DE EVENTOS FIXOS =================
function configurarEventosFixos() {
  buscaInput.addEventListener("input", e => {
    termoBusca = e.target.value;
    btnLimparBusca.hidden = !termoBusca;
    renderizarProdutos();
  });

  btnLimparBusca.addEventListener("click", () => {
    buscaInput.value = "";
    termoBusca = "";
    btnLimparBusca.hidden = true;
    renderizarProdutos();
  });

  const abrirGaveta = () => {
    cartDrawer.classList.add("open");
    cartOverlay.classList.add("visible");
    document.body.classList.add("no-scroll");
  };

  const fecharGaveta = () => {
    cartDrawer.classList.remove("open");
    cartOverlay.classList.remove("visible");
    document.body.classList.remove("no-scroll");
  };

  btnAbrirCarrinho.addEventListener("click", abrirGaveta);
  if (btnFloatingCart) btnFloatingCart.addEventListener("click", abrirGaveta);

  btnFecharCarrinho.addEventListener("click", fecharGaveta);
  cartOverlay.addEventListener("click", fecharGaveta);
  btnContinuarComprando.addEventListener("click", fecharGaveta);

  btnCheckout.addEventListener("click", () => {
    fecharGaveta();
    checkoutDialog.showModal();
  });

  btnFecharCheckout.addEventListener("click", () => checkoutDialog.close());
  checkoutForm.addEventListener("submit", finalizarPedido);

  document.getElementById("lookup-cep").addEventListener("click", buscarCEP);
}

// ================= UTILITÁRIOS =================
function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
# 🔐 Como Configurar o Google Login (Passo a Passo)

Para o login com Google funcionar, precisas de criar um "Projeto" na Google e ligá-lo ao Supabase. É um pouco chato, mas só se faz uma vez!

---

## 1. Encontrar o "Callback URL" no Supabase
Antes de ir à Google, precisas de saber para onde a Google deve mandar o utilizador depois de fazer  login.
1.  Vai ao teu projeto no **[Supabase Dashboard](https://supabase.com/dashboard)**.
2.  Clica em **Authentication** (ícone cadeado) > **Providers**.
3.  Clica em **Google** (para expandir).
4.  Copia o **Callback URL** (parece-se com `https://xxxx.supabase.co/auth/v1/callback`).
    *   *Vais precisar disto no passo 3!*

---

## 2. Configurar a Google Cloud
1.  Acede à **[Google Cloud Console](https://console.cloud.google.com/)** e faz login.
2.  No topo esquerdo, clica em **Select a project** > **New Project**.
    *   Dá o nome "MenuNoAr" (ou o que quiseres) e clica em **Create**.
3.  Com o projeto selecionado, vai ao menu (três riscos) > **APIs & Services** > **OAuth consent screen**.
    *   **User Type**: Escolhe **External**. Clica **Create**.
    *   **App Information**: Preenche "App Name" (MenuNoAr), "User support email" (o teu) e "Developer contact info" (o teu).
    *   Clica **Save and Continue** (podes saltar "Scopes" e "Test Users" se for só para ti testar agora, ou adiciona o teu email em "Test Users" para garantir).
    *   *Nota: Em modo "Testing", só os emails que adicionares em "Test Users" conseguem entrar.*

---

## 3. Criar as Credenciais (Client ID & Secret)
1.  No menu lateral esquerdo, clica em **Credentials**.
2.  Clica em **+ CREATE CREDENTIALS** (no topo) > **OAuth client ID**.
3.  **Application type**: Escolhe **Web application**.
4.  **Name**: "Supabase Auth" (exemplo).
5.  **Authorized redirect URIs** (AQUI É IMPORTANTE!):
    *   Clica em **Add URI**.
    *   **COLA O URL** que copiaste do Supabase no passo 1 (o tal `.../callback`).
6.  Clica em **Create**.

---

## 4. Ligar ao Supabase
1.  A Google vai mostrar uma janela com "**Your Client ID**" e "**Your Client Secret**".
2.  Volta à página do **Supabase > Authentication > Providers > Google**.
3.  Cola o **Client ID** no campo "Client ID".
4.  Cola o **Client Secret** no campo "Client Secret".
5.  Muda o botão "Enable Sign in with Google" para **ON**.
6.  Clica em **Save**.

---

## ✅ Feito!
Agora, quando clicares em "Entrar com Google" na tua app (`login.html`), o Supabase vai falar com a Google e autenticar o utilizador.

# C4 Architecture Documentation

## Monitoramento de Preços - Sistema de OCR e Análise

**Data**: 2026-04-21  
**Versão**: 1.0.0  
**Autor**: Sistema Autônomo de Documentação

---

## Nível 1: Contexto (System Context)

```mermaid
C4Context
    title System Context - Monitoramento de Preços

    Person(usuario, "Usuário", "Operador de loja que registra preços e analisa KPIs")
    Person(admin, "Administrador", "Gerente que acessa relatórios e configurações")

    System_Boundary(sistema, "Monitoramento de Preços") {
        System(app, "Aplicação PWA", "Interface web com OCR e análise de preços")
        SystemDb(db, "Firestore", "Banco de dados em tempo real")
        System(storage, "Firebase Storage", "Armazenamento de imagens")
    }

    System_Ext(tesseract, "Tesseract.js", "Motor OCR para extração de texto")
    System_Ext(chartjs, "Chart.js", "Biblioteca de visualização")
    System_Ext(firebase, "Firebase", "Plataforma de backend")

    Rel(usuario, app, "Registra preços via OCR", "HTTPS")
    Rel(admin, app, "Visualiza relatórios e KPIs", "HTTPS")
    
    Rel(app, tesseract, "Processa imagens", "WebAssembly")
    Rel(app, chartjs, "Renderiza gráficos", "JavaScript")
    Rel(app, firebase, "Persiste dados", "REST/WebSocket")
    
    Rel(firebase, db, "Armazena registros", "Protocolo Firebase")
    Rel(firebase, storage, "Armazena imagens", "HTTPS")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Escopo do Sistema

O sistema é uma **PWA (Progressive Web App)** para monitoramento de preços em redes varejistas, com as seguintes capacidades:

- **OCR Inteligente**: Extração de dados de etiquetas usando Tesseract.js
- **Análise em Tempo Real**: KPIs e gráficos atualizados instantaneamente
- **Persistência Firebase**: Dados sincronizados na nuvem com cache offline
- **Exportação**: Relatórios em CSV e PDF
- **Segurança**: Rate limiting, audit logging, CSP headers

---

## Nível 2: Container (Containers)

```mermaid
C4Container
    title Container Diagram - Monitoramento de Preços

    Person(usuario, "Usuário", "Operador de loja")

    System_Boundary(browser, "Browser/WebView") {
        Container_Boundary(pwa, "PWA - Monitoramento de Preços") {
            Container(spa, "Single Page App", "TypeScript", "Interface principal com rotas e estado")
            Container(ocr, "OCR Engine", "TypeScript/Web Worker", "Processamento de imagens e extração de texto")
            Container(state, "State Manager", "TypeScript", "Gerenciamento de estado global")
            Container(db_local, "IndexedDB", "Browser API", "Cache offline de dados e imagens")
        }
    }

    Container_Boundary(services, "Serviços Cloud") {
        Container(firebase_app, "Firebase App", "SDK", "Autenticação e configuração")
        Container(firestore, "Cloud Firestore", "NoSQL", "Banco de dados em tempo real")
        Container(fb_storage, "Cloud Storage", "Object Storage", "Armazenamento de imagens comprimidas")
    }

    Container_Ext(tesseract_cdn, "Tesseract.js", "CDN", "Motor OCR")
    Container_Ext(chartjs_lib, "Chart.js", "Library", "Visualização de dados")

    Rel(usuario, spa, "Interage com", "HTTPS")
    
    Rel(spa, ocr, "Envia imagens para", "MessageChannel")
    Rel(spa, state, "Lê/Escreve", "Eventos")
    Rel(spa, db_local, "Cacheia dados em", "IndexedDB API")
    
    Rel(ocr, tesseract_cdn, "Carrega modelo de", "HTTPS")
    Rel(spa, chartjs_lib, "Renderiza gráficos via", "JavaScript")
    
    Rel(spa, firebase_app, "Autentica em", "HTTPS")
    Rel(spa, firestore, "Sincroniza dados com", "WebSocket")
    Rel(spa, fb_storage, "Faz upload de imagens para", "HTTPS")
    
    Rel(firebase_app, firestore, "Gerencia")
    Rel(firebase_app, fb_storage, "Gerencia")

    UpdateLayoutConfig($c4ShapeInRow="3")
```

### Containers Principais

| Container | Tecnologia | Responsabilidade |
|-----------|------------|------------------|
| **SPA** | TypeScript/Vanilla JS | Interface do usuário, formulários, tabelas, dashboards |
| **OCR Engine** | TypeScript + Tesseract.js | Extração de texto de imagens, normalização, validação |
| **State Manager** | TypeScript | Estado global, persistência local, sincronização |
| **IndexedDB** | Browser API | Cache offline, fila de sincronização |
| **Firebase Services** | SDK Firebase | Backend-as-a-Service, auth, database, storage |

---

## Nível 3: Componentes (Components)

```mermaid
C4Component
    title Component Diagram - OCR Engine & Data Flow

    Container_Boundary(ocr_container, "OCR Engine Container") {
        Component(worker, "OCR Web Worker", "TypeScript", "Processamento assíncrono de imagens")
        Component(core, "OCR Core", "TypeScript", "Coordenação e gerenciamento de workers")
        Component(strategies, "Store Strategies", "TypeScript", "Padrões específicos por loja (Honor, Premium, etc)")
        Component(validator, "Data Validator", "TypeScript", "Validação de extrações e normalização")
        Component(preprocessor, "Image Preprocessor", "TypeScript", "Crop, resize, enhance")
    }

    Container_Boundary(ui_container, "UI Components") {
        Component(app_ts, "App Controller", "TypeScript", "Orquestração da aplicação")
        Component(auth_ts, "Auth Manager", "TypeScript", "Autenticação e seleção de loja")
        Component(ui_ts, "UI Utils", "TypeScript", "Toasts, modais, feedback visual")
        Component(charts_ts, "Chart Manager", "TypeScript", "KPIs e visualizações")
        Component(export_ts, "Export Manager", "TypeScript", "CSV/PDF generation")
    }

    Container_Boundary(data_container, "Data Layer") {
        Component(firebase_ts, "Firebase Service", "TypeScript", "CRUD, rate limiting, audit logging")
        Component(state_ts, "State Manager", "TypeScript", "Estado global e reatividade")
        Component(utils_ts, "Utilities", "TypeScript", "Helpers, formatação, regressão")
    }

    Rel(app_ts, worker, "Envia imagem para", "MessageChannel")
    Rel(worker, preprocessor, "Pré-processa em", "Canvas API")
    Rel(worker, strategies, "Aplica estratégia", "Pattern Matching")
    Rel(worker, validator, "Valida resultado em", "Type Guards")
    Rel(worker, core, "Reporta progresso para", "Events")
    
    Rel(app_ts, firebase_ts, "Persiste via", "Async/Await")
    Rel(app_ts, state_ts, "Gerencia estado em", "Events")
    Rel(app_ts, charts_ts, "Renderiza via", "Chart.js API")
    Rel(app_ts, export_ts, "Exporta dados via", "File API")
    
    Rel(auth_ts, firebase_ts, "Autentica em", "SHA-256 Hash")
    Rel(ui_ts, app_ts, "Notifica eventos em", "Callbacks")
    
    Rel(firebase_ts, utils_ts, "Usa helpers de", "Imports")

    UpdateLayoutConfig($c4ShapeInRow="3")
```

### Componentes Principais

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **App Controller** | `src/app.ts` | Orquestração principal, tabela, KPIs, filtros |
| **Auth Manager** | `src/auth.ts` | Senhas por loja, hash SHA-256, seleção |
| **Firebase Service** | `src/firebase.ts` | Firestore, Storage, rate limiting, audit |
| **OCR Core** | `src/ocr/core.ts` | Gerenciamento de workers Tesseract |
| **OCR Engine** | `src/ocr/ocr.ts` | Lógica principal de extração (1000+ linhas) |
| **Store Strategies** | `src/ocr/strategies/*.ts` | Padrões específicos por rede varejista |
| **Data Validator** | `src/ocr/core.ts` | Validação e normalização de dados extraídos |
| **State Manager** | `src/state.ts` | Estado global reativo |
| **UI Utils** | `src/ui.ts` | Feedback visual, toasts, relógio |
| **Chart Manager** | `src/charts.ts` | Gráficos e indicadores |
| **Export Manager** | `src/export.ts` | Geração de relatórios |

---

## Nível 4: Código (Code)

### Estrutura de Diretórios

```
src/
├── app.ts                 # Controlador principal
├── auth.ts                # Autenticação
├── firebase.ts            # Serviço Firebase (secure)
├── state.ts               # Estado global
├── ui.ts                  # Utilitários UI
├── charts.ts              # Visualização
├── export.ts              # Exportação
├── utils.ts               # Helpers
├── keys.ts                # Atalhos de teclado
├── ocr/
│   ├── core.ts            # Gerenciamento Tesseract
│   ├── ocr.ts             # Engine principal
│   └── strategies/        # Estratégias por loja
│       ├── base.ts        # Normalização base
│       ├── honor.ts       # Lojas Honor
│       └── ...            # Outras redes
└── workers/               # Web Workers (futuro)
    └── ocr.worker.ts      # OCR em background
```

### Fluxo de Dados - OCR

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Imagem    │────▶│ Preprocessor │────▶│ Tesseract.js│
│   (Base64)  │     │ (Crop/Resize)│     │  (Worker)   │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                  │
                         ┌────────────────────────┘
                         ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Dados     │◀────│  Strategies  │◀────│   Raw Text  │
│  Validados  │     │(Store Rules) │     │  (OCR Out)  │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│   Firebase  │◀────│   State      │
│  Firestore  │     │   Manager    │
└─────────────┘     └──────────────┘
```

### Padrões de Segurança

| Camada | Implementação |
|--------|---------------|
| **Configuração** | Variáveis de ambiente (.env) |
| **Rate Limiting** | 100 requisições/minuto por operação |
| **Audit Logging** | Registro de todas as operações CRUD |
| **CSP** | Headers restritivos em vite.config.ts |
| **HSTS** | HTTPS obrigatório |
| **XSS Protection** | Sanitização de inputs |

### Decisões Técnicas

| Decisão | Justificativa |
|---------|---------------|
| **Tesseract.js** | OCR client-side, sem envio de imagens para servidores |
| **Firebase** | Real-time sync, offline persistence, hosting |
| **PWA** | Funciona offline, instalável, atualizações automáticas |
| **TypeScript Strict** | Type safety, detecção de erros em build time |
| **Web Workers** | OCR não bloqueia UI thread |
| **Virtual Scrolling** | Performance com milhares de registros |

---

## Mapeamento de Qualidade

### KPIs de Código

| Métrica | Valor Atual | Target | Status |
|---------|-------------|--------|--------|
| **Type Coverage** | 60% | 95% | 🔴 |
| **Test Coverage** | 5% | 80% | 🔴 |
| **Security Score** | 3/5 | 5/5 | 🟡 |
| **Performance** | 3/5 | 5/5 | 🟡 |
| **Maintainability** | 2/5 | 5/5 | 🔴 |

### Próximas Iterações

1. **Agente #2**: Testes (80%+ coverage), zero `any`, strict types
2. **Agente #3**: Web Workers para OCR, Virtual Scrolling, Code Splitting

---

## Apêndice

### Tecnologias

- **Frontend**: TypeScript 5.x, Chart.js 4.x
- **OCR**: Tesseract.js 6.x
- **Backend**: Firebase (Firestore, Storage, Auth)
- **Build**: Vite 6.x
- **Testes**: Vitest + Playwright (pending)
- **PWA**: Vite PWA Plugin

### Padrões de Código

- **ESLint**: Configuração strict
- **Prettier**: Formatação automática
- **Conventional Commits**: Padrão de mensagens
- **SOLID**: Princípios de design
- **Clean Architecture**: Separação de concerns

---

*Documentação gerada automaticamente pelo sistema C4.*
*Para atualizações, execute: `skill c4-architecture-c4-architecture`*

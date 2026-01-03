# 📘 Terapeuta IA - Documentação

> Aplicativo de terapia com IA utilizando o método de autocura quântica

## 📁 Índice de Documentação

| Documento | Descrição |
|-----------|-----------|
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de versões e mudanças |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura técnica do sistema |
| [DESIGN.md](./DESIGN.md) | Guia de design e componentes UI |
| [API.md](./API.md) | Documentação das Edge Functions |
| [DATABASE.md](./DATABASE.md) | Schema do banco de dados |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Guia de deploy e ambientes |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Regras de contribuição e commits |

## 🏗️ Estrutura do Projeto

```
terapeuta-ia-23/
├── docs/                    # Documentação
├── public/                  # Assets estáticos
├── src/
│   ├── components/          # Componentes React
│   │   ├── ui/              # Componentes base (shadcn)
│   │   └── *.tsx            # Componentes customizados
│   ├── hooks/               # Custom hooks
│   ├── integrations/        # Integrações externas
│   │   └── supabase/        # Client e tipos Supabase
│   ├── lib/                 # Utilitários
│   └── pages/               # Páginas da aplicação
├── supabase/
│   ├── functions/           # Edge Functions
│   └── migrations/          # Migrações SQL
└── package.json
```

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Rodar localmente
npm run dev

# Build produção
npm run build
```

## 📦 Versão Atual

**v1.0.0** - Consulte [CHANGELOG.md](./CHANGELOG.md) para detalhes

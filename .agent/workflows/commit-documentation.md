---
description: Workflow obrigatório para atualizar documentação e changelog antes de commits
---

# 📋 Atualização de Documentação e Changelog

Este workflow deve ser seguido **SEMPRE** antes de commitar qualquer correção ou melhoria no GitHub.

---

## ⛔ REGRA CRÍTICA (LER ANTES DE QUALQUER COMMIT)

> **VOCÊ NÃO PODE FAZER COMMIT SEM ATUALIZAR O CHANGELOG!**
> 
> Antes de rodar `git commit`, você DEVE:
> 1. Abrir `docs/CHANGELOG.md`
> 2. Adicionar uma entrada descrevendo o que foi feito (com emojis e categorias corretas)
> 3. Se for uma nova versão, atualizar `package.json` e `public/version.json`
>
> **Mensagens de commit curtas NÃO substituem o changelog.** O changelog é a documentação oficial para o usuário e desenvolvedores futuros.

---

## Checklist Obrigatório

Antes de fazer commit, verifique se completou TODOS os itens:

### 1. Atualizar Changelog

Edite `docs/CHANGELOG.md` adicionando uma entrada na seção da versão atual:

⚠️ **IMPORTANTE**: Existem DOIS arquivos de changelog!
- `docs/CHANGELOG.md` → Fonte da verdade (edite este)
- `public/docs/CHANGELOG.md` → Cópia para o frontend (sincronize após editar)

Após editar `docs/CHANGELOG.md`, **SEMPRE** copie para `public/docs/`:
```powershell
Copy-Item -Path "docs\CHANGELOG.md" -Destination "public\docs\CHANGELOG.md" -Force
```

```markdown
## [Unreleased] ou [X.X.X] - YYYY-MM-DD

### ✨ Adicionado
- Nova funcionalidade X

### 🔄 Alterado
- Mudança em Y

### 🐛 Corrigido
- Bug Z corrigido
```

**Tipos de mudança:**
- ✨ **Adicionado** - para novas funcionalidades
- 🔄 **Alterado** - para mudanças em funcionalidades existentes
- ⚠️ **Depreciado** - para funcionalidades que serão removidas
- 🗑️ **Removido** - para funcionalidades removidas
- 🐛 **Corrigido** - para correções de bugs
- 🔒 **Segurança** - para correções de vulnerabilidades
- 🔧 **Técnico** - para mudanças internas/refatorações

### 2. Atualizar Documentação Relevante

Verifique se algum dos seguintes arquivos precisa ser atualizado:

| Arquivo | Quando atualizar |
|---------|------------------|
| `docs/ARCHITECTURE.md` | Mudanças na arquitetura, novos fluxos |
| `docs/DESIGN.md` | Novos componentes, mudanças de estilo |
| `docs/API.md` | Novas Edge Functions ou endpoints |
| `docs/DATABASE.md` | Novas tabelas, colunas ou migrations |
| `docs/DEPLOYMENT.md` | Novos secrets, passos de deploy |

### 3. Atualizar Versão (se aplicável)

Para releases:
1. Atualizar `version` em `package.json`
2. Atualizar `version` e `buildDate` em `public/version.json`
3. Mover itens de "Unreleased" para nova seção no `CHANGELOG.md`

// turbo
### 4. Verificar Build

```bash
npm run build
```

### 5. Commit com Mensagem Padrão

Use o formato de commit convencional:

```bash
git add .
git commit -m "tipo(escopo): descrição curta"
```

**Tipos de commit:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação (sem mudança de código)
- `refactor`: Refatoração
- `test`: Testes
- `chore`: Tarefas de manutenção

**Exemplos:**
```bash
git commit -m "feat(credits): adiciona tabs de filtro por provider"
git commit -m "fix(audio): corrige truncamento de áudio"
git commit -m "docs: atualiza changelog para v1.0.1"
```

## Resumo Rápido

```
1. ✏️ Editar docs/CHANGELOG.md
2. 📚 Atualizar docs relevantes
3. 🔢 Atualizar versão (se release)
4. ✅ npm run build
5. 📤 git commit com mensagem padrão
```

# 📜 Regras de Contribuição

## Obrigatório Antes de Commit

> ⚠️ **REGRA:** Toda correção ou melhoria DEVE atualizar documentação e changelog ANTES de commitar.

### Checklist de Commit

- [ ] Atualizar `docs/CHANGELOG.md` com a mudança
- [ ] Atualizar documentação relevante em `/docs`
- [ ] Rodar `npm run build` sem erros
- [ ] Usar formato de commit convencional

### Formato de Commit

```
tipo(escopo): descrição curta

Corpo opcional explicando o que e por quê.

Refs: #issue (se aplicável)
```

**Tipos:**
| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `style` | Formatação |
| `refactor` | Refatoração |
| `test` | Testes |
| `chore` | Manutenção |

### Versionamento Semântico

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): Novas funcionalidades
- **PATCH** (1.0.0 → 1.0.1): Correções de bugs

### Arquivos a Verificar

| Mudança | Arquivos |
|---------|----------|
| Nova feature | `CHANGELOG.md`, doc relevante |
| Bug fix | `CHANGELOG.md` |
| Nova Edge Function | `CHANGELOG.md`, `API.md` |
| Nova tabela/coluna | `CHANGELOG.md`, `DATABASE.md` |
| Mudança de UI | `CHANGELOG.md`, `DESIGN.md` |
| Mudança de arquitetura | `CHANGELOG.md`, `ARCHITECTURE.md` |

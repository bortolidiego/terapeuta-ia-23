# 🎨 Guia de Design

## Princípios de Design

1. **Clareza** - Interface intuitiva e objetiva
2. **Calma** - Cores e animações suaves (contexto terapêutico)
3. **Acessibilidade** - Suporte a temas claro/escuro
4. **Consistência** - Padrões visuais uniformes

## Paleta de Cores

### Cores Primárias
| Nome | Light | Dark | Uso |
|------|-------|------|-----|
| Primary | `hsl(222, 47%, 31%)` | `hsl(222, 47%, 70%)` | Ações principais |
| Secondary | `hsl(210, 40%, 96%)` | `hsl(217, 33%, 17%)` | Elementos secundários |
| Accent | `hsl(210, 40%, 90%)` | `hsl(217, 33%, 25%)` | Destaques |

### Cores Semânticas
| Nome | Classe | Uso |
|------|--------|-----|
| Destructive | `text-destructive` | Erros, exclusões |
| Success | `text-green-500` | Confirmações |
| Warning | `text-amber-500` | Alertas |
| Info | `text-blue-500` | Informações |

### Cores de Provider
| Provider | Cor | Classe |
|----------|-----|--------|
| LLM (OpenRouter) | Roxo | `text-purple-500` |
| Voz (VoiceKiller) | Azul | `text-blue-500` |
| Pagamentos (Asaas) | Verde | `text-green-500` |

## Tipografia

- **Font Family**: System UI (nativo do sistema)
- **Headings**: `font-bold`
- **Body**: `text-sm` (14px)
- **Small**: `text-xs` (12px)

## Componentes

### Botões
```tsx
// Primário
<Button>Ação Principal</Button>

// Secundário
<Button variant="outline">Ação Secundária</Button>

// Destrutivo
<Button variant="destructive">Excluir</Button>

// Ghost
<Button variant="ghost">Link</Button>
```

### Cards
```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    Conteúdo
  </CardContent>
</Card>
```

### Toasts
```tsx
// Sucesso
toast({ title: "Sucesso!", description: "..." });

// Erro
toast({ title: "Erro", variant: "destructive" });
```

## Espaçamento

| Tamanho | Classe | Pixels |
|---------|--------|--------|
| XS | `gap-1`, `p-1` | 4px |
| SM | `gap-2`, `p-2` | 8px |
| MD | `gap-4`, `p-4` | 16px |
| LG | `gap-6`, `p-6` | 24px |
| XL | `gap-8`, `p-8` | 32px |

## Ícones

Utilizamos **Lucide React** para todos os ícones.

```tsx
import { Brain, Mic, CreditCard } from "lucide-react";

// Tamanhos
<Icon className="h-4 w-4" /> // Pequeno
<Icon className="h-5 w-5" /> // Médio
<Icon className="h-6 w-6" /> // Grande
```

## Dark Mode

- Tema gerenciado por `next-themes`
- Toggle no header global
- Todas as cores têm variantes para dark mode
- Usar classes semânticas (`bg-background`, `text-foreground`)

## Responsividade

| Breakpoint | Prefixo | Largura |
|------------|---------|---------|
| Mobile | - | < 768px |
| Tablet | `md:` | ≥ 768px |
| Desktop | `lg:` | ≥ 1024px |
| Wide | `xl:` | ≥ 1280px |

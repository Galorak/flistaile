# Flistaile

Jogo incremental (clicker/idle) no estilo Clicker Heroes / Taskbar Heroes. **Flistaile** é um guardião que luta com **dois escudos**, um em cada braço, e vai esmagando criaturas por nove regiões até o Abismo Eterno.

Site: https://flistaile.galorakdev.com/

## Como jogar

- **Clique na arena** para golpear com o escudo (dano por clique).
- Derrote **10 criaturas** para liberar a próxima zona. A cada **5 zonas** aparece um **chefe** com tempo limite; se ele vencer, você volta uma zona para farmar (ligue "Avançar" quando estiver mais forte).
- **Treinos**: aumentam o golpe e o DPS automático (escudos espectrais). A cada 25 níveis o treino dobra de força.
- **Atributos**: Precisão (crítico), Impacto Esmagador (dano crítico), Ganância (ouro) e Sinergia (golpe ganha parte do DPS).
- **Escudos**: forje o Escudo Esquerdo (multiplica o golpe) e o Escudo Direito (multiplica o DPS) de Madeira até Eterno. Manter os dois no mesmo nível dá o bônus de **Harmonia**.
- **Habilidades** (teclas 1–5): Fúria Dupla, Rajada, Olho do Falcão, Chuva de Ouro e Impacto Sísmico.
- **Renascer** (zona 30+): recomeça da zona 1 e ganha **Égides** — cada uma dá +10% de dano e compra **Relíquias** permanentes.
- Baús Vivos aparecem de vez em quando e dão muito ouro.
- O jogo continua rendendo ouro com a aba fechada (até 12h).

O progresso fica salvo no navegador (localStorage) e pode ser exportado/importado em **Opções**.

## Estrutura

Site estático, sem dependências nem build:

```
index.html
assets/style.css
assets/game.js   # lógica, economia e gráficos (canvas)
assets/icon.svg
```

## Rodar localmente

```
php -S 127.0.0.1:8095
```

(ou qualquer servidor de arquivos estáticos) e abra http://127.0.0.1:8095.

## Publicar

Envie os arquivos para a pasta pública do subdomínio na Hostinger (`public_html` do `flistaile.galorakdev.com`).
